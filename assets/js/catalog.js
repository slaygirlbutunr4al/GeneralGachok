const SUPABASE_URL = 'https://aviukajqbzmgbtwjijmk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lkqx0Wf0GyBdsd4u69Sryg_BELv1YHM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DIFFICULTY_MAP = {
  1: { label: 'НОВАЧОК', slug: 'beginner' },
  2: { label: 'СЕРЕДНІЙ', slug: 'medium' },
  3: { label: 'ПРОФІ', slug: 'pro' },
};

const CATEGORY_MAP = {
  1: { label: 'ІГРАШКИ', slug: 'toys' },
  2: { label: 'ОДЯГ', slug: 'clothing' },
  3: { label: 'АКСЕСУАРИ', slug: 'accessories' },
  4: { label: "ІНТЕР'ЄР", slug: 'decor' },
  5: { label: 'МЕРЕЖИВО', slug: 'lace' },
};

let allPatterns = [];

function renderPatterns(list) {
  const grid = document.getElementById('catalogGrid');
  const countEl = document.querySelector('#main-content strong.font-bold');
  if (!grid) return;

  if (countEl) {
    countEl.textContent = list.length;
  }

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full border-2 border-dashed border-hachok-gold bg-parchment-bg/50 p-8 flex flex-col justify-center items-center text-center min-h-[320px]">
        <div class="w-14 h-14 bg-parchment-card rounded-full flex items-center justify-center text-hachok-muted text-xl mb-4">
          <i class="fas fa-search" aria-hidden="true"></i>
        </div>
        <h2 class="font-heading font-bold text-2xl text-hachok-dark mb-2">Нічого не знайдено</h2>
        <p class="text-sm text-hachok-muted mb-4 max-w-xs">Спробуйте скинути фільтри або змінити пошуковий запит</p>
        <button type="button" onclick="resetCatalogFilters()" class="text-hachok-dark underline hover:text-hachok-gold font-medium text-sm transition-colors">
          Скинути пошук
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = list
    .map((item) => {
      const category = CATEGORY_MAP[item.product_category] || { label: 'СХЕМА' };
      const difficulty = DIFFICULTY_MAP[item.difficulty] || { label: 'СЕРЕДНІЙ' };
      const authorText = item.author ? `Автор: ${item.author}` : 'Майстерня «Генерал Гачок»';

      const mediaHtml = item.image_url
        ? `<img src="${item.image_url}" alt="${item.name_pattern}" width="400" height="300" loading="lazy" decoding="async" class="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-300">`
        : `<div class="w-full h-full bg-parchment-card flex flex-col items-center justify-center text-hachok-muted gap-2">
             <i class="fas fa-scroll text-3xl text-hachok-dark/60" aria-hidden="true"></i>
             <span class="text-xs uppercase tracking-wider font-bold">Схема в'язання</span>
           </div>`;

      return `
        <article class="bg-white border-2 border-hachok-dark p-6 sm:p-7 flex flex-col justify-between hover:-translate-y-1.5 hover:border-hachok-gold transition-all duration-300 shadow-md h-full">
          <div>
            <a href="pattern.html?id=${item.id_pattern}" class="block overflow-hidden mb-5 border border-hachok-dark/20 w-full h-56" aria-label="Переглянути схему ${item.name_pattern}">
              ${mediaHtml}
            </a>

            <h2 class="font-heading font-bold text-2xl lg:text-3xl text-hachok-dark mb-3 line-clamp-2 min-h-[3.75rem]">${item.name_pattern}</h2>

            <div class="flex gap-2 flex-wrap mb-4">
              <span class="bg-parchment-bg border border-hachok-gold text-hachok-dark text-xs font-bold px-2.5 py-1 tracking-wider uppercase">${category.label}</span>
              <span class="bg-parchment-bg border border-hachok-gold text-hachok-dark text-xs font-bold px-2.5 py-1 tracking-wider uppercase">${difficulty.label}</span>
            </div>

            <p class="text-sm text-hachok-muted flex items-center gap-2 mb-6">
              <i class="fas fa-user-pen" aria-hidden="true"></i> ${authorText}
            </p>
          </div>

          <a href="pattern.html?id=${item.id_pattern}" class="block w-full py-3.5 bg-hachok-gold text-hachok-dark font-heading font-bold text-center border border-hachok-gold hover:bg-hachok-gold-hover transition-all shadow-sm uppercase tracking-wider text-sm">
            Переглянути схему
          </a>
        </article>
      `;
    })
    .join('');
}

function applyCatalogFilters() {
  const searchInput = document.querySelector('input[type="search"]');
  const diffSelect = document.getElementById('filter-difficulty');
  const catSelect = document.getElementById('filter-category');

  const query = (searchInput?.value || '').trim().toLowerCase();
  const diffValue = diffSelect?.value || '';
  const catValue = catSelect?.value || '';

  const filtered = allPatterns.filter((item) => {
    const matchesName = item.name_pattern.toLowerCase().includes(query);
    const diffSlug = DIFFICULTY_MAP[item.difficulty]?.slug || '';
    const catSlug = CATEGORY_MAP[item.product_category]?.slug || '';

    const matchesDiff = !diffValue || diffSlug === diffValue;
    const matchesCat = !catValue || catSlug === catValue;

    return matchesName && matchesDiff && matchesCat;
  });

  renderPatterns(filtered);
}

function resetCatalogFilters() {
  const searchInput = document.querySelector('input[type="search"]');
  const diffSelect = document.getElementById('filter-difficulty');
  const catSelect = document.getElementById('filter-category');

  if (searchInput) searchInput.value = '';
  if (diffSelect) diffSelect.value = '';
  if (catSelect) catSelect.value = '';

  renderPatterns(allPatterns);
}

async function initCatalog() {
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;

  const { data, error } = await supabaseClient
    .from('pattern')
    .select('*')
    .order('id_pattern', { ascending: false });

  if (error) {
    console.error('Помилка Supabase:', error);
    return;
  }

  allPatterns = data || [];
  renderPatterns(allPatterns);

  // Підключення живого пошуку та селектів фільтрації
  document.querySelector('input[type="search"]')?.addEventListener('input', applyCatalogFilters);
  document.getElementById('filter-difficulty')?.addEventListener('change', applyCatalogFilters);
  document.getElementById('filter-category')?.addEventListener('change', applyCatalogFilters);

  const resetBtn = Array.from(document.querySelectorAll('button')).find(
    (btn) => btn.textContent.trim() === 'Скинути фільтри'
  );
  resetBtn?.addEventListener('click', resetCatalogFilters);
}

document.addEventListener('DOMContentLoaded', initCatalog);