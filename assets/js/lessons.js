/**
 * Завантаження та відображення відеоуроків зі стібків із бази даних Supabase
 * Проєкт: «Генерал Гачок»
 */

const SUPABASE_URL = 'https://aviukajqbzmgbtwjijmk.supabase.co';
// Підставте ваш актуальний anon key (той самий, що використовується в інших скриптах проєкту)
const SUPABASE_ANON_KEY = window.HACHOK_SUPABASE_ANON_KEY || 'sb_publishable_lkqx0Wf0GyBdsd4u69Sryg_BELv1YHM';

const supabaseClient =
  window.supabaseClient ||
  (window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null);

const STITCH_META = {
  КА: {
    fullName: 'Кільце амігурумі або магічне кільце',
    category: 'Базові стібки',
    level: 'ВАЖЛИВО',
    badgeClass: 'text-amber-800 bg-amber-100 border-amber-300',
    description:
      'Базові петлі, правильний захват гачка, магічне кільце та перші стовпчики для впевненого старту.',
  },
  MR: {
    fullName: 'Кільце амігурумі (Magic Ring)',
    category: 'Базові стібки',
    level: 'ВАЖЛИВО',
    badgeClass: 'text-amber-800 bg-amber-100 border-amber-300',
    description:
      'Формування щільного кільця без отвору в центрі для іграшок та кругового в’язання.',
  },
  ПВ: {
    fullName: 'Повітряна петля (ПВ)',
    category: 'Базові стібки',
    level: 'ВАЖЛИВО',
    badgeClass: 'text-amber-800 bg-amber-100 border-amber-300',
    description:
      'Детальний розбір правильної техніки протягування нитки та формування ланцюжка повітряних петель.',
  },
  ПП: {
    fullName: 'Повітряна петля (ПП)',
    category: 'Базові стібки',
    level: 'ВАЖЛИВО',
    badgeClass: 'text-amber-800 bg-amber-100 border-amber-300',
    description:
      'Базовий елемент для набору петель та підйому ряду у в’язанні гачком.',
  },
  CH: {
    fullName: 'Повітряна петля (CH)',
    category: 'Базові стібки',
    level: 'ВАЖЛИВО',
    badgeClass: 'text-amber-800 bg-amber-100 border-amber-300',
    description:
      'Повітряна петля за міжнародним позначенням CH — основа більшості схем.',
  },
  СБН: {
    fullName: 'Стовпчик без накиду (СбН)',
    category: 'Базові стібки',
    level: 'СЕРЕДНІЙ',
    badgeClass: 'text-blue-800 bg-blue-100 border-blue-300',
    description:
      'Як правильно протягнути нитку та сформувати рівний, щільний стовпчик без накиду.',
  },
  SC: {
    fullName: 'Стовпчик без накиду (SC)',
    category: 'Базові стібки',
    level: 'СЕРЕДНІЙ',
    badgeClass: 'text-blue-800 bg-blue-100 border-blue-300',
    description:
      'Single Crochet — один із найпопулярніших стібків в амігурумі та аксесуарах.',
  },
  СЗН: {
    fullName: 'Стовпчик з 1 накидом (СзН)',
    category: 'Базові стібки',
    level: 'СКЛАДНИЙ',
    badgeClass: 'text-purple-800 bg-purple-100 border-purple-300',
    description:
      'Як виконати накид, протягнути нитку та сформувати високий рівний стовпчик для одягу й пледів.',
  },
  ССН: {
    fullName: 'Стовпчик з 1 накидом (СсН)',
    category: 'Базові стібки',
    level: 'СКЛАДНИЙ',
    badgeClass: 'text-purple-800 bg-purple-100 border-purple-300',
    description:
      'Класичний стовпчик з накидом для створення полотна та ажурних візерунків.',
  },
  DC: {
    fullName: 'Стовпчик з накидом (DC)',
    category: 'Базові стібки',
    level: 'СКЛАДНИЙ',
    badgeClass: 'text-purple-800 bg-purple-100 border-purple-300',
    description:
      'Double Crochet — базовий високий стовпчик у схемах із міжнародними позначеннями.',
  },
  НПЗН: {
    fullName: 'Напівстовпчик з накидом (нПСзН)',
    category: 'Базові стібки',
    level: 'СЕРЕДНІЙ',
    badgeClass: 'text-blue-800 bg-blue-100 border-blue-300',
    description:
      'Проміжна висота між стовпчиком без накиду та стовпчиком з накидом із протягуванням через усі петлі.',
  },
  HDC: {
    fullName: 'Напівстовпчик з накидом (HDC)',
    category: 'Базові стібки',
    level: 'СЕРЕДНІЙ',
    badgeClass: 'text-blue-800 bg-blue-100 border-blue-300',
    description:
      'Half Double Crochet — м’який і пластичний стібок для шапок, шарфів та одягу.',
  },
  ПР: {
    fullName: 'Прибавка (Пр)',
    category: 'Техніки та секрети',
    level: 'ЛЕГКИЙ',
    badgeClass: 'text-emerald-700 bg-emerald-100 border-emerald-300',
    description:
      'Як правильно виконати збільшення стібків, щоб уникнути зайвих отворів та викривлень.',
  },
  INC: {
    fullName: 'Прибавка (INC)',
    category: 'Техніки та секрети',
    level: 'ЛЕГКИЙ',
    badgeClass: 'text-emerald-700 bg-emerald-100 border-emerald-300',
    description:
      'Increase — пров’язування двох стовпчиків в одну петлю основи для розширення деталі.',
  },
  УБ: {
    fullName: 'Убавка (Уб)',
    category: 'Техніки та секрети',
    level: 'ЛЕГКИЙ',
    badgeClass: 'text-emerald-700 bg-emerald-100 border-emerald-300',
    description:
      'Як акуратно зменшити кількість петель без нерівностей та помітних дірок у полотні.',
  },
  DEC: {
    fullName: 'Убавка (DEC)',
    category: 'Техніки та секрети',
    level: 'ЛЕГКИЙ',
    badgeClass: 'text-emerald-700 bg-emerald-100 border-emerald-300',
    description:
      'Decrease — плавне звуження деталей в амігурумі та виробах.',
  },
  ЗС: {
    fullName: 'З’єднувальний стовпчик (ЗС)',
    category: 'Збирання виробу',
    level: 'ЛЕГКИЙ',
    badgeClass: 'text-emerald-700 bg-emerald-100 border-emerald-300',
    description:
      'Акуратне замикання ряду в коло та плавне з’єднання елементів.',
  },
  SLST: {
    fullName: 'З’єднувальний стовпчик (SLST)',
    category: 'Збирання виробу',
    level: 'ЛЕГКИЙ',
    badgeClass: 'text-emerald-700 bg-emerald-100 border-emerald-300',
    description:
      'Slip Stitch — непомітний з’єднувальний стовпчик для завершення рядів і переміщення по полотну.',
  },
};

