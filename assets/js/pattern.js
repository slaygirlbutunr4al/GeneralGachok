const SUPABASE_URL = 'https://aviukajqbzmgbtwjijmk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lkqx0Wf0GyBdsd4u69Sryg_BELv1YHM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DIFFICULTY_LABELS = {
  1: 'НОВАЧОК',
  2: 'СЕРЕДНІЙ',
  3: 'ПРОФІ',
};

const CATEGORY_LABELS = {
  1: 'ІГРАШКИ',
  2: 'ОДЯГ',
  3: 'АКСЕСУАРИ',
  4: "ІНТЕР'ЄР",
  5: 'МЕРЕЖИВО',
};

const THICKNESS_LABELS = {
  1: 'Пряжа: Тонка (Lace / Fingering)',
  2: 'Пряжа: Легка (Sport / Baby)',
  3: 'Пряжа: Середня (DK / Worsted)',
  4: 'Пряжа: Товста (Bulky)',
  5: 'Пряжа: Плюшева (Super Bulky)',
};

const STITCH_FULL_NAMES = {
  'КА': 'Кільце амігурумі (КА)',
  'СБН': 'Стовпчик без накиду (СбН)',
  'ПР': 'Прибавка (Пр)',
  'УБ': 'Убавка (Уб)',
  'ПВ': 'Повітряна петля (ПВ)',
  'ЗС': 'З’єднувальний стовпчик (ЗС)',
  'НПЗН': 'Напівстовпчик з накидом (нПСзН)',
  'СЗН': 'Стовпчик з накидом (СзН)',
  'ССН': 'Стовпчик з накидом (СсН)',
  'ПП': 'Повітряна петля (ПП)',
  'SC': 'Стовпчик без накиду (SC)',
  'DC': 'Стовпчик з накидом (DC)',
  'HDC': 'Напівстовпчик з накидом (HDC)',
  'CH': 'Повітряна петля (CH)',
  'SLST': 'З’єднувальний стовпчик (SLST)',
  'INC': 'Прибавка (INC)',
  'DEC': 'Убавка (DEC)',
  'MR': 'Кільце амігурумі (MR)',
};

// Глобальний виклик стікі-віджета майстра «Нитковимірювач»
window.openMeasurerWidget = function openMeasurerWidget(options = { step: 'menu' }) {
  window.dispatchEvent(new CustomEvent('hachok:open-measurer', { detail: options }));

  if (window.HachokMeasurerWidget && typeof window.HachokMeasurerWidget.open === 'function') {
    window.HachokMeasurerWidget.open(options);
    return;
  }

  const toast = document.getElementById('measurer-toast');
  const toastText = document.getElementById('measurer-toast-text');
  if (!toast || !toastText) return;

  toastText.textContent =
    'Інтерактивний стікі-віджет «Нитковимірювач» для розрахунку пряжі та запуску проєкту буде підключено в наступній лабораторній.';
  toast.classList.remove('hidden');
};

