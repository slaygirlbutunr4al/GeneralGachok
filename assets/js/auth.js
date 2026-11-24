const SUPABASE_URL = 'https://aviukajqbzmgbtwjijmk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lkqx0Wf0GyBdsd4u69Sryg_BELv1YHM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 1. Регулярні вирази (RegEx)
// Псевдонім: латинські літери та нижні підкреслення, без пробілів, одне слово, 1–15 символів
const NICKNAME_REGEX = /^[a-zA-Z_]{1,15}$/;

// Електронна пошта: стандартний формат name@domain.com
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Пароль: великі й малі латинські, великі й малі українські літери та цифри (мін. 8 символів)
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[а-щьюяіїєґ])(?=.*[А-ЩЬЮЯІЇЄҐ])(?=.*\d)[A-Za-zА-ЩЬЮЯІЇЄҐа-щьюяіїєґ\d]{8,}$/;

// Детальна перевірка пароля з підказкою, чого саме не вистачає
function validatePassword(password) {
  if (!password) return 'Введіть пароль.';
  if (password.length < 8) return 'Пароль має містити щонайменше 8 символів.';
  if (!/[A-Z]/.test(password)) return 'Додайте хоча б одну велику латинську літеру (A–Z).';
  if (!/[a-z]/.test(password)) return 'Додайте хоча б одну малу латинську літеру (a–z).';
  if (!/[А-ЩЬЮЯІЇЄҐ]/.test(password)) return 'Додайте хоча б одну велику українську літеру (А–Я, І, Ї, Є, Ґ).';
  if (!/[а-щьюяіїєґ]/.test(password)) return 'Додайте хоча б одну малу українську літеру (а–я, і, ї, є, ґ).';
  if (!/\d/.test(password)) return 'Додайте хоча б одну цифру (0–9).';
  if (!PASSWORD_REGEX.test(password)) return 'Пароль може містити лише латинські й українські літери та цифри.';
  return '';
}

function validateNickname(nickname) {
  if (!nickname) return 'Введіть псевдонім.';
  if (nickname.length > 15) return 'Псевдонім не може перевищувати 15 символів.';
  if (!NICKNAME_REGEX.test(nickname)) {
    return 'Дозволені лише латинські літери (A–Z, a–z) та нижнє підкреслення (_) без пробілів.';
  }
  return '';
}

function validateEmail(email) {
  if (!email) return 'Введіть електронну пошту.';
  if (!EMAIL_REGEX.test(email)) return 'Введіть коректну адресу пошти (наприклад, user@gmail.com).';
  return '';
}

// Хешування пароля перед записом у поле password_hash (SHA-256)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Збереження сесії користувача ("Запам'ятати мене" -> localStorage, інакше -> sessionStorage)
function saveUserSession(user, rememberMe) {
  const sessionData = JSON.stringify({
    id_user: user.id_user,
    nickname: user.nickname,
    email: user.email,
  });

  localStorage.removeItem('hachok_user');
  sessionStorage.removeItem('hachok_user');

  if (rememberMe) {
    localStorage.setItem('hachok_user', sessionData);
  } else {
    sessionStorage.setItem('hachok_user', sessionData);
  }
}

function setFieldError(inputId, errorId, message) {
  const input = document.getElementById(inputId);
  const errorEl = document.getElementById(errorId);
  if (!input || !errorEl) return;

  if (message) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    input.classList.add('border-red-700');
  } else {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
    input.classList.remove('border-red-700');
  }
}

