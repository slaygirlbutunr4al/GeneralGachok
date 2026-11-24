const SUPABASE_URL = 'https://aviukajqbzmgbtwjijmk.supabase.co';
const SUPABASE_ANON_KEY = 'ВСТАВТЕ_СЮДИ_ВАШ_ANON_KEY';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CATEGORY_LABELS = {
  1: 'ІГРАШКИ',
  2: 'ОДЯГ',
  3: 'АКСЕСУАРИ',
  4: "ІНТЕР'ЄР",
  5: 'МЕРЕЖИВО',
};

const THICKNESS_LABELS = {
  1: 'Тонка (Lace / Fingering)',
  2: 'Легка (Sport / Baby)',
  3: 'Середня (DK / Worsted)',
  4: 'Товста (Bulky)',
  5: 'Плюшева (Super Bulky)',
};

const WIZARD_STEP_NAMES = {
  menu: 'Головне меню вимірювача',
  'mouse-check': '1. Перевірка підключення мишки',
  yarn: '2. Калібрування пряжі',
  stitch: '3. Калібрування стібка (10×2)',
  project: '4. Розрахунок пряжі та створення проєкту',
  tracking: '5. Відслідковування фактичної довжини',
};

const MONTHS_UA_GENITIVE = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
];

let currentUser = null;
let userYarns = [];
let userProjects = [];

// ==========================================
// ГЛОБАЛЬНИЙ ВИКЛИК СТІКІ-ВІДЖЕТА МАЙСТРА
// ==========================================
window.openMeasurerWidget = function openMeasurerWidget(options = { step: 'menu' }) {
  // Надсилаємо подію для майбутнього стікі-віджета (який слухатиме її на будь-якій сторінці)
  window.dispatchEvent(new CustomEvent('hachok:open-measurer', { detail: options }));

  // Якщо сам віджет уже підключений — відкриваємо його напряму
  if (window.HachokMeasurerWidget && typeof window.HachokMeasurerWidget.open === 'function') {
    window.HachokMeasurerWidget.open(options);
    return;
  }

  // Тимчасова підказка, поки інтерактивний віджет у розробці
  const toast = document.getElementById('measurer-toast');
  const toastText = document.getElementById('measurer-toast-text');
  if (!toast || !toastText) return;

  const stepLabel = WIZARD_STEP_NAMES[options.step] || WIZARD_STEP_NAMES.menu;
  toastText.textContent = `Обрано режим: «${stepLabel}». Інтерактивний стікі-віджет буде підключено в наступній лабораторній.`;
  toast.classList.remove('hidden');
};