function getLoggedInUser() {
  const raw = localStorage.getItem('hachok_user') || sessionStorage.getItem('hachok_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

// ==========================================
// 1. РЕНДЕР ОБКЛАДИНКИ ТА ЗАГОЛОВКА СХЕМИ
// ==========================================
function renderPatternHeader(pattern) {
  document.title = `Схема: ${pattern.name_pattern} — Генерал Гачок`;
  document.getElementById('pattern-title').textContent = pattern.name_pattern;

  const badgesRow = document.getElementById('pattern-badges-row');
  const catLabel = CATEGORY_LABELS[pattern.product_category] || 'СХЕМА';
  const diffLabel = DIFFICULTY_LABELS[pattern.difficulty] || 'СЕРЕДНІЙ';
  const authorText = pattern.author ? `Автор: ${pattern.author}` : 'Майстерня «Генерал Гачок»';

  badgesRow.innerHTML = `
    <span class="bg-parchment-bg border border-hachok-gold text-hachok-dark text-xs font-bold px-2.5 py-0.5 tracking-wider uppercase">${catLabel}</span>
    <span class="bg-parchment-bg border border-hachok-gold text-hachok-dark text-xs font-bold px-2.5 py-0.5 tracking-wider uppercase">${diffLabel}</span>
    <span class="text-xs text-hachok-muted ml-1"><i class="fas fa-user-pen mr-1" aria-hidden="true"></i>${authorText}</span>
  `;

  const descEl = document.getElementById('pattern-description');
  if (pattern.description) {
    descEl.textContent = pattern.description;
    descEl.classList.remove('hidden');
  }

  const coverBox = document.getElementById('pattern-cover-box');
  if (pattern.image_url) {
    coverBox.innerHTML = `
      <img src="${pattern.image_url}" alt="Обкладинка схеми ${pattern.name_pattern}" class="pattern-cover-img"
           onerror="this.parentElement.innerHTML='<div class=\\'pattern-cover-placeholder\\'><i class=\\'fas fa-image\\' aria-hidden=\\'true\\'></i><span>ФОТО СХЕМИ</span></div>';">
    `;
  }
}

// ==========================================
// 2. РЕНДЕР НАБОРУ СТІБКІВ (ЧЕРВОНА ЗОНА)
// ==========================================
function renderStitchesList(sections, currentUser, calibratedStitchIds) {
  const listEl = document.getElementById('pattern-stitches-list');
  if (!listEl) return;

  const stitchMap = new Map();
  sections.forEach((sec) => {
    (sec.section_stitch || []).forEach((ss) => {
      if (ss.stitch && !stitchMap.has(ss.stitch.id_stitch)) {
        stitchMap.set(ss.stitch.id_stitch, ss.stitch);
      }
    });
  });

  const uniqueStitches = Array.from(stitchMap.values());

  if (uniqueStitches.length === 0) {
    listEl.innerHTML = '<li class="text-xs text-hachok-muted">Стібки для цієї схеми не вказані.</li>';
    return;
  }

  listEl.innerHTML = uniqueStitches
    .map((st, idx) => {
      const displayName = STITCH_FULL_NAMES[st.name_stitch] || st.name_stitch;
      let statusBadgeHtml = '';

      if (!currentUser) {
        statusBadgeHtml = `
          <a href="auth.html" class="badge-status badge-warning hover:underline">
            <i class="fas fa-lock" aria-hidden="true"></i> Потрібна реєстрація
          </a>
        `;
      } else if (calibratedStitchIds.has(st.id_stitch)) {
        statusBadgeHtml = `
          <span class="badge-status badge-success">
            <i class="fas fa-check-circle" aria-hidden="true"></i> Калібрування виконано
          </span>
        `;
      } else {
        statusBadgeHtml = `
          <span class="badge-status badge-warning">
            <i class="fas fa-exclamation-circle" aria-hidden="true"></i> Калібрування невиконано
          </span>
        `;
      }

      return `
        <li>
          <span>${idx + 1}. ${displayName}</span>
          ${statusBadgeHtml}
        </li>
      `;
    })
    .join('');
}

// ==========================================
// 3. РЕНДЕР ІНСТРУМЕНТІВ ТА МАТЕРІАЛІВ (ЧЕРВОНА + СИНЯ ЗОНИ)
// ==========================================
function renderMaterialsList(sections, currentUser, userYarns) {
  const listEl = document.getElementById('pattern-materials-list');
  if (!listEl) return;

  const thicknessSet = new Set();
  const hookSet = new Set();

  sections.forEach((sec) => {
    if (sec.rec_thickness_category != null) {
      thicknessSet.add(Number(sec.rec_thickness_category));
    }
    if (sec.rec_hook_size != null && !Number.isNaN(Number(sec.rec_hook_size))) {
      hookSet.add(Number(sec.rec_hook_size));
    }
  });

  const itemsHtml = [];
  let itemIndex = 1;

  thicknessSet.forEach((catId) => {
    const yarnLabel = THICKNESS_LABELS[catId] || `Пряжа (категорія ${catId})`;
    let badgeHtml = '';

    if (!currentUser) {
      badgeHtml = `
        <a href="auth.html" class="badge-status badge-warning hover:underline">
          <i class="fas fa-lock" aria-hidden="true"></i> Потрібна реєстрація
        </a>
      `;
    } else {
      const matchedYarns = userYarns.filter(
        (y) => Number(y.thickness_category) === catId && Number(y.skein_count) * Number(y.skein_length) > 0
      );

      if (matchedYarns.length > 0) {
        const firstYarn = matchedYarns[0];
        const meters = Number(firstYarn.skein_count) * Number(firstYarn.skein_length);
        badgeHtml = `
          <span class="badge-status badge-success">
            <i class="fas fa-check-circle" aria-hidden="true"></i> В наявності (${firstYarn.name_yarn} — ${meters}м)
          </span>
        `;
      } else {
        badgeHtml = `
          <span class="badge-status badge-warning">
            <i class="fas fa-exclamation-circle" aria-hidden="true"></i> Немає в наявності
          </span>
        `;
      }
    }

    itemsHtml.push(`
      <li>
        <span>${itemIndex++}. ${yarnLabel}</span>
        ${badgeHtml}
      </li>
    `);
  });

  Array.from(hookSet)
    .sort((a, b) => a - b)
    .forEach((hookSize) => {
      itemsHtml.push(`
        <li>
          <span>${itemIndex++}. Гачок ${hookSize} мм</span>
          <span class="badge-status badge-info">
            <i class="fas fa-wrench" aria-hidden="true"></i> Рекомендовано
          </span>
        </li>
      `);
    });

  if (itemsHtml.length === 0) {
    listEl.innerHTML = '<li class="text-xs text-hachok-muted">Матеріали та інструменти не вказані.</li>';
    return;
  }

  listEl.innerHTML = itemsHtml.join('');
}

// ==========================================
// 4. РЕНДЕР СЕКЦІЙ У 2 КОЛОНКИ З РОЗДІЛЬНИКОМ РЯДІВ
// ==========================================
function renderSectionsGrid(sections) {
  const container = document.getElementById('pattern-sections-container');
  if (!container) return;

  if (!sections || sections.length === 0) {
    container.innerHTML = `
      <div class="bg-parchment-card border border-hachok-dark p-6 text-center text-sm text-hachok-muted">
        Частини (секції) для цієї схеми ще не додані.
      </div>
    `;
    return;
  }

  const pairs = [];
  for (let i = 0; i < sections.length; i += 2) {
    pairs.push(sections.slice(i, i + 2));
  }

  container.innerHTML = pairs
    .map((pair, rowIndex) => {
      const cardsHtml = pair
        .map((sec, colIndex) => {
          const iconClass = colIndex === 0 ? 'fa-book-open' : 'fa-layer-group';
          const sortedRows = (sec.section_row || []).slice().sort((a, b) => a.row_start - b.row_start);

          const rowsHtml =
            sortedRows.length > 0
              ? sortedRows
                  .map((r) => {
                    const rowLabel =
                      r.row_start === r.row_end
                        ? `Рядок ${r.row_start}:`
                        : `Рядки ${r.row_start}–${r.row_end}:`;
                    return `<p><strong>${rowLabel}</strong> ${r.instruction_text}</p>`;
                  })
                  .join('')
              : `<p class="text-sm text-hachok-muted italic">Покроковий опис рядків для цієї частини ще не додано.</p>`;

          const hookNote = sec.rec_hook_size ? ` • Гачок: ${sec.rec_hook_size} мм` : '';

          return `
            <article class="pattern-text-card h-full">
              <div class="card-title-bar flex items-center justify-between gap-2 flex-wrap">
                <h2><i class="fas ${iconClass}" aria-hidden="true"></i> Текст схеми (Частина ${sec.section_order}: ${sec.name_section})</h2>
                <span class="text-xs text-hachok-muted font-medium">Рядків: ${sec.row_count_}${hookNote}</span>
              </div>
              <div class="pattern-text-content flex-grow">
                ${rowsHtml}
              </div>
            </article>
          `;
        })
        .join('');

      const dividerHtml =
        rowIndex > 0
          ? `
            <div class="flex items-center gap-4 my-8" role="separator" aria-hidden="true">
              <div class="h-px bg-hachok-gold flex-grow"></div>
              <span class="px-3 py-1 bg-parchment-card border border-hachok-gold text-hachok-dark font-heading font-bold text-xs uppercase tracking-widest">
                <i class="fas fa-diamond text-hachok-gold mr-1.5"></i> Наступні частини
              </span>
              <div class="h-px bg-hachok-gold flex-grow"></div>
            </div>
          `
          : '';

      return `
        ${dividerHtml}
        <section class="pattern-text-grid items-stretch">
          ${cardsHtml}
        </section>
      `;
    })
    .join('');
}

// ==========================================
// 5. КАРУСЕЛЬ ВІДГУКІВ (SWIPER) ТА МОДАЛЬНА ФОРМА ДОДАВАННЯ ВІДГУКУ
// ==========================================
let reviewsSwiperInstance = null;

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&' + 'amp;')
    .replace(/</g, '&' + 'lt;')
    .replace(/>/g, '&' + 'gt;')
    .replace(/"/g, '&' + 'quot;')
    .replace(/'/g, '&' + '#39;');
}

function renderStarsHtml(rating) {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html +=
      i <= safeRating
        ? '<i class="fas fa-star text-hachok-gold" aria-hidden="true"></i>'
        : '<i class="far fa-star text-hachok-muted/50" aria-hidden="true"></i>';
  }
  return html;
}

function getCompletedProjectsBadge(count) {
  if (!count || count <= 0) return '';
  const text =
    count === 1
      ? 'Завершив проєкт за цією схемою'
      : `Завершив ${count} проєктів за цією схемою`;

  return `
    <span
      class="inline-flex items-center gap-1.5 text-xs font-bold text-green-800 bg-green-100 border border-green-700/40 px-2 py-0.5"
      title="${escapeHtml(text)}"
    >
      <i class="fas fa-check-circle text-green-700" aria-hidden="true"></i>
      <span>${escapeHtml(text)}</span>
    </span>
  `;
}

function initReviewsSwiper() {
  if (reviewsSwiperInstance) {
    reviewsSwiperInstance.destroy(true, true);
    reviewsSwiperInstance = null;
  }

  if (typeof Swiper === 'undefined') {
    console.warn('Swiper.js не підключено на сторінці.');
    return;
  }

  reviewsSwiperInstance = new Swiper('.reviews-swiper', {
    slidesPerView: 1.1,
    spaceBetween: 16,
    grabCursor: true,
    watchOverflow: true,
    pagination: {
      el: '.reviews-swiper .swiper-pagination',
      clickable: true,
    },
    navigation: {
      nextEl: '.reviews-next',
      prevEl: '.reviews-prev',
    },
    breakpoints: {
      640: {
        slidesPerView: 1.6,
        spaceBetween: 20,
      },
      1024: {
        slidesPerView: 3,
        spaceBetween: 24,
      },
    },
  });
}

async function loadAndRenderReviews(patternId) {
  const countEl = document.getElementById('reviews-count');
  const emptyEl = document.getElementById('reviews-empty-state');
  const wrapEl = document.getElementById('reviews-swiper-wrap');
  const wrapperEl = document.getElementById('reviews-swiper-wrapper');

  if (!wrapperEl) return;

  const { data: reviews, error } = await supabaseClient
    .from('pattern_review')
    .select(`
      id_review,
      review_text,
      photo_url,
      rating,
      created_at,
      id_user,
      id_project,
      user_ ( id_user, nickname )
    `)
    .eq('id_pattern', patternId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Помилка завантаження відгуків:', error);
    return;
  }

  const list = reviews || [];
  if (countEl) countEl.textContent = list.length;

  if (list.length === 0) {
    emptyEl?.classList.remove('hidden');
    wrapEl?.classList.add('hidden');
    return;
  }

  emptyEl?.classList.add('hidden');
  wrapEl?.classList.remove('hidden');

  // Рахуємо завершені проєкти авторів відгуків по цій схемі через yarn(id_user)
  const userIds = [...new Set(list.map((r) => r.id_user).filter(Boolean))];
  const completedCountByUser = {};

  if (userIds.length > 0) {
    const { data: userProjects, error: projErr } = await supabaseClient
      .from('project')
      .select(`
        id_project,
        project_status,
        yarn!inner ( id_user )
      `)
      .eq('id_pattern', patternId)
      .in('yarn.id_user', userIds);

    if (!projErr && userProjects) {
      userProjects.forEach((p) => {
        const uid = p.yarn?.id_user;
        // Вважаємо завершеним, якщо project_status >= 2 (або налаштуй свій код статусу)
        const isCompleted = Number(p.project_status) >= 2;
        if (uid && isCompleted) {
          completedCountByUser[uid] = (completedCountByUser[uid] || 0) + 1;
        }
      });
    }
  }

  wrapperEl.innerHTML = list
    .map((rev) => {
      const authorName = rev.id_user
        ? rev.user_?.nickname || 'Майстер'
        : 'Гість';
      const completedCount = rev.id_user ? completedCountByUser[rev.id_user] || 0 : 0;
      const badgeHtml = getCompletedProjectsBadge(completedCount);
      const projectTagHtml = rev.id_project
        ? `<span class="inline-flex items-center gap-1 text-xs text-hachok-muted bg-parchment-bg border border-hachok-gold/60 px-2 py-0.5 mb-2"><i class="fas fa-link" aria-hidden="true"></i> Проєкт #${escapeHtml(rev.id_project)}</span>`
        : '';
      const dateText = rev.created_at
        ? new Date(rev.created_at).toLocaleDateString('uk-UA')
        : '';

      const photoHtml = rev.photo_url
        ? `<img src="${escapeHtml(rev.photo_url)}" alt="Фото виробу від ${escapeHtml(authorName)}" class="w-16 h-16 object-cover border border-hachok-dark shrink-0" loading="lazy" onerror="this.outerHTML='<div class=\\'w-16 h-16 bg-parchment-bg border border-hachok-gold flex items-center justify-center text-hachok-muted shrink-0\\'><i class=\\'fas fa-image\\'></i></div>'">`
        : `<div class="w-16 h-16 bg-parchment-bg border border-hachok-gold flex items-center justify-center text-hachok-muted shrink-0" aria-hidden="true"><i class="fas fa-user-check text-xl"></i></div>`;

      return `
        <div class="swiper-slide h-auto">
          <article class="bg-parchment-card border-2 border-hachok-dark p-5 h-full flex flex-col justify-between shadow-sm">
            <div>
              <div class="flex items-start gap-3 mb-3">
                ${photoHtml}
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2">
                    <h3 class="font-heading font-bold text-lg text-hachok-dark truncate">
                      ${escapeHtml(authorName)}
                    </h3>
                    ${completedCount > 0 ? '<i class="fas fa-check-circle text-green-700 text-lg shrink-0" title="Завершив проєкт за цією схемою" aria-hidden="true"></i>' : ''}
                  </div>
                  <div class="flex items-center gap-1 text-sm mt-0.5" aria-label="Оцінка ${rev.rating} з 5">
                    ${renderStarsHtml(rev.rating)}
                    <span class="text-xs text-hachok-muted ml-1">${rev.rating}/5</span>
                  </div>
                  <div class="text-xs text-hachok-muted mt-1">${dateText}</div>
                </div>
              </div>

              ${badgeHtml ? `<div class="mb-2">${badgeHtml}</div>` : ''}
              ${projectTagHtml}

              <p class="text-sm text-hachok-dark leading-relaxed break-words">
                ${escapeHtml(rev.review_text)}
              </p>
            </div>
          </article>
        </div>
      `;
    })
    .join('');

  initReviewsSwiper();
}

function initReviewModal(patternId, currentUser, projectId = null) {
  const modal = document.getElementById('review-modal');
  const openBtn = document.getElementById('open-review-modal-btn');
  const closeBtn = document.getElementById('close-review-modal-btn');
  const cancelBtn = document.getElementById('cancel-review-modal-btn');
  const form = document.getElementById('review-form');
  const userNote = document.getElementById('review-user-note');

  const starsPicker = document.getElementById('review-stars-picker');
  const ratingInput = document.getElementById('review-rating-input');
  const ratingLabel = document.getElementById('review-rating-label');
  const zeroBtn = document.getElementById('review-rating-zero-btn');

  const textInput = document.getElementById('review-text-input');
  const textError = document.getElementById('review-text-error');
  const photoInput = document.getElementById('review-photo-input');
  const photoError = document.getElementById('review-photo-error');
  const statusEl = document.getElementById('review-form-status');
  const submitBtn = document.getElementById('submit-review-btn');

  if (!modal || !openBtn || !form) return;

  function updateStarsUI(val) {
    const rating = Math.max(0, Math.min(5, Number(val) || 0));
    ratingInput.value = String(rating);
    ratingLabel.textContent = `${rating} / 5`;

    starsPicker.querySelectorAll('.star-btn').forEach((btn) => {
      const btnVal = Number(btn.dataset.rating);
      const icon = btn.querySelector('i');
      if (btnVal <= rating) {
        icon.className = 'fas fa-star';
      } else {
        icon.className = 'far fa-star';
      }
    });
  }

  function openModal() {
    userNote.textContent = currentUser
      ? `Ви залишаєте відгук як ${currentUser.nickname || 'авторизований майстер'}.`
      : 'Ви залишаєте відгук як Гість. Увійдіть в акаунт, щоб відображався бейдж завершеного проєкту.';

    statusEl.classList.add('hidden');
    textError.classList.add('hidden');
    photoError.classList.add('hidden');
    textInput.setAttribute('aria-invalid', 'false');
    photoInput.setAttribute('aria-invalid', 'false');

    updateStarsUI(5);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    textInput.focus();
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    openBtn.focus();
  }

  openBtn.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  starsPicker.addEventListener('click', (e) => {
    const btn = e.target.closest('.star-btn');
    if (!btn) return;
    updateStarsUI(Number(btn.dataset.rating));
  });

  zeroBtn?.addEventListener('click', () => updateStarsUI(0));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const reviewText = textInput.value.trim();
    const photoUrl = photoInput.value.trim();
    const rating = Number(ratingInput.value);

    let hasError = false;

    if (reviewText.length < 3) {
      textError.textContent = 'Напишіть хоча б 3 символи у відгуку.';
      textError.classList.remove('hidden');
      textInput.setAttribute('aria-invalid', 'true');
      hasError = true;
    } else {
      textError.classList.add('hidden');
      textInput.setAttribute('aria-invalid', 'false');
    }

    if (photoUrl && !/^https?:\/\/.+/i.test(photoUrl)) {
      photoError.textContent = 'Посилання має починатися з http:// або https://';
      photoError.classList.remove('hidden');
      photoInput.setAttribute('aria-invalid', 'true');
      hasError = true;
    } else {
      photoError.classList.add('hidden');
      photoInput.setAttribute('aria-invalid', 'false');
    }

    if (hasError) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Надсилання...';

    const payload = {
      id_pattern: Number(patternId),
      id_user: currentUser?.id_user ? Number(currentUser.id_user) : null,
      id_project: projectId ? Number(projectId) : null,
      rating: Number(rating),
      review_text: reviewText,
      photo_url: photoUrl || null,
    };

    const { error } = await supabaseClient.from('pattern_review').insert([payload]);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Надіслати відгук';

    if (error) {
      console.error('Помилка додавання відгуку:', error);
      statusEl.textContent = `Помилка (${error.code || 'DB'}): ${error.message || 'Не вдалося зберегти відгук.'}`;
      statusEl.className = 'text-sm font-medium p-2.5 border border-red-700 bg-red-50 text-red-800';
      statusEl.classList.remove('hidden');
      return;
    }

    form.reset();
    updateStarsUI(5);
    statusEl.textContent = 'Дякуємо! Ваш відгук успішно опубліковано.';
    statusEl.className = 'text-sm font-medium p-2.5 border border-green-700 bg-green-50 text-green-800';
    statusEl.classList.remove('hidden');

    await loadAndRenderReviews(patternId);

    setTimeout(() => {
      closeModal();
    }, 900);
  });
}