function showFormStatus(statusId, message, isSuccess = false) {
  const box = document.getElementById(statusId);
  if (!box) return;

  box.textContent = message;
  box.classList.remove('hidden', 'bg-red-100', 'border-red-700', 'text-red-800', 'bg-green-100', 'border-green-800', 'text-green-900');

  if (isSuccess) {
    box.classList.add('bg-green-100', 'border-green-800', 'text-green-900');
  } else {
    box.classList.add('bg-red-100', 'border-red-700', 'text-red-800');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Якщо користувач уже авторизований ("Запам'ятати мене"), підставляємо його пошту у форму входу
  const savedUserRaw = localStorage.getItem('hachok_user') || sessionStorage.getItem('hachok_user');
  if (savedUserRaw) {
    try {
      const savedUser = JSON.parse(savedUserRaw);
      const loginEmailInput = document.getElementById('login-email');
      const rememberCheckbox = document.getElementById('remember-me');
      if (loginEmailInput && savedUser.email) loginEmailInput.value = savedUser.email;
      if (rememberCheckbox && localStorage.getItem('hachok_user')) rememberCheckbox.checked = true;
    } catch (_) {}
  }

  // ==========================================
  // 1. РЕЄСТРАЦІЯ КОРИСТУВАЧА -> таблиця user_
  // ==========================================
  const registerForm = document.getElementById('register-form');
  const regNickname = document.getElementById('reg-nickname');
  const regEmail = document.getElementById('reg-email');
  const regPassword = document.getElementById('reg-password');

  // Жива валідація при введенні
  regNickname?.addEventListener('input', () => {
    setFieldError('reg-nickname', 'reg-nickname-error', validateNickname(regNickname.value.trim()));
  });
  regEmail?.addEventListener('input', () => {
    setFieldError('reg-email', 'reg-email-error', validateEmail(regEmail.value.trim()));
  });
  regPassword?.addEventListener('input', () => {
    setFieldError('reg-password', 'reg-password-error', validatePassword(regPassword.value));
  });

  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nickname = regNickname.value.trim();
    const email = regEmail.value.trim().toLowerCase();
    const password = regPassword.value;

    const nickErr = validateNickname(nickname);
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);

    setFieldError('reg-nickname', 'reg-nickname-error', nickErr);
    setFieldError('reg-email', 'reg-email-error', emailErr);
    setFieldError('reg-password', 'reg-password-error', passErr);

    if (nickErr || emailErr || passErr) return;

    const submitBtn = document.getElementById('register-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'СТВОРЕННЯ АКАУНТУ...';

    try {
      // Перевіряємо, чи не зайняті пошта або псевдонім
      const { data: existingUsers, error: checkError } = await supabaseClient
        .from('user_')
        .select('email, nickname')
        .or(`email.eq.${email},nickname.eq.${nickname}`);

      if (checkError) throw checkError;

      if (existingUsers && existingUsers.length > 0) {
        const emailTaken = existingUsers.some((u) => u.email === email);
        const nickTaken = existingUsers.some((u) => u.nickname === nickname);
        if (emailTaken) setFieldError('reg-email', 'reg-email-error', 'Ця електронна пошта вже зареєстрована.');
        if (nickTaken) setFieldError('reg-nickname', 'reg-nickname-error', 'Цей псевдонім уже зайнятий.');
        return;
      }

      const passwordHash = await hashPassword(password);

      const { data: newUser, error: insertError } = await supabaseClient
        .from('user_')
        .insert([
          {
            nickname: nickname,
            email: email,
            password_hash: passwordHash,
          },
        ])
        .select('id_user, nickname, email')
        .single();

      if (insertError) throw insertError;

      saveUserSession(newUser, true);
      showFormStatus('register-status', `Акаунт ${newUser.nickname} успішно створено! Переходимо в кабінет...`, true);

      setTimeout(() => {
        window.location.href = 'profile.html';
      }, 1000);
    } catch (err) {
      console.error('Помилка реєстрації:', err);
      showFormStatus('register-status', 'Не вдалося створити акаунт. Перевірте підключення до бази даних.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'СТВОРИТИ АКАУНТ';
    }
  });

  // ==========================================
  // 2. ВХІД В АКАУНТ + "ЗАПАМ'ЯТАТИ МЕНЕ"
  // ==========================================
  const loginForm = document.getElementById('login-form');
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me').checked;

    const emailErr = validateEmail(email);
    const passErr = password ? '' : 'Введіть пароль.';

    setFieldError('login-email', 'login-email-error', emailErr);
    setFieldError('login-password', 'login-password-error', passErr);

    if (emailErr || passErr) return;

    const submitBtn = document.getElementById('login-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'ВХІД...';

    try {
      const passwordHash = await hashPassword(password);

      const { data: user, error } = await supabaseClient
        .from('user_')
        .select('id_user, nickname, email, password_hash')
        .eq('email', email)
        .maybeSingle();

      if (error) throw error;

      if (!user || user.password_hash !== passwordHash) {
        showFormStatus('login-status', 'Невірна електронна пошта або пароль.');
        return;
      }

      saveUserSession(user, rememberMe);
      showFormStatus('login-status', `Вітаємо, ${user.nickname || user.email}! Вхід виконано.`, true);

      setTimeout(() => {
        window.location.href = 'profile.html';
      }, 800);
    } catch (err) {
      console.error('Помилка входу:', err);
      showFormStatus('login-status', 'Помилка під час входу. Спробуйте ще раз.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'УВІЙТИ У КАБІНЕТ';
    }
  });

  // ==========================================
  // 3. ВІДНОВЛЕННЯ ПАРОЛЯ ("ЗАБУЛИ ПАРОЛЬ?")
  // ==========================================
  const forgotModal = document.getElementById('forgot-modal');
  const openForgotBtn = document.getElementById('forgot-password-btn');
  const closeForgotBtn = document.getElementById('close-forgot-modal');
  const forgotForm = document.getElementById('forgot-form');

  openForgotBtn?.addEventListener('click', () => {
    forgotModal.classList.remove('hidden');
    forgotModal.classList.add('flex');
  });

  closeForgotBtn?.addEventListener('click', () => {
    forgotModal.classList.add('hidden');
    forgotModal.classList.remove('flex');
  });

  forgotModal?.addEventListener('click', (e) => {
    if (e.target === forgotModal) {
      forgotModal.classList.add('hidden');
      forgotModal.classList.remove('flex');
    }
  });

  forgotForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('forgot-email').value.trim().toLowerCase();
    const nickname = document.getElementById('forgot-nickname').value.trim();
    const newPassword = document.getElementById('forgot-new-password').value;

    const emailErr = validateEmail(email);
    const nickErr = validateNickname(nickname);
    const passErr = validatePassword(newPassword);

    setFieldError('forgot-email', 'forgot-email-error', emailErr);
    setFieldError('forgot-nickname', 'forgot-nickname-error', nickErr);
    setFieldError('forgot-new-password', 'forgot-new-password-error', passErr);

    if (emailErr || nickErr || passErr) return;

    const submitBtn = document.getElementById('forgot-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'ОНОВЛЕННЯ...';

    try {
      const { data: user, error: findError } = await supabaseClient
        .from('user_')
        .select('id_user, email, nickname')
        .eq('email', email)
        .eq('nickname', nickname)
        .maybeSingle();

      if (findError) throw findError;

      if (!user) {
        showFormStatus('forgot-status', 'Користувача з такою поштою та псевдонімом не знайдено.');
        return;
      }

      const newHash = await hashPassword(newPassword);

      const { error: updateError } = await supabaseClient
        .from('user_')
        .update({ password_hash: newHash })
        .eq('id_user', user.id_user);

      if (updateError) throw updateError;

      showFormStatus('forgot-status', 'Пароль успішно змінено! Тепер ви можете увійти з новим паролем.', true);
      document.getElementById('login-email').value = email;

      setTimeout(() => {
        forgotModal.classList.add('hidden');
        forgotModal.classList.remove('flex');
        forgotForm.reset();
      }, 1500);
    } catch (err) {
      console.error('Помилка відновлення пароля:', err);
      showFormStatus('forgot-status', 'Не вдалося оновити пароль. Спробуйте ще раз.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'ЗБЕРЕГТИ НОВИЙ ПАРОЛЬ';
    }
  });
});