function extractYouTubeId(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{6,})/,
  ];
  for (const regex of patterns) {
    const match = trimmed.match(regex);
    if (match && match[1]) return match[1];
  }
  return null;
}

function normalizeVideoUrls(rawUrl) {
  const cleanUrl = String(rawUrl || '').trim();
  const ytId = extractYouTubeId(cleanUrl);
  if (ytId) {
    return {
      embedUrl: `https://www.youtube.com/embed/${ytId}`,
      watchUrl: `https://youtu.be/${ytId}`,
      isYouTube: true,
    };
  }
  return {
    embedUrl: cleanUrl,
    watchUrl: cleanUrl,
    isYouTube: false,
  };
}

function mapStitchToLesson(stitch) {
  const code = String(stitch.name_stitch || '').trim();
  const upperCode = code.toUpperCase();
  const meta = STITCH_META[upperCode] || STITCH_META[code] || {
    fullName: `Відеоурок: ${code}`,
    category: 'Базові стібки',
    level: 'БАЗОВИЙ',
    badgeClass: 'text-amber-800 bg-amber-100 border-amber-300',
    description: `Практичний відеоурок зі стібка «${code}» з бази даних майстерні «Генерал Гачок».`,
  };

  const { embedUrl, watchUrl, isYouTube } = normalizeVideoUrls(stitch.video_url);
  const langSuffix = stitch.video_language ? ` • Мова: ${stitch.video_language}` : '';

  return {
    id: stitch.id_stitch,
    code,
    title: meta.fullName,
    category: meta.category,
    level: meta.level,
    badgeClass: meta.badgeClass,
    description: `${meta.description}${langSuffix}`,
    embedUrl,
    watchUrl,
    isYouTube,
  };
}
let lessonsTypewriterTimer = null;