// Перевірка авторизації
function getLoggedInUser() {
  const raw = localStorage.getItem('hachok_user') || sessionStorage.getItem('hachok_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function formatRegistrationDate(dateStr) {
  if (!dateStr) return 'У спільноті «Генерал Гачок»';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return `У спільноті з ${dateStr}`;
  const month = MONTHS_UA_GENITIVE[date.getMonth()];
  const year = date.getFullYear();
  return `У спільноті з ${month} ${year}`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('uk-UA');
}

// ==========================================
// 1. ПРОФІЛЬ КОРИСТУВАЧА
// ==========================================
async function loadUserProfile(userId) {
  const { data, error } = await supabaseClient
    .from('user_')
    .select('id_user, nickname, email, reg_date')
    .eq('id_user', userId)
    .single();

  if (error || !data) {
    console.error('Помилка завантаження профілю:', error);
    return;
  }

  document.getElementById('profile-nickname').textContent = data.nickname || data.email;
  document.querySelector('#profile-reg-date span').textContent = formatRegistrationDate(data.reg_date);
}

// ==========================================
// 2. ЗАПАСИ ПРЯЖІ + ПІДРАХУНОК СУМИ МЕТРІВ
// ==========================================
async function loadUserYarn(userId) {
  const { data, error } = await supabaseClient
    .from('yarn')
    .select('*')
    .eq('id_user', userId)
    .order('id_yarn', { ascending: false });

  if (error) {
    console.error('Помилка завантаження пряжі:', error);
    return;
  }

  userYarns = data || [];

  // Підрахунок загальної кількості метрів у запасі (мотки * довжина мотка)
  const totalMeters = userYarns.reduce(
    (sum, item) => sum + (Number(item.skein_count) || 0) * (Number(item.skein_length) || 0),
    0
  );

  document.getElementById('stat-total-yarn').textContent = `${totalMeters.toLocaleString('uk-UA')} м`;
  renderYarnList();
}

function renderYarnList() {
  const container = document.getElementById('yarn-stash-list');
  if (!container) return;

  if (userYarns.length === 0) {
    container.innerHTML = `
      <div class="bg-white border border-dashed border-hachok-dark/40 p-6 text-center space-y-2">
        <p class="text-sm text-hachok-muted">У ваших запасах поки немає пряжі.</p>
        <button type="button" onclick="openMeasurerWidget({ step: 'yarn' })" class="text-xs font-bold text-hachok-dark underline hover:text-hachok-gold uppercase">
          + Відкалібрувати першу пряжу
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = userYarns
    .map((y) => {
      const totalM = (Number(y.skein_count) || 0) * (Number(y.skein_length) || 0);
      const thickness = THICKNESS_LABELS[y.thickness_category] || `Категорія ${y.thickness_category}`;

      return `
        <div class="bg-white border border-hachok-dark p-4 flex items-center justify-between gap-4 shadow-sm">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 bg-parchment-bg border border-hachok-dark/40 flex items-center justify-center text-hachok-dark flex-shrink-0">
              <i class="fas fa-boxes-stacked text-sm" aria-hidden="true"></i>
            </div>
            <div>
              <h4 class="font-heading font-bold text-lg text-hachok-dark">${y.name_yarn}</h4>
              <p class="text-xs text-hachok-muted">${thickness} • ${y.skein_count} мот. × ${y.skein_length}м = <strong>${totalM}м</strong></p>
            </div>
          </div>
          <button type="button" onclick="deleteUserYarn(${y.id_yarn}, '${y.name_yarn.replace(/'/g, "\\'")}')" class="text-hachok-muted hover:text-red-700 p-1.5 transition-colors" aria-label="Видалити ${y.name_yarn}" title="Видалити із запасів">
            <i class="fas fa-trash-alt text-xs" aria-hidden="true"></i>
          </button>
        </div>
      `;
    })
    .join('');
}

async function deleteUserYarn(yarnId, yarnName) {
  const confirmed = window.confirm(`Видалити пряжу «${yarnName}» із ваших запасів?`);
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from('yarn')
    .delete()
    .eq('id_yarn', yarnId);

  if (error) {
    console.error('Помилка видалення пряжі:', error);
    return;
  }

  await refreshAllProfileData();
}

// ==========================================
// 3. ПРОЄКТИ КОРИСТУВАЧА
// ==========================================
async function loadUserProjects(userId) {
  const { data, error } = await supabaseClient
    .from('project')
    .select(`
      id_project,
      current_section_number,
      current_row,
      forecast_length,
      actual_length,
      project_status,
      yarn!inner ( id_yarn, name_yarn, skein_count, skein_length, id_user ),
      pattern (
        id_pattern,
        name_pattern,
        product_category,
        image_url,
        section ( row_count_ )
      )
    `)
    .eq('yarn.id_user', userId)
    .order('id_project', { ascending: false });

  if (error) {
    console.error('Помилка завантаження проєктів:', error);
    return;
  }

  userProjects = data || [];
  renderProjects();
}

function buildProjectCard(proj) {
  const pat = proj.pattern || {};
  const yarn = proj.yarn || {};
  const categoryLabel = CATEGORY_LABELS[pat.product_category] || 'СХЕМА';

  const sections = pat.section || [];
  const totalRows = sections.reduce((sum, s) => sum + (Number(s.row_count_) || 0), 0) || 1;
  const currentRow = Number(proj.current_row) || 0;
  const percent = proj.project_status === 3
    ? 100
    : Math.min(100, Math.round((currentRow / totalRows) * 100));

  const yarnTotalM = (Number(yarn.skein_count) || 0) * (Number(yarn.skein_length) || 0);
  const usedM = Number(proj.actual_length) || 0;
  const leftM = Math.max(0, Math.round(yarnTotalM - usedM));

  const imgHtml = pat.image_url
    ? `<img src="${pat.image_url}" alt="Прев'ю проєкту ${pat.name_pattern}" class="w-full h-full object-cover">`
    : `<div class="w-full h-full bg-parchment-card flex items-center justify-center text-hachok-dark/50">
         <i class="fas fa-scroll text-3xl" aria-hidden="true"></i>
       </div>`;

  return `
    <article class="bg-white border-2 border-hachok-dark p-5 sm:p-6 flex flex-col sm:flex-row gap-5 shadow-md hover:border-hachok-gold transition-all duration-300">
      <div class="w-full sm:w-44 h-48 sm:h-auto border border-hachok-dark/20 overflow-hidden flex-shrink-0">
        ${imgHtml}
      </div>

      <div class="flex flex-col justify-between flex-grow space-y-4">
        <div>
          <span class="text-xs font-bold text-hachok-muted tracking-wider uppercase block mb-1">${categoryLabel}</span>
          <h3 class="font-heading font-bold text-2xl text-hachok-dark">${pat.name_pattern || 'Проєкт'}</h3>
        </div>

        <div class="space-y-1.5">
          <div class="flex justify-between text-xs text-hachok-dark font-medium">
            <span>Рядок ${currentRow} з ${totalRows}</span>
            <span>${percent}%</span>
          </div>
          <div class="w-full h-3 bg-parchment-card border border-hachok-dark/30 rounded-full overflow-hidden">
            <div class="h-full bg-hachok-dark" style="width: ${percent}%;"></div>
          </div>
        </div>

        <ul class="text-xs text-hachok-muted space-y-1">
          <li class="flex items-center gap-2"><i class="fas fa-layer-group" aria-hidden="true"></i> Секція №${proj.current_section_number || 1}</li>
          <li class="flex items-center gap-2"><i class="fas fa-fill-drip" aria-hidden="true"></i> Пряжа: ${yarn.name_yarn || 'Не вказано'} (залишок ~${leftM}м)</li>
        </ul>

        <div class="flex items-center gap-3 pt-2">
          <button type="button" onclick="openMeasurerWidget({ step: 'tracking', projectId: ${proj.id_project} })" class="flex-grow py-2.5 px-4 bg-hachok-gold text-hachok-dark font-heading font-bold text-center text-xs sm:text-sm uppercase tracking-wider border border-hachok-gold hover:bg-hachok-gold-hover transition-colors shadow-sm">
            Продовжити в'язати
          </button>
          <a href="pattern.html?id=${pat.id_pattern || ''}" class="py-2.5 px-4 bg-white text-hachok-dark font-heading font-bold text-center text-xs sm:text-sm uppercase tracking-wider border border-hachok-dark hover:bg-parchment-bg transition-colors">
            Деталі
          </a>
        </div>
      </div>
    </article>
  `;
}

function renderProjects() {
  const searchQuery = (document.getElementById('project-search')?.value || '').trim().toLowerCase();
  const catFilter = document.getElementById('project-category-filter')?.value || 'all';

  const activeAll = userProjects.filter((p) => p.project_status !== 3);
  const completedAll = userProjects.filter((p) => p.project_status === 3);

  document.getElementById('stat-active-projects').textContent = activeAll.length;
  document.getElementById('completed-projects-count').textContent = completedAll.length;

  const filteredActive = activeAll.filter((p) => {
    const name = (p.pattern?.name_pattern || '').toLowerCase();
    const cat = String(p.pattern?.product_category || '');
    const matchesSearch = name.includes(searchQuery);
    const matchesCat = catFilter === 'all' || cat === catFilter;
    return matchesSearch && matchesCat;
  });

  const activeGrid = document.getElementById('active-projects-grid');
  if (filteredActive.length === 0) {
    activeGrid.innerHTML = `
      <div class="col-span-full bg-white border border-dashed border-hachok-dark/40 p-8 text-center space-y-2">
        <p class="font-heading font-bold text-xl text-hachok-dark">Активних проєктів поки немає</p>
        <p class="text-xs text-hachok-muted">Відкрийте майстер «Нитковимірювач», щоб відкалібрувати пряжу та створити проєкт.</p>
      </div>
    `;
  } else {
    activeGrid.innerHTML = filteredActive.map(buildProjectCard).join('');
  }

  const completedGrid = document.getElementById('completed-projects-grid');
  completedGrid.innerHTML = completedAll.length
    ? completedAll.map(buildProjectCard).join('')
    : '<p class="text-xs text-hachok-muted col-span-full">Завершених проєктів ще немає.</p>';
}

// ==========================================
// 4. КАЛІБРУВАННЯ КОРИСТУВАЧА
// ==========================================
async function loadUserCalibrations(userId) {
  const { data, error } = await supabaseClient
    .from('calibration')
    .select(`
      id_calibration,
      hook_size,
      pixel_per_sm,
      sm_per_stitch,
      last_check_date,
      yarn!inner ( name_yarn, id_user ),
      stitch ( name_stitch )
    `)
    .eq('yarn.id_user', userId)
    .order('last_check_date', { ascending: false });

  if (error) {
    console.error('Помилка завантаження калібрувань:', error);
    return;
  }

  const list = data || [];
  document.getElementById('stat-calibrations').textContent = list.length;

  const tbody = document.getElementById('calibrations-table-body');
  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="py-6 px-3 text-center text-xs text-hachok-muted">
          Збережених калібрувань поки немає. Виконайте замір у майстрі «Нитковимірювач».
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list
    .map((c) => `
      <tr class="hover:bg-parchment-bg/40 transition-colors">
        <td class="py-3 px-3 font-bold">${c.yarn?.name_yarn || '—'}</td>
        <td class="py-3 px-3">${c.hook_size} mm</td>
        <td class="py-3 px-3">${c.stitch?.name_stitch || '—'}</td>
        <td class="py-3 px-3 text-hachok-muted text-xs">${formatShortDate(c.last_check_date)}</td>
      </tr>
    `)
    .join('');
}

// Оновлення всіх даних кабінету (викликається при завантаженні та після збереження з віджета)
async function refreshAllProfileData() {
  if (!currentUser || !currentUser.id_user) return;
  await Promise.all([
    loadUserProfile(currentUser.id_user),
    loadUserYarn(currentUser.id_user),
    loadUserProjects(currentUser.id_user),
    loadUserCalibrations(currentUser.id_user),
  ]);
}

// ==========================================
// ІНІЦІАЛІЗАЦІЯ СТОРІНКИ
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = getLoggedInUser();

  if (!currentUser || !currentUser.id_user) {
    window.location.href = 'auth.html';
    return;
  }

  await refreshAllProfileData();

  // Автоматичне оновлення списків, коли стікі-віджет збереже нову пряжу, калібрування чи проєкт
  window.addEventListener('hachok:data-updated', refreshAllProfileData);

  // Вихід з акаунту
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('hachok_user');
    sessionStorage.removeItem('hachok_user');
    window.location.href = 'auth.html';
  });

  // Перемикання підсвітки вкладок
  document.querySelectorAll('.profile-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.profile-tab').forEach((t) => {
        t.classList.remove('text-hachok-dark', 'border-hachok-dark');
        t.classList.add('text-hachok-muted', 'border-transparent');
      });
      tab.classList.remove('text-hachok-muted', 'border-transparent');
      tab.classList.add('text-hachok-dark', 'border-hachok-dark');
    });
  });

  // Пошук і фільтрація проєктів
  document.getElementById('project-search')?.addEventListener('input', renderProjects);
  document.getElementById('project-category-filter')?.addEventListener('change', renderProjects);

  // Розгортання завершених проєктів
  document.getElementById('toggle-completed-btn')?.addEventListener('click', () => {
    const grid = document.getElementById('completed-projects-grid');
    const chevron = document.getElementById('completed-chevron');
    const isHidden = grid.classList.contains('hidden');
    if (isHidden) {
      grid.classList.remove('hidden');
      grid.classList.add('grid');
      chevron.classList.add('rotate-90');
    } else {
      grid.classList.add('hidden');
      grid.classList.remove('grid');
      chevron.classList.remove('rotate-90');
    }
  });
});