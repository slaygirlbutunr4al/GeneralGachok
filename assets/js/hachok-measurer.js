/**
 * Стікі-віджет майстра «Нитковимірювач» (ЛР №11)
 * Проєкт: «Генерал Гачок»
 * Версія з реальним трекінгом руху мишки (X+ вправо, X- вліво).
 */
(function () {
  const SUPABASE_URL = 'https://aviukajqbzmgbtwjijmk.supabase.co';
  const SUPABASE_ANON_KEY =
    window.HACHOK_SUPABASE_ANON_KEY ||
    'sb_publishable_lkqx0Wf0GyBdsd4u69Sryg_BELv1YHM';

  const db =
    window.supabaseClient ||
    (window.supabase
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null);

  const STEPS = ['splash', 'menu', 'yarn', 'stitch', 'calc', 'actual'];
  const TRACK_STEPS = ['yarn', 'stitch', 'actual'];

  const LIMITS = {
    maxCm: 500000,
    maxSkeinLength: 5000,
    maxSkeinCount: 200,
    defaultStitchCount: 20,
  };

  const state = {
    isOpen: false,
    step: 'splash',
    patternId: null,
    patternName: 'Обрана схема',
    mouseConnected: false,
    // --- Сенсор (реальна мишка) ---
    tracking: false, // іде запис руху
    locked: false, // активний Pointer Lock
    defaultPxPerCm: 96 / 2.54, // стартовий коефіцієнт (пікселів на 1 см), доки пряжу не відкалібровано
    calibrations: {}, // { 'назва пряжі': px/см } — свій коефіцієнт для кожної пряжі
    activeYarnKey: '', // пряжа, чий коефіцієнт зараз використовується
    unadjusted: null, // true — сирий рух без прискорення ОС; false — прискорення активне
    calibrationCm: 100, // довжина еталонного відрізка
    measuredPx: 0, // накопичений рух у пікселях (X+ додає, X- віднімає)
    lastDeltaX: 0, // останній зсув по X (пікселі)
    totalDx: 0, // чиста сума X (пікселі), зі знаком
    usedMeters: 200,
    yarnName: '',
    skeinMeters: 100,
    skeinCount: 1,
    selectedStitchId: '',
    selectedYarnId: '',
    stitchSampleCount: LIMITS.defaultStitchCount,
    calcYarnId: '',
    calculatedMeters: 200,
    calculatedSkeins: 1,
    calcStatusText: 'Вам вистачає!',
    stitches: [],
    yarns: [],
    statusMessage: '',
    statusType: 'info',
  };

  function safeNum(val, fallback = 0, min = -Infinity, max = Infinity) {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  const MIN_CALIB_PX = 20;
  const CALIB_STORAGE_KEY = 'hachok_px_per_cm_v1';

  function yarnKey(name) {
    return String(name || '').trim().toLowerCase();
  }

  function loadCalibrations() {
    try {
      const raw = localStorage.getItem(CALIB_STORAGE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      if (obj && typeof obj === 'object') state.calibrations = obj;
    } catch (_) {}
  }

  function setYarnCalibration(name, pxPerCm) {
    const v = safeNum(pxPerCm, 0, 0.01, 100000);
    if (!v) return;
    state.calibrations[yarnKey(name)] = v;
    try {
      localStorage.setItem(CALIB_STORAGE_KEY, JSON.stringify(state.calibrations));
    } catch (_) {}
  }

  // Коефіцієнт активної пряжі = (пікселі за 100 см) / 100; якщо немає — стартовий
  function getPxPerCm() {
    const v = state.calibrations[state.activeYarnKey];
    return v > 0 ? v : state.defaultPxPerCm;
  }

  function getMeasuredCm() {
    return safeNum(state.measuredPx / getPxPerCm(), 0, 0, LIMITS.maxCm);
  }

  loadCalibrations();

  function formatMetersCm(totalCm) {
    const cleanCm = safeNum(totalCm, 0, 0, LIMITS.maxCm);
    const meters = Math.floor(cleanCm / 100);
    const cm = Math.floor(cleanCm % 100);
    return `${String(meters).padStart(2, '0')} m / ${String(cm).padStart(2, '0')} cm`;
  }

  function escapeText(str = '') {
    return String(str)
      .replace(/&/g, '&' + 'amp;')
      .replace(/</g, '&' + 'lt;')
      .replace(/>/g, '&' + 'gt;')
      .replace(/"/g, '&' + 'quot;')
      .replace(/'/g, '&' + '#39;');
  }

  function getCurrentUser() {
    try {
      const raw =
        localStorage.getItem('hachok_user') ||
        sessionStorage.getItem('hachok_user');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  // ───────────────────────── ТРЕКІНГ МИШКИ ─────────────────────────

  let rafPending = false;
  function scheduleReadouts() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      updateLiveReadouts();
    });
  }

  // dx у пікселях: >0 вправо (X+), <0 вліво (X-)
  function applySensorDeltaPx(dx) {
    const d = safeNum(dx, 0, -5000, 5000);
    if (d === 0) return;
    state.lastDeltaX = d;
    state.totalDx += d;
    state.measuredPx = safeNum(state.measuredPx + d, 0, 0, 1e8);
    scheduleReadouts();
  }

  // Зсув у сантиметрах (для зовнішнього API simulatePulse); знак зберігається
  function applySensorDeltaCm(deltaCm) {
    const cm = safeNum(deltaCm, 0, -5000, 5000);
    if (cm === 0) return;
    applySensorDeltaPx(cm * getPxPerCm());
  }

  function resetSensorCm() {
    state.measuredPx = 0;
    state.lastDeltaX = 0;
    state.totalDx = 0;
    updateLiveReadouts();
  }

  function onMouseMove(e) {
    state.mouseConnected = true;
    if (!state.tracking) return;
    // movementX — різниця координати X між подіями (працює і під Pointer Lock)
    applySensorDeltaPx(e.movementX || 0);
  }

  function startTracking() {
    state.tracking = true;
    const zone = document.getElementById('hm-track-zone');
    if (zone && zone.requestPointerLock) {
      // Сирий рух мишки без прискорення ОС (Chrome/Edge). Інші браузери ігнорують опцію.
      const fallback = () => {
        state.unadjusted = false;
        try {
          const p2 = zone.requestPointerLock();
          if (p2 && p2.catch) p2.catch(() => {});
        } catch (_) {}
        updateTrackerUi();
      };
      try {
        const p = zone.requestPointerLock({ unadjustedMovement: true });
        state.unadjusted = !!(p && p.then);
        if (p && p.catch) {
          p.catch((err) => {
            if (err && err.name === 'NotSupportedError') fallback();
          });
        }
      } catch (_) {
        fallback();
      }
    }
    updateTrackerUi();
  }

  function stopTracking() {
    state.tracking = false;
    if (document.pointerLockElement) document.exitPointerLock();
    state.locked = false;
    updateTrackerUi();
  }

  function toggleTracking() {
    state.tracking ? stopTracking() : startTracking();
  }

  document.addEventListener('pointerlockchange', () => {
    const zone = document.getElementById('hm-track-zone');
    if (zone && document.pointerLockElement === zone) {
      state.locked = true;
    } else if (state.locked) {
      // вийшли з lock (Esc) — зупиняємо запис
      state.locked = false;
      state.tracking = false;
    }
    updateTrackerUi();
  });

  document.addEventListener('mousemove', onMouseMove, { passive: true });

  function trackerZoneHtml() {
    return `
      <button type="button" id="hm-track-zone" class="hm-track-zone" aria-pressed="false">
        <div id="hm-track-title" class="hm-track-title"></div>
        <div id="hm-track-dx" class="hm-track-dx">X: 0</div>
        <div id="hm-track-hint" class="hm-track-hint"></div>
        <div id="hm-track-coef" class="hm-track-hint" style="font-weight:700"></div>
      </button>
    `;
  }

  function bindTracker() {
    document.getElementById('hm-track-zone')?.addEventListener('click', toggleTracking);
    updateTrackerUi();
  }

  function updateTrackerUi() {
    const zone = document.getElementById('hm-track-zone');
    if (!zone) return;
    zone.classList.toggle('hm-tracking', state.tracking);
    zone.setAttribute('aria-pressed', String(state.tracking));
    const title = document.getElementById('hm-track-title');
    const hint = document.getElementById('hm-track-hint');
    if (title) title.textContent = state.tracking ? '■ ЗАПИС ІДЕ — клік, щоб зупинити' : '▶ КЛІК, ЩОБ ПОЧАТИ ЗАПИС';
    if (hint) {
      hint.textContent = state.tracking
        ? 'Рухайте мишку: → додає (X+), ← віднімає (X−). Esc — вихід.' +
          (state.unadjusted === false ? ' ⚠ Прискорення ОС активне: рухайтесь рівно і в одному темпі.' : '')
        : 'Мишка = датчик нитки. Рух вправо — X+, вліво — X−.';
    }
    updateLiveReadouts();
  }

  // ───────────────────────── UI ХЕЛПЕРИ ─────────────────────────

  function setFeedback(msg, type = 'info') {
    state.statusMessage = msg;
    state.statusType = type;
    const box = document.getElementById('hm-feedback');
    if (!box) return;
    if (!msg) {
      box.classList.add('hidden');
      box.textContent = '';
      return;
    }
    const palette =
      type === 'error'
        ? 'bg-red-50 border-red-700 text-red-900'
        : type === 'success'
        ? 'bg-emerald-50 border-emerald-700 text-emerald-900'
        : 'bg-[#FAF4E8] border-[#343E19] text-[#343E19]';
    box.className = `text-xs font-medium p-2.5 border ${palette} mb-3`;
    box.textContent = msg;
  }

  async function loadReferenceData() {
    if (!db) return;
    const user = getCurrentUser();

    const stitchPromise = db
      .from('stitch')
      .select('id_stitch, name_stitch')
      .order('id_stitch', { ascending: true });

    const yarnPromise = user?.id_user
      ? db
          .from('yarn')
          .select('id_yarn, name_yarn, skein_length, skein_count')
          .eq('id_user', Number(user.id_user))
      : db
          .from('yarn')
          .select('id_yarn, name_yarn, skein_length, skein_count')
          .limit(20);

    const [stRes, yrRes] = await Promise.all([stitchPromise, yarnPromise]);
    if (!stRes.error && Array.isArray(stRes.data)) {
      state.stitches = stRes.data;
      if (!state.selectedStitchId && state.stitches[0]) {
        state.selectedStitchId = String(state.stitches[0].id_stitch);
      }
    }
    if (!yrRes.error && Array.isArray(yrRes.data)) {
      state.yarns = yrRes.data;
      if (!state.selectedYarnId && state.yarns[0]) {
        state.selectedYarnId = String(state.yarns[0].id_yarn);
      }
      if (!state.calcYarnId && state.yarns[0]) {
        state.calcYarnId = String(state.yarns[0].id_yarn);
      }
    }

    if (state.patternId) {
      const { data: patData } = await db
        .from('pattern')
        .select('name_pattern')
        .eq('id_pattern', Number(state.patternId))
        .single();
      if (patData?.name_pattern) {
        state.patternName = patData.name_pattern;
      }
    }
  }

  function injectStylesAndDom() {
    if (document.getElementById('hachok-measurer-root')) return;

    const style = document.createElement('style');
    style.id = 'hachok-measurer-styles';
    style.textContent = `
      #hachok-measurer-fab {
        position: fixed; right: 20px; bottom: 20px; z-index: 60;
        background: #343E19; color: #D9B868; border: 2px solid #D9B868;
        box-shadow: 0 10px 24px rgba(30, 37, 27, 0.28);
        padding: 10px 16px; font-family: 'Cormorant Garamond', serif;
        font-weight: 700; font-size: 15px; letter-spacing: 0.08em;
        text-transform: uppercase; display: inline-flex; align-items: center;
        gap: 8px; cursor: pointer;
        transition: transform 0.2s ease, background-color 0.2s ease;
      }
      #hachok-measurer-fab:hover { background: #1E251B; transform: translateY(-2px); }
      #hachok-measurer-drawer {
        position: fixed; right: 20px; bottom: 74px; z-index: 65;
        width: min(390px, calc(100vw - 24px)); max-height: calc(100vh - 96px);
        overflow-y: auto; background: #F2E8D5; color: #1A1A1A;
        border: 2px solid #343E19; outline: 2px solid #D9B868; outline-offset: -5px;
        box-shadow: 0 18px 40px rgba(26, 26, 26, 0.35); font-family: 'Noto Serif', serif;
      }
      #hachok-measurer-drawer.hidden { display: none; }
      .hm-ornament-title {
        display: inline-block; border: 1px solid #343E19; background: #FAF4E8;
        padding: 4px 14px; font-family: 'Cormorant Garamond', serif; font-weight: 700;
        font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: #343E19;
      }
      .hm-btn-dark {
        width: 100%; background: #343E19; color: #D9B868; border: 1px solid #D9B868;
        padding: 10px 14px; font-family: 'Cormorant Garamond', serif; font-weight: 700;
        font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer;
        transition: background-color 0.2s ease, color 0.2s ease;
      }
      .hm-btn-dark:hover { background: #1E251B; color: #FAF4E8; }
      .hm-menu-item {
        width: 100%; background: #FAF4E8; border: 1px solid #343E19; padding: 8px 10px;
        display: flex; align-items: center; gap: 10px; text-align: left;
        font-size: 13px; font-weight: 600; color: #343E19; cursor: pointer;
        transition: background-color 0.15s ease;
      }
      .hm-menu-item:hover { background: #E8DEC7; }
      .hm-menu-num {
        width: 22px; height: 22px; border-radius: 9999px; border: 1px solid #343E19;
        display: inline-flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 700; flex-shrink: 0;
      }
      .hm-meter-box { background: #FAF4E8; border: 1px solid #D9B868; padding: 10px 12px; text-align: center; }
      .hm-nav-arrow {
        flex: 1; background: #FAF4E8; border: 1px solid #343E19; color: #343E19;
        padding: 6px 10px; font-family: 'Cormorant Garamond', serif; font-weight: 700;
        font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer;
      }
      .hm-nav-arrow:hover { background: #D9B868; }
      .hm-track-zone {
        width: 100%; min-height: 92px; background: #FAF4E8; border: 2px dashed #343E19;
        color: #343E19; padding: 10px; text-align: center; cursor: pointer;
        display: flex; flex-direction: column; justify-content: center; gap: 4px;
        user-select: none; transition: background-color 0.15s ease;
      }
      .hm-track-zone:hover { background: #E8DEC7; }
      .hm-track-zone.hm-tracking { background: #E3EDCF; border-style: solid; border-color: #2F6B2F; }
      .hm-track-title { font-family: 'Cormorant Garamond', serif; font-weight: 700; font-size: 14px; letter-spacing: 0.06em; }
      .hm-track-dx { font-family: 'Cormorant Garamond', serif; font-weight: 700; font-size: 18px; }
      .hm-track-hint { font-size: 10px; color: #6E6658; line-height: 1.3; }
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'hachok-measurer-root';
    root.innerHTML = `
      <button type="button" id="hachok-measurer-fab" aria-expanded="false" aria-controls="hachok-measurer-drawer">
        <i class="fas fa-ruler-combined" aria-hidden="true"></i>
        <span>Нитковимірювач</span>
      </button>

      <aside id="hachok-measurer-drawer" class="hidden p-4" role="dialog" aria-label="Майстер Нитковимірювач">
        <div class="flex items-center justify-between pb-2 mb-3 border-b border-[#343E19]/30">
          <span class="text-xs font-bold uppercase tracking-wider text-[#343E19]">
            <i class="fas fa-compass-drafting mr-1 text-[#D9B868]" aria-hidden="true"></i>
            Нитковимірювач • Крок <span id="hm-step-label"></span>
          </span>
          <button type="button" id="hm-close-btn" class="text-[#343E19] hover:text-black px-1.5 py-0.5 text-base font-bold" aria-label="Закрити віджет">×</button>
        </div>

        <div id="hm-feedback" class="hidden"></div>
        <div id="hm-body"></div>

        <div class="flex items-center gap-2 mt-4 pt-3 border-t border-[#343E19]/25">
          <button type="button" id="hm-prev-btn" class="hm-nav-arrow" aria-label="Попередній крок">&lt; НАЗАД</button>
          <button type="button" id="hm-next-btn" class="hm-nav-arrow" aria-label="Наступний крок">ДАЛІ &gt;</button>
        </div>
      </aside>
    `;
    document.body.appendChild(root);

    document.getElementById('hachok-measurer-fab')?.addEventListener('click', () => {
      if (state.isOpen) closeWidget();
      else openWidget({ step: state.step || 'splash' });
    });
    document.getElementById('hm-close-btn')?.addEventListener('click', closeWidget);

    document.getElementById('hm-prev-btn')?.addEventListener('click', () => {
      const idx = STEPS.indexOf(state.step);
      goToStep(STEPS[idx > 0 ? idx - 1 : STEPS.length - 1]);
    });
    document.getElementById('hm-next-btn')?.addEventListener('click', () => {
      const idx = STEPS.indexOf(state.step);
      goToStep(STEPS[idx < STEPS.length - 1 ? idx + 1 : 0]);
    });
  }

  function updateLiveReadouts() {
    const meterVal = document.getElementById('hm-live-meter');
    if (meterVal) meterVal.textContent = formatMetersCm(getMeasuredCm());

    const coefEl = document.getElementById('hm-track-coef');
    if (coefEl) {
      const cal = state.calibrations[state.activeYarnKey] > 0;
      coefEl.textContent = cal
        ? `Коеф.: ${getPxPerCm().toFixed(2)} px/см • пряжа «${state.activeYarnKey}»`
        : `Коеф.: ${getPxPerCm().toFixed(2)} px/см (стандартний — відкалібруйте пряжу)`;
    }

    const dxEl = document.getElementById('hm-track-dx');
    if (dxEl) {
      const d = state.lastDeltaX;
      const arrow = d > 0 ? '→ X+' : d < 0 ? '← X−' : 'X';
      dxEl.textContent = `${arrow} ${d > 0 ? '+' : ''}${Math.round(d)} px • Σ ${Math.round(state.measuredPx)} px`;
    }

    const usedEl = document.getElementById('hm-used-val');
    const remEl = document.getElementById('hm-rem-val');
    const usedMeters = Number((state.usedMeters + getMeasuredCm() / 100).toFixed(2));
    const remMeters = Math.max(0, Number((state.calculatedMeters - usedMeters).toFixed(2)));
    if (usedEl) usedEl.textContent = `${usedMeters} m`;
    if (remEl) remEl.textContent = `${remMeters} m`;
  }

  function meterBoxHtml() {
    return `
      <div class="hm-meter-box">
        <div class="text-[10px] font-bold tracking-widest uppercase text-[#6E6658]">METRAGE</div>
        <div id="hm-live-meter" class="font-heading font-bold text-xl text-[#343E19]">${formatMetersCm(getMeasuredCm())}</div>
        <div class="text-[10px] text-emerald-700 font-bold">• Live</div>
      </div>
    `;
  }

  // ───────────────────────── РЕНДЕР КРОКІВ ─────────────────────────

  function renderStep() {
    injectStylesAndDom();
    const body = document.getElementById('hm-body');
    if (!body) return;

    const stepLabel = document.getElementById('hm-step-label');
    if (stepLabel) stepLabel.textContent = `${STEPS.indexOf(state.step) + 1}/${STEPS.length}`;

    setFeedback(state.statusMessage, state.statusType);

    if (state.step === 'splash') {
      body.innerHTML = `
        <div class="text-center space-y-3 py-2">
          <div class="w-24 h-24 mx-auto rounded-full border-2 border-[#343E19] bg-[#FAF4E8] flex flex-col items-center justify-center text-[#343E19] shadow-sm">
            <i class="fas fa-hat-wizard text-2xl text-[#343E19]" aria-hidden="true"></i>
            <span class="text-[10px] font-bold tracking-widest mt-1">ГЕНЕРАЛ</span>
          </div>
          <h3 class="font-heading font-bold text-2xl tracking-widest uppercase text-[#343E19]">НИТКОВИМІРЮВАЧ</h3>
          <button type="button" id="hm-how-project-btn" class="px-3 py-1 bg-[#FAF4E8] border border-[#343E19] text-[11px] font-bold uppercase text-[#343E19]">
            &lt; ЯК ЗАПУСТИТИ ПРОЄКТ?
          </button>
          <div class="pt-2">
            <button type="button" id="hm-start-cal-btn" class="hm-btn-dark">ПОЧАТИ КАЛІБРУВАННЯ</button>
          </div>
        </div>
      `;
      document.getElementById('hm-how-project-btn')?.addEventListener('click', () => goToStep('calc'));
      document.getElementById('hm-start-cal-btn')?.addEventListener('click', () => goToStep('menu'));
      return;
    }

    if (state.step === 'menu') {
      body.innerHTML = `
        <div class="space-y-3">
          <div class="text-center"><span class="hm-ornament-title">НИТКОВИМІРЮВАЧ</span></div>
          <p class="text-xs text-center font-semibold text-[#343E19]">Оберіть, що ви хочете зробити</p>
          <div class="space-y-2">
            <button type="button" data-menu-jump="check" class="hm-menu-item"><span class="hm-menu-num">1</span><span>Перевірити підключення мишки</span></button>
            <button type="button" data-menu-jump="yarn" class="hm-menu-item"><span class="hm-menu-num">2</span><span>Калібрування пряжі</span></button>
            <button type="button" data-menu-jump="stitch" class="hm-menu-item"><span class="hm-menu-num">3</span><span>Калібрування стібка (10×2)</span></button>
            <button type="button" data-menu-jump="calc" class="hm-menu-item"><span class="hm-menu-num">4</span><span>Розрахунок пряжі</span></button>
            <button type="button" data-menu-jump="actual" class="hm-menu-item"><span class="hm-menu-num">5</span><span>Відслідковування фактичної довжини</span></button>
          </div>
          <button type="button" id="hm-create-proj-btn" class="hm-btn-dark mt-1">СТВОРИТИ ПРОЄКТ</button>
        </div>
      `;

      body.querySelectorAll('[data-menu-jump]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const target = btn.dataset.menuJump;
          if (target === 'check') {
            setFeedback(
              state.mouseConnected
                ? 'Мишку виявлено: події руху надходять. Перейдіть до калібрування та натисніть зону запису.'
                : 'Рух мишки ще не виявлено — порухайте мишкою і натисніть ще раз.',
              state.mouseConnected ? 'success' : 'error'
            );
            return;
          }
          goToStep(target);
        });
      });
      document.getElementById('hm-create-proj-btn')?.addEventListener('click', () => goToStep('calc'));
      return;
    }

    if (state.step === 'yarn') {
      body.innerHTML = `
        <div class="space-y-3">
          <div class="text-center"><span class="hm-ornament-title">КАЛІБРУВАННЯ ПРЯЖІ</span></div>
          <p class="text-xs text-center text-[#343E19] leading-relaxed">
            Відміряйте 100 см пряжі та проведіть цей відрізок через вимірювач
          </p>
          <div class="grid grid-cols-2 gap-2">
            <input id="hm-yarn-name" type="text" list="hm-yarn-names" value="${escapeText(state.yarnName)}" placeholder="Назва/тип пряжі..." class="p-2 text-xs bg-[#FAF4E8] border border-[#343E19] text-[#343E19]">
            <datalist id="hm-yarn-names">${state.yarns.map((y) => `<option value="${escapeText(y.name_yarn)}"></option>`).join('')}</datalist>
            <input id="hm-skein-len" type="number" min="1" max="${LIMITS.maxSkeinLength}" value="${state.skeinMeters}" placeholder="Метрів у мотку" class="p-2 text-xs bg-[#FAF4E8] border border-[#343E19] text-[#343E19]">
          </div>
          ${trackerZoneHtml()}
          <button type="button" id="hm-reset-cm" class="w-full py-1.5 px-2.5 text-xs font-bold bg-[#FAF4E8] border border-[#343E19] text-[#343E19]">Скинути</button>
          ${meterBoxHtml()}
          <div class="p-2 bg-[#FAF4E8] border border-[#343E19] text-[11px] text-center text-[#343E19]">
            Зупиніть запис та натисніть кнопку, щоб запротоколювати калібрування
          </div>
          <button type="button" id="hm-save-yarn-btn" class="hm-btn-dark">ЗБЕРЕГТИ ПРЯЖУ</button>
        </div>
      `;

      bindTracker();
      document.getElementById('hm-reset-cm')?.addEventListener('click', resetSensorCm);
      document.getElementById('hm-save-yarn-btn')?.addEventListener('click', () => {
        const rawName = (document.getElementById('hm-yarn-name')?.value || '').trim();
        const rawLen = Number(document.getElementById('hm-skein-len')?.value);

        if (!Number.isFinite(rawLen) || rawLen <= 0 || rawLen > LIMITS.maxSkeinLength) {
          setFeedback(`Вкажіть коректну довжину мотка (від 1 до ${LIMITS.maxSkeinLength} м).`, 'error');
          return;
        }
        stopTracking();
        if (state.measuredPx < MIN_CALIB_PX) {
          setFeedback('Замало руху для калібрування: увімкніть запис і проведіть 100 см нитки (мишка вправо, X+).', 'error');
          return;
        }
        state.yarnName = rawName || 'Калібрована пряжа';
        state.skeinMeters = rawLen;
        // коефіцієнт = (відстань у пікселях за 100 см) / 100
        const pxPerCm = state.measuredPx / state.calibrationCm;
        const px = Math.round(state.measuredPx);
        setYarnCalibration(state.yarnName, pxPerCm);
        state.activeYarnKey = yarnKey(state.yarnName);
        resetSensorCm();
        setFeedback(
          `Пряжу «${state.yarnName}» (${state.skeinMeters} м/моток) відкалібровано: ${px} px = ${state.calibrationCm} см → ${pxPerCm.toFixed(2)} px/см.`,
          'success'
        );
      });
      return;
    }

    if (state.step === 'stitch') {
      const stitchOptions = state.stitches.length
        ? state.stitches
            .map((s) => `<option value="${s.id_stitch}" ${String(s.id_stitch) === String(state.selectedStitchId) ? 'selected' : ''}>${escapeText(s.name_stitch)}</option>`)
            .join('')
        : `<option value="">Стібок (10×2)</option>`;

      const yarnOptions = state.yarns.length
        ? state.yarns
            .map((y) => `<option value="${y.id_yarn}" ${String(y.id_yarn) === String(state.selectedYarnId) ? 'selected' : ''}>${escapeText(y.name_yarn)}</option>`)
            .join('')
        : `<option value="">Пряжа за замовчуванням</option>`;

      body.innerHTML = `
        <div class="space-y-3">
          <div class="text-center"><span class="hm-ornament-title">КАЛІБРУВАННЯ СТІБКА (10×2)</span></div>
          <p class="text-xs text-center text-[#343E19] leading-relaxed">
            Встановивши нитку у вимірювач, зв'яжіть 1 ряд з 10 повітряних петель, 2 ряди «Стібка»
          </p>
          <div class="grid grid-cols-2 gap-2">
            <select id="hm-stitch-select" class="p-2 text-xs bg-[#FAF4E8] border border-[#343E19] text-[#343E19]">${stitchOptions}</select>
            <select id="hm-stitch-yarn-select" class="p-2 text-xs bg-[#FAF4E8] border border-[#343E19] text-[#343E19]">${yarnOptions}</select>
          </div>
          ${trackerZoneHtml()}
          <button type="button" id="hm-reset-stitch-cm" class="w-full py-1.5 px-2.5 text-xs font-bold bg-[#FAF4E8] border border-[#343E19] text-[#343E19]">Скинути (0)</button>
          ${meterBoxHtml()}
          <div class="p-2 bg-[#FAF4E8] border border-[#343E19] text-[11px] text-center text-[#343E19]">
            Зупиніть запис та натисніть кнопку, щоб запротоколювати калібрування
          </div>
          <button type="button" id="hm-save-stitch-btn" class="hm-btn-dark">ЗБЕРЕГТИ СТІБОК</button>
        </div>
      `;

      bindTracker();
      document.getElementById('hm-reset-stitch-cm')?.addEventListener('click', resetSensorCm);
      const syncStitchYarn = () => {
        const val = document.getElementById('hm-stitch-yarn-select')?.value;
        const y = state.yarns.find((yy) => String(yy.id_yarn) === String(val));
        if (y) {
          state.selectedYarnId = String(y.id_yarn);
          state.activeYarnKey = yarnKey(y.name_yarn);
        }
      };
      syncStitchYarn();
      updateLiveReadouts();
      document.getElementById('hm-stitch-yarn-select')?.addEventListener('change', () => {
        syncStitchYarn();
        resetSensorCm();
      });
      document.getElementById('hm-save-stitch-btn')?.addEventListener('click', async () => {
        stopTracking();
        const stitchId = Number(document.getElementById('hm-stitch-select')?.value);
        const yarnId = Number(document.getElementById('hm-stitch-yarn-select')?.value);

        if (getMeasuredCm() <= 0) {
          setFeedback('Спочатку виміряйте зразок: увімкніть запис і порухайте мишкою вправо.', 'error');
          return;
        }
        const sampleCm = getMeasuredCm();
        const metersPerStitch = Number((sampleCm / 100 / state.stitchSampleCount).toFixed(4));

        if (!db || !stitchId || !yarnId) {
          setFeedback(`Калібрування стібка збережено локально (~${metersPerStitch} м/стібок).`, 'success');
          return;
        }

        const { error } = await db.from('calibration').insert([
          {
            id_stitch: stitchId,
            id_yarn: yarnId,
            meters_per_stitch: metersPerStitch,
            sample_meters: Number((sampleCm / 100).toFixed(4)),
          },
        ]);

        if (error) {
          console.error('Помилка запису калібрування:', error);
          setFeedback(`Помилка запису в БД: ${error.message}`, 'error');
          return;
        }
        setFeedback(`Калібрування стібка записано в БД (${metersPerStitch} м/стібок)!`, 'success');
      });
      return;
    }

    if (state.step === 'calc') {
      const yarnOptions = state.yarns.length
        ? state.yarns
            .map((y) => `<option value="${y.id_yarn}" ${String(y.id_yarn) === String(state.calcYarnId) ? 'selected' : ''}>${escapeText(y.name_yarn)} (${y.skein_length || 100} м)</option>`)
            .join('')
        : `<option value="">Оберіть пряжу</option>`;

      body.innerHTML = `
        <div class="space-y-3">
          <div class="text-center"><span class="hm-ornament-title">РОЗРАХУНОК ПРЯЖІ</span></div>
          <p class="text-xs text-center text-[#343E19] leading-relaxed">
            Вимірювач зараз порахує скільки потрібно буде пряжі на проєкт «${escapeText(state.patternName)}»
          </p>
          <select id="hm-calc-yarn-select" class="w-full p-2 text-xs bg-[#FAF4E8] border border-[#343E19] text-[#343E19]">${yarnOptions}</select>
          <button type="button" id="hm-calc-run-btn" class="hm-btn-dark">РОЗРАХУВАТИ ПРЯЖУ ДЛЯ «СХЕМИ»</button>
          <div class="hm-meter-box">
            <div class="text-[10px] font-bold tracking-widest uppercase text-[#6E6658]">ПРЯЖІ ПОТРІБНО</div>
            <div id="hm-calc-result" class="font-heading font-bold text-2xl text-[#343E19]">${state.calculatedMeters} m / ${state.calculatedSkeins} моток</div>
            <div id="hm-calc-status" class="text-xs font-bold text-emerald-700">${escapeText(state.calcStatusText)}</div>
          </div>
          <button type="button" id="hm-save-calc-btn" class="hm-btn-dark">ЗБЕРЕГТИ РОЗРАХУНОК У ПРОЄКТ</button>
        </div>
      `;

      document.getElementById('hm-calc-run-btn')?.addEventListener('click', () => {
        const chosenYarn = state.yarns.find(
          (y) => String(y.id_yarn) === String(document.getElementById('hm-calc-yarn-select')?.value)
        );
        if (chosenYarn) {
          state.calcYarnId = String(chosenYarn.id_yarn);
          state.activeYarnKey = yarnKey(chosenYarn.name_yarn);
        }
        const perSkein = safeNum(chosenYarn?.skein_length, state.skeinMeters || 100, 10, LIMITS.maxSkeinLength);
        const availableMeters = chosenYarn
          ? safeNum(chosenYarn.skein_length, 0) * safeNum(chosenYarn.skein_count, 0)
          : perSkein * safeNum(state.skeinCount, 1);

        const neededMeters = 200;
        const neededSkeins = Math.max(1, Math.ceil(neededMeters / perSkein));
        state.calculatedMeters = neededMeters;
        state.calculatedSkeins = neededSkeins;
        state.calcStatusText =
          availableMeters >= neededMeters
            ? 'Вам вистачає!'
            : `Не вистачає ~${Math.max(0, Math.round(neededMeters - availableMeters))} м`;

        document.getElementById('hm-calc-result').textContent = `${neededMeters} m / ${neededSkeins} моток`;
        document.getElementById('hm-calc-status').textContent = state.calcStatusText;
      });

      document.getElementById('hm-save-calc-btn')?.addEventListener('click', () => {
        setFeedback(`Розрахунок (${state.calculatedMeters} м) збережено для проєкту.`, 'success');
      });
      return;
    }

    if (state.step === 'actual') {
      body.innerHTML = `
        <div class="space-y-3">
          <div class="text-center"><span class="hm-ornament-title">ФАКТИЧНА ВИТРАТА ПРЯЖІ</span></div>
          <p class="text-xs text-center text-[#343E19] leading-relaxed">
            Вимірювач може помилятися, тому тут ми показуємо фактичну витрату пряжі
          </p>
          ${meterBoxHtml()}
          ${trackerZoneHtml()}
          <div class="grid grid-cols-2 gap-2 text-center">
            <div class="bg-[#FAF4E8] border border-[#D9B868] p-2">
              <div class="text-[10px] font-bold uppercase text-[#6E6658]">ВИКОРИСТАНО</div>
              <div id="hm-used-val" class="font-heading font-bold text-lg text-[#343E19]">${state.usedMeters} m</div>
              <div class="text-[11px] font-bold text-[#343E19]">1 моток</div>
            </div>
            <div class="bg-[#FAF4E8] border border-[#D9B868] p-2">
              <div class="text-[10px] font-bold uppercase text-[#6E6658]">ЗАЛИШОК</div>
              <div id="hm-rem-val" class="font-heading font-bold text-lg text-[#343E19]">0 m</div>
              <div class="text-[11px] font-bold text-[#343E19]">0 мотків</div>
            </div>
          </div>
          <button type="button" id="hm-save-actual-btn" class="hm-btn-dark">ЗБЕРЕГТИ ВИТРАТУ У ПРОЄКТ</button>
        </div>
      `;

      bindTracker();
      document.getElementById('hm-save-actual-btn')?.addEventListener('click', () => {
        stopTracking();
        setFeedback('Фактичну витрату зафіксовано у проєкті.', 'success');
      });
    }
  }

  function goToStep(stepName) {
    if (!STEPS.includes(stepName)) return;
    stopTracking();
    state.step = stepName;
    state.statusMessage = '';
    renderStep();
  }

  async function openWidget(options = {}) {
    if (options.patternId) state.patternId = Number(options.patternId);
    if (options.step && STEPS.includes(options.step)) {
      state.step = options.step;
    } else if (options.step === 'project') {
      state.step = 'calc';
    }

    injectStylesAndDom();
    state.isOpen = true;
    document.getElementById('hachok-measurer-drawer')?.classList.remove('hidden');
    document.getElementById('hachok-measurer-fab')?.setAttribute('aria-expanded', 'true');

    renderStep(); // одразу показуємо UI, дані з БД підтягнуться далі
    await loadReferenceData();
    renderStep();
  }

  function closeWidget() {
    stopTracking();
    state.isOpen = false;
    document.getElementById('hachok-measurer-drawer')?.classList.add('hidden');
    document.getElementById('hachok-measurer-fab')?.setAttribute('aria-expanded', 'false');
  }

  window.addEventListener('hachok:open-measurer', (e) => {
    openWidget(e.detail || {});
  });

  window.HachokMeasurerWidget = {
    open: openWidget,
    close: closeWidget,
    goToStep,
    simulatePulse: applySensorDeltaCm, // знак зберігається: + вправо, - вліво
    startTracking,
    stopTracking,
    reset: resetSensorCm,
    // вручну задати коефіцієнт (px/см) для пряжі
    setPxPerCm(v, yarnName) {
      setYarnCalibration(yarnName, v);
      if (yarnName) state.activeYarnKey = yarnKey(yarnName);
      updateLiveReadouts();
    },
    getCalibrations() {
      return { ...state.calibrations };
    },
  };

  document.addEventListener('DOMContentLoaded', injectStylesAndDom);
})();