function startLessonsSearchTypewriter(lessons = []) {
  const input = document.getElementById('lessons-search');
  if (!input) return;

  if (lessonsTypewriterTimer) {
    clearTimeout(lessonsTypewriterTimer);
    lessonsTypewriterTimer = null;
  }

  const basePrefix = 'Пошук стібка чи уроку: ';
  const stitchPhrases = [
    ...new Set(
      (lessons || [])
        .map((l) => {
          const code = String(l.code || '').trim();
          const title = String(l.title || '').replace(/^Відеоурок:\s*/i, '').trim();
          return code && title && !title.includes(code) ? `${code} — ${title}` : code || title;
        })
        .filter(Boolean)
    ),
  ];

  const phrases = stitchPhrases.length > 0 ? stitchPhrases : ['КА', 'СБН', 'ПР', 'УБ', 'ПВ'];

  let phraseIndex = 0;
  let charIndex = 0;
  let isDeleting = false;

  function tick() {
    const isFocused = document.activeElement === input;
    const hasValue = input.value.trim().length > 0;

    if (isFocused || hasValue) {
      input.placeholder = 'Пошук відеоуроку за назвою, стібком або технікою...';
      lessonsTypewriterTimer = setTimeout(tick, 300);
      return;
    }

    const currentPhrase = phrases[phraseIndex];

    if (!isDeleting) {
      charIndex++;
      input.placeholder = `${basePrefix}${currentPhrase.slice(0, charIndex)}|`;

      if (charIndex >= currentPhrase.length) {
        isDeleting = true;
        lessonsTypewriterTimer = setTimeout(tick, 1400);
        return;
      }
      lessonsTypewriterTimer = setTimeout(tick, 75);
    } else {
      charIndex--;
      input.placeholder = `${basePrefix}${currentPhrase.slice(0, Math.max(0, charIndex))}|`;

      if (charIndex <= 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        lessonsTypewriterTimer = setTimeout(tick, 350);
        return;
      }
      lessonsTypewriterTimer = setTimeout(tick, 40);
    }
  }

  input.addEventListener('focus', () => {
    input.placeholder = 'Пошук відеоуроку за назвою, стібком або технікою...';
  });

  tick();
}
function renderLessonCard(lesson) {
  const actionButtonHtml = lesson.isYouTube
    ? `
      <a href="${lesson.watchUrl}" target="_blank" rel="noopener noreferrer" class="w-full py-3 bg-hachok-dark text-hachok-gold font-heading font-bold text-sm border border-hachok-gold hover:bg-hachok-dark-hover transition-colors flex items-center justify-center gap-2 uppercase tracking-wider shadow-sm">
        <i class="fab fa-youtube text-red-500" aria-hidden="true"></i> Відкрити на YouTube
      </a>
    `
    : `
      <a href="${lesson.watchUrl}" target="_blank" rel="noopener noreferrer" class="w-full py-3 bg-hachok-dark text-hachok-gold font-heading font-bold text-sm border border-hachok-gold hover:bg-hachok-dark-hover transition-colors flex items-center justify-center gap-2 uppercase tracking-wider shadow-sm">
        <i class="fas fa-play-circle text-hachok-gold" aria-hidden="true"></i> Відкрити відео
      </a>
    `;

  return `
    <article class="bg-white border-2 border-hachok-dark flex flex-col justify-between shadow-md hover:border-hachok-gold transition-all duration-300 group">
      <div>
        <div class="relative w-full aspect-video bg-hachok-dark overflow-hidden border-b border-hachok-dark/30">
          <iframe
            class="w-full h-full"
            src="${lesson.embedUrl}"
            title="${lesson.title}"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen>
          </iframe>
        </div>

        <div class="p-5 space-y-3">
          <div class="flex items-center justify-between gap-2 text-xs font-bold text-hachok-muted uppercase tracking-wider">
            <span>${lesson.category} (${lesson.code})</span>
            <span class="${lesson.badgeClass} px-2 py-0.5 border">${lesson.level}</span>
          </div>
          <h3 class="font-heading font-bold text-2xl text-hachok-dark group-hover:text-hachok-gold-hover transition-colors">
            ${lesson.title}
          </h3>
          <p class="font-serifText text-sm text-hachok-muted leading-relaxed">
            ${lesson.description}
          </p>
        </div>
      </div>

      <div class="p-5 pt-0">
        ${actionButtonHtml}
      </div>
    </article>
  `;
}