// ==========================================
// ІНІЦІАЛІЗАЦІЯ СТОРІНКИ СХЕМИ
// ==========================================
async function initPatternPage() {
  const params = new URLSearchParams(window.location.search);
  const patternIdParam = params.get('id');
  const currentUser = getLoggedInUser();

  let query = supabaseClient.from('pattern').select(`
    id_pattern,
    name_pattern,
    difficulty,
    product_category,
    author,
    description,
    image_url,
    section (
      id_section,
      name_section,
      section_order,
      row_count_,
      rec_thickness_category,
      rec_hook_size,
      section_stitch (
        stitch_count,
        stitch ( id_stitch, name_stitch, video_url, video_language )
      ),
      section_row (
        id_row,
        row_start,
        row_end,
        instruction_text
      )
    )
  `);

  if (patternIdParam) {
    query = query.eq('id_pattern', Number(patternIdParam));
  } else {
    query = query.order('id_pattern', { ascending: false }).limit(1);
  }

  const { data: patterns, error } = await query;

  if (error || !patterns || patterns.length === 0) {
    console.error('Помилка завантаження схеми:', error);
    document.getElementById('pattern-title').textContent = 'Схему не знайдено';
    document.getElementById('pattern-sections-container').innerHTML = `
      <div class="bg-parchment-card border border-hachok-dark p-8 text-center space-y-3">
        <p class="text-base text-hachok-dark">На жаль, запитувану схему не вдалося знайти в базі даних.</p>
        <a href="catalog.html" class="inline-block px-5 py-2.5 bg-hachok-dark text-hachok-gold font-heading font-bold uppercase text-sm tracking-wider">
          Повернутися до каталогу
        </a>
      </div>
    `;
    return;
  }

  const pattern = patterns[0];
  const sortedSections = (pattern.section || []).slice().sort((a, b) => a.section_order - b.section_order);

  let userYarns = [];
  const calibratedStitchIds = new Set();

  if (currentUser && currentUser.id_user) {
    const [yarnRes, calRes] = await Promise.all([
      supabaseClient.from('yarn').select('*').eq('id_user', currentUser.id_user),
      supabaseClient
        .from('calibration')
        .select('id_stitch, yarn!inner(id_user)')
        .eq('yarn.id_user', currentUser.id_user),
    ]);

    userYarns = yarnRes.data || [];
    (calRes.data || []).forEach((c) => calibratedStitchIds.add(c.id_stitch));
  }

  renderPatternHeader(pattern);
  renderStitchesList(sortedSections, currentUser, calibratedStitchIds);
  renderMaterialsList(sortedSections, currentUser, userYarns);
  renderSectionsGrid(sortedSections);

  const createBtn = document.getElementById('create-project-from-pattern-btn');
  createBtn?.addEventListener('click', () => {
    if (!currentUser) {
      window.location.href = 'auth.html';
      return;
    }
    window.openMeasurerWidget({ step: 'project', patternId: pattern.id_pattern });
  });

  await loadAndRenderReviews(pattern.id_pattern);
  initReviewModal(pattern.id_pattern, currentUser);
}

document.addEventListener('DOMContentLoaded', initPatternPage);