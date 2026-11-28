/**
 * Стікі-віджет майстра «Нитковимірювач» (ЛР №11)
 * Проєкт: «Генерал Гачок»
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

  // Захисні межі (Defensive Programming / Edge Cases)
  const LIMITS = {
    maxCm: 500000, // до 5000 м за один сеанс
    maxSkeinLength: 5000,
    maxSkeinCount: 200,
    defaultStitchCount: 20, // 10 ПП + ~10-20 стібків у вибірці
  };

  const state = {
    isOpen: false,
    step: 'splash',
    patternId: null,
    patternName: 'Обрана схема',
    mouseConnected: true,
    // Сенсор (аналог PS/2 deltaX -> len у C++ коді)
    measuredCm: 0,
    usedMeters: 200,
    // Екран 3: Калібрування пряжі
    yarnName: '',
    skeinMeters: 100,
    skeinCount: 1,
    // Екран 4: Калібрування стібка
    selectedStitchId: '',
    selectedYarnId: '',
    stitchSampleCount: LIMITS.defaultStitchCount,
    // Екран 5: Розрахунок пряжі
    calcYarnId: '',
    calculatedMeters: 200,
    calculatedSkeins: 1,
    calcStatusText: 'Вам вистачає!',
    // Довідники з БД
    stitches: [],
    yarns: [],
    statusMessage: '',
    statusType: 'info', // 'info' | 'success' | 'error'
  };

  function safeNum(val, fallback = 0, min = -Infinity, max = Infinity) {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function formatMetersCm(totalCm) {
    const cleanCm = safeNum(totalCm, 0, 0, LIMITS.maxCm);
    const meters = Math.floor(cleanCm / 100);
    const cm = Math.round(cleanCm % 100);
    const mStr = String(meters).padStart(2, '0');
    const cStr = String(cm).padStart(2, '0');
    return `${mStr}.00 m / ${cStr} cm`;
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

  // Симуляція зчитування дельти сенсора (як deltaX у PS2MousePos)
  function applySensorDeltaCm(deltaCm) {
    const cleanDelta = safeNum(deltaCm, 0, -5000, 5000);
    if (cleanDelta <= 0) return; // як у C++: if (x > 0) len += x;
    state.measuredCm = safeNum(
      state.measuredCm + cleanDelta,
      0,
      0,
      LIMITS.maxCm
    );
    updateLiveReadouts();
  }

  function resetSensorCm() {
    state.measuredCm = 0;
    updateLiveReadouts();
  }

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
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 60;
        background: #343E19;
        color: #D9B868;
        border: 2px solid #D9B868;
        box-shadow: 0 10px 24px rgba(30, 37, 27, 0.28);
        padding: 10px 16px;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 700;
        font-size: 15px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        transition: transform 0.2s ease, background-color 0.2s ease;
      }
      #hachok-measurer-fab:hover {
        background: #1E251B;
        transform: translateY(-2px);
      }
      #hachok-measurer-drawer {
        position: fixed;
        right: 20px;
        bottom: 74px;
        z-index: 65;
        width: min(390px, calc(100vw - 24px));
        max-height: calc(100vh - 96px);
        overflow-y: auto;
        background: #F2E8D5;
        color: #1A1A1A;
        border: 2px solid #343E19;
        outline: 2px solid #D9B868;
        outline-offset: -5px;
        box-shadow: 0 18px 40px rgba(26, 26, 26, 0.35);
        font-family: 'Noto Serif', serif;
      }
      .hm-ornament-title {
        display: inline-block;
        border: 1px solid #343E19;
        background: #FAF4E8;
        padding: 4px 14px;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 700;
        font-size: 13px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #343E19;
      }
      .hm-btn-dark {
        width: 100%;
        background: #343E19;
        color: #D9B868;
        border: 1px solid #D9B868;
        padding: 10px 14px;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 700;
        font-size: 14px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background-color 0.2s ease, color 0.2s ease;
      }
      .hm-btn-dark:hover {
        background: #1E251B;
        color: #FAF4E8;
      }
      .hm-menu-item {
        width: 100%;
        background: #FAF4E8;
        border: 1px solid #343E19;
        padding: 8px 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        text-align: left;
        font-size: 13px;
        font-weight: 600;
        color: #343E19;
        cursor: pointer;
        transition: background-color 0.15s ease;
      }
      .hm-menu-item:hover {
        background: #E8DEC7;
      }
      .hm-menu-num {
        width: 22px;
        height: 22px;
        border-radius: 9999px;
        border: 1px solid #343E19;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        flex-shrink: 0;
      }
      .hm-meter-box {
        background: #FAF4E8;
        border: 1px solid #D9B868;
        padding: 10px 12px;
        text-align: center;
      }
      .hm-nav-arrow {
        flex: 1;
        background: #FAF4E8;
        border: 1px solid #343E19;
        color: #343E19;
        padding: 6px 10px;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 700;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .hm-nav-arrow:hover {
        background: #D9B868;
      }
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
            Нитковимірювач • Крок ${STEPS.indexOf(state.step) + 1}/${STEPS.length}
          </span>
          <button type="button" id="hm-close-btn" class="text-[#343E19] hover:text-black px-1.5 py-0.5 text-base font-bold" aria-label="Закрити віджет">
            ×
          </button>
        </div>

        <div id="hm-feedback" class="hidden"></div>
        <div id="hm-body"></div>

        <!-- Стрілочки перемикання кроків (як на схемі переходів) -->
        <div class="flex items-center gap-2 mt-4 pt-3 border-t border-[#343E19]/25">
          <button type="button" id="hm-prev-btn" class="hm-nav-arrow" aria-label="Попередній крок">
            < НАЗАД
          </button>
          <button type="button" id="hm-next-btn" class="hm-nav-arrow" aria-label="Наступний крок">
            ДАЛІ >
          </button>
        </div>
      </aside>
    `;
    document.body.appendChild(root);

    document.getElementById('hachok-measurer-fab')?.addEventListener('click', () => {
      if (state.isOpen) {
        closeWidget();
      } else {
        openWidget({ step: state.step || 'splash' });
      }
    });

    document.getElementById('hm-close-btn')?.addEventListener('click', closeWidget);

    document.getElementById('hm-prev-btn')?.addEventListener('click', () => {
      const idx = STEPS.indexOf(state.step);
      const prevIdx = idx > 0 ? idx - 1 : STEPS.length - 1;
      goToStep(STEPS[prevIdx]);
    });

    document.getElementById('hm-next-btn')?.addEventListener('click', () => {
      const idx = STEPS.indexOf(state.step);
      const nextIdx = idx < STEPS.length - 1 ? idx + 1 : 0;
      goToStep(STEPS[nextIdx]);
    });
  }

  function updateLiveReadouts() {
    const meterVal = document.getElementById('hm-live-meter');
    if (meterVal) meterVal.textContent = formatMetersCm(state.measuredCm);

    const usedEl = document.getElementById('hm-used-val');
    const remEl = document.getElementById('hm-rem-val');
    const usedMeters = Number((state.usedMeters + state.measuredCm / 100).toFixed(2));
    const remMeters = Math.max(
      0,
      Number((state.calculatedMeters - usedMeters).toFixed(2))
    );
    if (usedEl) usedEl.textContent = `${usedMeters} m`;
    if (remEl) remEl.textContent = `${remMeters} m`;
  }

  function renderStep() {
    injectStylesAndDom();
    const body = document.getElementById('hm-body');
    if (!body) return;

    setFeedback(state.statusMessage, state.statusType);

    if (state.step === 'splash') {
      body.innerHTML = `
        <div class="text-center space-y-3 py-2">
          <div class="w-24 h-24 mx-auto rounded-full border-2 border-[#343E19] bg-[#FAF4E8] flex flex-col items-center justify-center text-[#343E19] shadow-sm">
            <i class="fas fa-hat-wizard text-2xl text-[#343E19]" aria-hidden="true"></i>
            <span class="text-[10px] font-bold tracking-widest mt-1">ГЕНЕРАЛ</span>
          </div>
          <h3 class="font-heading font-bold text-2xl tracking-widest uppercase text-[#343E19]">
            НИТКОВИМІРЮВАЧ
          </h3>
          <button type="button" id="hm-how-project-btn" class="px-3 py-1 bg-[#FAF4E8] border border-[#343E19] text-[11px] font-bold uppercase text-[#343E19]">
            < ЯК ЗАПУСТИТИ ПРОЄКТ?
          </button>
          <div class="pt-2">
            <button type="button" id="hm-start-cal-btn" class="hm-btn-dark">
              ПОЧАТИ КАЛІБРУВАННЯ
            </button>
          </div>
        </div>
      `;

      document.getElementById('hm-how-project-btn')?.addEventListener('click', () => {
        goToStep('calc');
      });
      document.getElementById('hm-start-cal-btn')?.addEventListener('click', () => {
        goToStep('menu');
      });
      return;
    }

    if (state.step === 'menu') {
      body.innerHTML = `
        <div class="space-y-3">
          <div class="text-center"><span class="hm-ornament-title">НИТКОВИМІРЮВАЧ</span></div>
          <p class="text-xs text-center font-semibold text-[#343E19]">Оберіть, що ви хочете зробити</p>
          <div class="space-y-2">
            <button type="button" data-menu-jump="check" class="hm-menu-item">
              <span class="hm-menu-num">1</span><span>Перевірити підключення мишки</span>
            </button>
            <button type="button" data-menu-jump="yarn" class="hm-menu-item">
              <span class="hm-menu-num">2</span><span>Калібрування пряжі</span>
            </button>
            <button type="button" data-menu-jump="stitch" class="hm-menu-item">
              <span class="hm-menu-num">3</span><span>Калібрування стібка (10×2)</span>
            </button>
            <button type="button" data-menu-jump="calc" class="hm-menu-item">
              <span class="hm-menu-num">4</span><span>Розрахунок пряжі</span>
            </button>
            <button type="button" data-menu-jump="actual" class="hm-menu-item">
              <span class="hm-menu-num">5</span><span>Відслідковування фактичної довжини</span>
            </button>
          </div>
          <button type="button" id="hm-create-proj-btn" class="hm-btn-dark mt-1">
            СТВОРИТИ ПРОЄКТ
          </button>
        </div>
      `;

      body.querySelectorAll('[data-menu-jump]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const target = btn.dataset.menuJump;
          if (target === 'check') {
            applySensorDeltaCm(25);
            setFeedback(
              state.mouseConnected
                ? 'Сенсор (PS/2 deltaX > 0) активний! Тестовий імпульс +25 см зараховано.'
                : 'Сенсор не виявлено — перевірте підключення.',
              'success'
            );
            return;
          }
          goToStep(target);
        });
      });

      document.getElementById('hm-create-proj-btn')?.addEventListener('click', () => {
        goToStep('calc');
      });
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
            <input id="hm-yarn-name" type="text" value="${escapeText(state.yarnName)}" placeholder="Назва/тип пряжі..." class="p-2 text-xs bg-[#FAF4E8] border border-[#343E19] text-[#343E19]">
            <input id="hm-skein-len" type="number" min="1" max="${LIMITS.maxSkeinLength}" value="${state.skeinMeters}" placeholder="Метрів у мотку" class="p-2 text-xs bg-[#FAF4E8] border border-[#343E19] text-[#343E19]">
          </div>
          <div class="flex gap-2">
            <button type="button" id="hm-sim-100cm" class="flex-1 py-1.5 px-2 text-xs font-bold bg-[#FAF4E8] border border-[#343E19] text-[#343E19] hover:bg-[#D9B868]">
              Протягнути 100 см (x>0)
            </button>
            <button type="button" id="hm-reset-cm" class="py-1.5 px-2.5 text-xs font-bold bg-[#FAF4E8] border border-[#343E19] text-[#343E19]">
              Скинути
            </button>
          </div>
          <div class="hm-meter-box">
            <div class="text-[10px] font-bold tracking-widest uppercase text-[#6E6658]">METRAGE</div>
            <div id="hm-live-meter" class="font-heading font-bold text-xl text-[#343E19]">${formatMetersCm(state.measuredCm)}</div>
            <div class="text-[10px] text-emerald-700 font-bold">• Live</div>
          </div>
          <div class="p-2 bg-[#FAF4E8] border border-[#343E19] text-[11px] text-center text-[#343E19]">
            Зафіксуйте нитку та натисніть кнопку щоб запротоколювати калібрування
          </div>
          <button type="button" id="hm-save-yarn-btn" class="hm-btn-dark">ЗБЕРЕГТИ ПРЯЖУ</button>
        </div>
      `;

      document.getElementById('hm-sim-100cm')?.addEventListener('click', () => applySensorDeltaCm(100));
      document.getElementById('hm-reset-cm')?.addEventListener('click', resetSensorCm);
      document.getElementById('hm-save-yarn-btn')?.addEventListener('click', () => {
        const rawName = (document.getElementById('hm-yarn-name')?.value || '').trim();
        const rawLen = Number(document.getElementById('hm-skein-len')?.value);

        if (!Number.isFinite(rawLen) || rawLen <= 0 || rawLen > LIMITS.maxSkeinLength) {
          setFeedback(`Вкажіть коректну довжину мотка (від 1 до ${LIMITS.maxSkeinLength} м).`, 'error');
          return;
        }
        state.yarnName = rawName || 'Калібрована пряжа';
        state.skeinMeters = rawLen;
        setFeedback(
          `Пряжу «${state.yarnName}» (${state.skeinMeters} м/моток, заміряно ${Math.round(state.measuredCm)} см) зафіксовано.`,
          'success'
        );
      });
      return;
    }

    if (state.step === 'stitch') {
      const stitchOptions = state.stitches.length
        ? state.stitches
            .map(
              (s) =>
                `<option value="${s.id_stitch}" ${
                  String(s.id_stitch) === String(state.selectedStitchId) ? 'selected' : ''
                }>${escapeText(s.name_stitch)}</option>`
            )
            .join('')
        : `<option value="">Стібок (10×2)</option>`;

      const yarnOptions = state.yarns.length
        ? state.yarns
            .map(
              (y) =>
                `<option value="${y.id_yarn}" ${
                  String(y.id_yarn) === String(state.selectedYarnId) ? 'selected' : ''
                }>${escapeText(y.name_yarn)}</option>`
            )
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
          <div class="flex gap-2">
            <button type="button" id="hm-sim-stitch-sample" class="flex-1 py-1.5 px-2 text-xs font-bold bg-[#FAF4E8] border border-[#343E19] text-[#343E19] hover:bg-[#D9B868]">
              Зв'язати зразок (+60 см)
            </button>
            <button type="button" id="hm-reset-stitch-cm" class="py-1.5 px-2.5 text-xs font-bold bg-[#FAF4E8] border border-[#343E19] text-[#343E19]">
              0
            </button>
          </div>
          <div class="hm-meter-box">
            <div class="text-[10px] font-bold tracking-widest uppercase text-[#6E6658]">METRAGE</div>
            <div id="hm-live-meter" class="font-heading font-bold text-xl text-[#343E19]">${formatMetersCm(state.measuredCm)}</div>
            <div class="text-[10px] text-emerald-700 font-bold">• Live</div>
          </div>
          <div class="p-2 bg-[#FAF4E8] border border-[#343E19] text-[11px] text-center text-[#343E19]">
            Зафіксуйте нитку та натисніть кнопку щоб запротоколювати калібрування
          </div>
          <button type="button" id="hm-save-stitch-btn" class="hm-btn-dark">ЗБЕРЕГТИ СТІБОК</button>
        </div>
      `;

      document.getElementById('hm-sim-stitch-sample')?.addEventListener('click', () => applySensorDeltaCm(60));
      document.getElementById('hm-reset-stitch-cm')?.addEventListener('click', resetSensorCm);
      document.getElementById('hm-save-stitch-btn')?.addEventListener('click', async () => {
        const stitchId = Number(document.getElementById('hm-stitch-select')?.value);
        const yarnId = Number(document.getElementById('hm-stitch-yarn-select')?.value);
        const sampleCm = state.measuredCm > 0 ? state.measuredCm : 60;
        const metersPerStitch = Number(((sampleCm / 100) / state.stitchSampleCount).toFixed(4));

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
            .map(
              (y) =>
                `<option value="${y.id_yarn}" ${
                  String(y.id_yarn) === String(state.calcYarnId) ? 'selected' : ''
                }>${escapeText(y.name_yarn)} (${y.skein_length || 100} м)</option>`
            )
            .join('')
        : `<option value="">Оберіть пряжу</option>`;

      body.innerHTML = `
        <div class="space-y-3">
          <div class="text-center"><span class="hm-ornament-title">РОЗРАХУНОК ПРЯЖІ</span></div>
          <p class="text-xs text-center text-[#343E19] leading-relaxed">
            Вимірювач зараз порахує скільки потрібно буде пряжі на проєкт «${escapeText(state.patternName)}»
          </p>
          <select id="hm-calc-yarn-select" class="w-full p-2 text-xs bg-[#FAF4E8] border border-[#343E19] text-[#343E19]">
            ${yarnOptions}
          </select>
          <button type="button" id="hm-calc-run-btn" class="hm-btn-dark">
            РОЗРАХУВАТИ ПРЯЖУ ДЛЯ «СХЕМИ»
          </button>
          <div class="hm-meter-box">
            <div class="text-[10px] font-bold tracking-widest uppercase text-[#6E6658]">ПРЯЖІ ПОТРІБНО</div>
            <div id="hm-calc-result" class="font-heading font-bold text-2xl text-[#343E19]">
              ${state.calculatedMeters} m / ${state.calculatedSkeins} моток
            </div>
            <div id="hm-calc-status" class="text-xs font-bold text-emerald-700">${escapeText(state.calcStatusText)}</div>
          </div>
          <button type="button" id="hm-save-calc-btn" class="hm-btn-dark">
            ЗБЕРЕГТИ РОЗРАХУНОК У ПРОЄКТ
          </button>
        </div>
      `;

      document.getElementById('hm-calc-run-btn')?.addEventListener('click', () => {
        const chosenYarn = state.yarns.find(
          (y) => String(y.id_yarn) === String(document.getElementById('hm-calc-yarn-select')?.value)
        );
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
          <div class="hm-meter-box">
            <div class="text-[10px] font-bold tracking-widest uppercase text-[#6E6658]">METRAGE</div>
            <div id="hm-live-meter" class="font-heading font-bold text-xl text-[#343E19]">${formatMetersCm(state.measuredCm)}</div>
            <div class="text-[10px] text-emerald-700 font-bold">• Live</div>
          </div>
          <button type="button" id="hm-sim-actual-btn" class="w-full p-2 bg-[#FAF4E8] border border-[#343E19] text-[11px] text-[#343E19] font-semibold hover:bg-[#D9B868]">
            Зафіксуйте нитку та натисніть щоб запротоколювати вимірювання (+50 см)
          </button>
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
          <button type="button" id="hm-save-actual-btn" class="hm-btn-dark">
            ЗБЕРЕГТИ ВИТРАТУ У ПРОЄКТ
          </button>
        </div>
      `;

      updateLiveReadouts();
      document.getElementById('hm-sim-actual-btn')?.addEventListener('click', () => applySensorDeltaCm(50));
      document.getElementById('hm-save-actual-btn')?.addEventListener('click', () => {
        setFeedback('Фактичну витрату зафіксовано у проєкті.', 'success');
      });
    }
  }

  function goToStep(stepName) {
    if (!STEPS.includes(stepName)) return;
    state.step = stepName;
    state.statusMessage = '';
    renderStep();
  }

  async function openWidget(options = {}) {
    if (options.patternId) {
      state.patternId = Number(options.patternId);
    }
    if (options.step && STEPS.includes(options.step)) {
      state.step = options.step;
    } else if (options.step === 'project') {
      state.step = 'calc';
    }

    injectStylesAndDom();
    state.isOpen = true;
    document.getElementById('hachok-measurer-drawer')?.classList.remove('hidden');
    document.getElementById('hachok-measurer-fab')?.setAttribute('aria-expanded', 'true');

    await loadReferenceData();
    renderStep();
  }

  function closeWidget() {
    state.isOpen = false;
    document.getElementById('hachok-measurer-drawer')?.classList.add('hidden');
    document.getElementById('hachok-measurer-fab')?.setAttribute('aria-expanded', 'false');
  }

  // Періодичний цикл опитування сенсора (аналог loop з millis() ~10ms, у браузері м'який 250ms тік для UI)
  setInterval(() => {
    if (state.isOpen && state.mouseConnected) {
      updateLiveReadouts();
    }
  }, 250);

  window.addEventListener('hachok:open-measurer', (e) => {
    openWidget(e.detail || {});
  });

  window.HachokMeasurerWidget = {
    open: openWidget,
    close: closeWidget,
    goToStep,
    simulatePulse: applySensorDeltaCm,
  };

  document.addEventListener('DOMContentLoaded', () => {
    injectStylesAndDom();
  });
})();