async function initStitchLessonsPage() {
  const gridEl = document.getElementById('lessons-grid');
  const searchInput = document.getElementById('lessons-search');
  const categoryButtons = Array.from(document.querySelectorAll('[data-category-filter]'));
  const loadMoreBtn = document.getElementById('load-more-lessons-btn');

  if (!gridEl) return;

  if (!supabaseClient) {
    gridEl.innerHTML = `
      <div class="col-span-full bg-parchment-card border-2 border-hachok-dark p-8 text-center space-y-2">
        <p class="font-heading font-bold text-xl text-hachok-dark">Не вдалося ініціалізувати клієнт бази даних</p>
        <p class="font-serifText text-sm text-hachok-muted">Перевірте підключення бібліотеки Supabase та ключ доступу.</p>
      </div>
    `;
    return;
  }

  let allLessons = [];
  let activeCategory = 'Усі уроки';
  let searchQuery = '';
  let visibleLimit = 6;

  function getFilteredLessons() {
    return allLessons.filter((lesson) => {
      const matchesCategory =
        activeCategory === 'Усі уроки' || lesson.category === activeCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        lesson.title.toLowerCase().includes(q) ||
        lesson.code.toLowerCase().includes(q) ||
        lesson.description.toLowerCase().includes(q) ||
        lesson.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }

  function updateGrid() {
    const filtered = getFilteredLessons();

    if (filtered.length === 0) {
      gridEl.innerHTML = `
        <div class="col-span-full bg-parchment-card border-2 border-hachok-dark p-8 text-center space-y-2">
          <p class="font-heading font-bold text-xl text-hachok-dark">Відеоуроків зі стібків не знайдено</p>
          <p class="font-serifText text-sm text-hachok-muted">У базі даних немає відеоуроків, які відповідають обраному фільтру або запиту.</p>
        </div>
      `;
      loadMoreBtn?.classList.add('hidden');
      return;
    }

    const sliceToShow = filtered.slice(0, visibleLimit);
    gridEl.innerHTML = sliceToShow.map(renderLessonCard).join('');

    if (loadMoreBtn) {
      if (filtered.length > visibleLimit) {
        loadMoreBtn.classList.remove('hidden');
      } else {
        loadMoreBtn.classList.add('hidden');
      }
    }
  }

  function setActiveCategoryButton(selectedBtn) {
    categoryButtons.forEach((btn) => {
      const isSelected = btn === selectedBtn;
      btn.className = isSelected
        ? 'px-4 py-2 bg-hachok-dark text-hachok-gold font-bold text-xs sm:text-sm uppercase tracking-wider border border-hachok-gold shadow-sm'
        : 'px-4 py-2 bg-white text-hachok-dark font-medium text-xs sm:text-sm uppercase tracking-wider border border-hachok-dark hover:bg-parchment-bg transition-colors';
    });
  }

  categoryButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.categoryFilter || 'Усі уроки';
      visibleLimit = 6;
      setActiveCategoryButton(btn);
      updateGrid();
    });
  });

  searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value || '';
    visibleLimit = 6;
    updateGrid();
  });

  loadMoreBtn?.addEventListener('click', () => {
    visibleLimit += 6;
    updateGrid();
  });

  // Завантажуємо стібки з таблиці stitch у Supabase
  const { data: stitches, error } = await supabaseClient
    .from('stitch')
    .select('id_stitch, name_stitch, video_url, video_language')
    .order('id_stitch', { ascending: true });

  if (error) {
    console.error('[Lessons DB Error]:', error);
    gridEl.innerHTML = `
      <div class="col-span-full bg-parchment-card border-2 border-hachok-dark p-8 text-center space-y-2">
        <p class="font-heading font-bold text-xl text-hachok-dark">Помилка завантаження відеоуроків з бази даних</p>
        <p class="font-serifText text-sm text-hachok-muted">Спробуйте оновити сторінку трохи пізніше.</p>
      </div>
    `;
    loadMoreBtn?.classList.add('hidden');
    return;
  }

  // Лишаємо лише ті стібки з БД, які мають заповнене посилання на відео
  const stitchesWithVideo = (stitches || []).filter(
    (s) => typeof s.video_url === 'string' && s.video_url.trim().length > 0
  );

  allLessons = stitchesWithVideo.map(mapStitchToLesson);
  startLessonsSearchTypewriter(allLessons);
  updateGrid();
}

document.addEventListener('DOMContentLoaded', initStitchLessonsPage);