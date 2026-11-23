/**
 * Клієнтська валідація форми зворотного зв'язку
 * Проєкт: «Генерал Гачок» (Лабораторна робота №9)
 */

// 1. КОНФІГУРАЦІЯ ТА РЕГУЛЯРНІ ВИРАЗИ (RegEx)
const REGEX_NAME = /^[a-zA-Zа-яА-ЯіІїЇєЄґҐ'’-\s]{2,}$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REGEX_PHONE = /^\+380\d{9}$/;
const REGEX_LOCAL_UA_PHONE = /^0\d{9}$/;

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('feedbackForm');
  if (!form) return;

  // Елементи полів форми
  const fields = {
    username: document.getElementById('username'),
    email: document.getElementById('email'),
    phone: document.getElementById('phone'),
    message: document.getElementById('message'),
    agreement: document.getElementById('agreement'),
  };

  // Елементи повідомлень про помилки
  const errors = {
    username: document.getElementById('usernameError'),
    email: document.getElementById('emailError'),
    phone: document.getElementById('phoneError'),
    message: document.getElementById('messageError'),
    agreement: document.getElementById('agreementError'),
  };

  // Допоміжні UI-елементи
  const phoneFixBtn = document.getElementById('phoneFixBtn');
  const messageCounter = document.getElementById('messageCounter');
  const successModal = document.getElementById('successModal');
  const closeModalBtn = document.getElementById('closeModalBtn');

  // Відстеження полів, з якими користувач уже взаємодіяв
  const touched = {
    username: false,
    email: false,
    phone: false,
    message: false,
    agreement: false,
  };

  let lastFocusedElement = null;

  // 2. ФУНКЦІЇ КЕРУВАННЯ UI-СТАНАМИ (Normal / Error / Success)

  function showError(input, errorEl, message) {
    input.classList.remove('border-hachok-dark', 'border-green-500', 'ring-1', 'ring-green-500');
    input.classList.add('border-red-500', 'ring-1', 'ring-red-500');
    input.setAttribute('aria-invalid', 'true');

    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
  }

  function showSuccess(input, errorEl) {
    input.classList.remove('border-hachok-dark', 'border-red-500', 'ring-1', 'ring-red-500');
    input.classList.add('border-green-500', 'ring-1', 'ring-green-500');
    input.setAttribute('aria-invalid', 'false');

    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }
  }

  function clearError(input, errorEl) {
    input.classList.remove('border-red-500', 'border-green-500', 'ring-1', 'ring-red-500', 'ring-green-500');
    input.classList.add('border-hachok-dark');
    input.setAttribute('aria-invalid', 'false');

    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }
  }

  // 3. ОКРЕМІ ФУНКЦІЇ ВАЛІДАЦІЇ ПОЛІВ

  function validateName() {
    const value = fields.username.value.trim();

    if (value.length === 0) {
      showError(fields.username, errors.username, "Введіть ваше ім'я.");
      return false;
    }
    if (value.length < 2) {
      showError(fields.username, errors.username, "Ім'я повинно містити щонайменше 2 символи.");
      return false;
    }
    if (!REGEX_NAME.test(value)) {
      showError(fields.username, errors.username, "Ім'я може містити лише літери, пробіл, дефіс або апостроф.");
      return false;
    }

    showSuccess(fields.username, errors.username);
    return true;
  }

  function validateEmail() {
    const value = fields.email.value.trim();

    if (value.length === 0) {
      showError(fields.email, errors.email, 'Введіть електронну пошту.');
      return false;
    }
    if (!REGEX_EMAIL.test(value)) {
      showError(fields.email, errors.email, 'Введіть коректну електронну адресу (наприклад: user@gmail.com).');
      return false;
    }

    showSuccess(fields.email, errors.email);
    return true;
  }

  function validatePhone() {
    const value = fields.phone.value.trim();
    phoneFixBtn.classList.add('hidden');

    if (value.length === 0) {
      showError(fields.phone, errors.phone, 'Введіть номер телефону у форматі +380XXXXXXXXX.');
      return false;
    }

    // UX-підказка для Edge Case: якщо введено 0XXXXXXXXX (без +38)
    if (REGEX_LOCAL_UA_PHONE.test(value)) {
      const formatted = `+38${value}`;
      showError(fields.phone, errors.phone, 'Номер повинен починатися з +380 (без пробілів та дужок).');
      phoneFixBtn.textContent = `Замінити на ${formatted}`;
      phoneFixBtn.dataset.suggested = formatted;
      phoneFixBtn.classList.remove('hidden');
      return false;
    }

    if (!REGEX_PHONE.test(value)) {
      showError(
        fields.phone,
        errors.phone,
        'Некоректний формат. Введіть +380 та рівно 9 цифр без пробілів (наприклад: +380501234567).'
      );
      return false;
    }

    showSuccess(fields.phone, errors.phone);
    return true;
  }

  function validateMessage() {
    const value = fields.message.value.trim();

    if (value.length === 0) {
      showError(fields.message, errors.message, 'Напишіть текст повідомлення.');
      return false;
    }
    if (value.length < 10) {
      showError(
        fields.message,
        errors.message,
        `Повідомлення занадто коротке (зараз ${value.length} симв., потрібно щонайменше 10).`
      );
      return false;
    }

    showSuccess(fields.message, errors.message);
    return true;
  }

  function validateAgreement() {
    if (!fields.agreement.checked) {
      fields.agreement.setAttribute('aria-invalid', 'true');
      errors.agreement.textContent = 'Необхідно погодитися з політикою конфіденційності.';
      errors.agreement.classList.remove('hidden');
      return false;
    }

    fields.agreement.setAttribute('aria-invalid', 'false');
    errors.agreement.textContent = '';
    errors.agreement.classList.add('hidden');
    return true;
  }

  // 4. ДИНАМІЧНА ВАЛІДАЦІЯ (blur та input)

  const validators = {
    username: validateName,
    email: validateEmail,
    phone: validatePhone,
    message: validateMessage,
    agreement: validateAgreement,
  };

  Object.keys(fields).forEach((key) => {
    const input = fields[key];
    const eventName = key === 'agreement' ? 'change' : 'blur';

    input.addEventListener(eventName, () => {
      touched[key] = true;
      validators[key]();
    });

    if (key !== 'agreement') {
      input.addEventListener('input', () => {
        // Оновлюємо лічильник символів для повідомлення
        if (key === 'message' && messageCounter) {
          const len = input.value.trim().length;
          messageCounter.textContent = `${len} / мін. 10 символів`;
        }

        // Валідуємо в реальному часі після першої взаємодії з полем
        if (touched[key]) {
          validators[key]();
        }
      });
    }
  });

  // Обробка кліку по UX-підказці форматування номера телефону
  if (phoneFixBtn) {
    phoneFixBtn.addEventListener('click', () => {
      if (phoneFixBtn.dataset.suggested) {
        fields.phone.value = phoneFixBtn.dataset.suggested;
        touched.phone = true;
        validatePhone();
        fields.phone.focus();
      }
    });
  }

  // 5. МОДАЛЬНЕ ВІКНО ТА ДОСТУПНІСТЬ З КЛАВІАТУРИ

  function openSuccessModal() {
    lastFocusedElement = document.activeElement;
    successModal.classList.remove('hidden');
    closeModalBtn.focus();
  }

  function closeSuccessModal() {
    successModal.classList.add('hidden');
    if (lastFocusedElement) {
      lastFocusedElement.focus();
    }
  }

  closeModalBtn.addEventListener('click', closeSuccessModal);

  successModal.addEventListener('click', (event) => {
    if (event.target === successModal) {
      closeSuccessModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !successModal.classList.contains('hidden')) {
      closeSuccessModal();
    }
  });

  // 6. ОБРОБКА ПОДІЇ SUBMIT ТА РЕАЛЬНА ВІДПРАВКА НА ПОШТУ

  const submitBtn = form.querySelector('button[type="submit"]');
  const topicSelect = document.getElementById('topic');
  const modalDesc = document.getElementById('modalDesc');

  function resetFormState() {
    form.reset();
    Object.keys(fields).forEach((key) => {
      touched[key] = false;
      clearError(fields[key], errors[key]);
    });
    if (phoneFixBtn) {
      phoneFixBtn.classList.add('hidden');
    }
    if (messageCounter) {
      messageCounter.textContent = '0 / мін. 10 символів';
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    Object.keys(touched).forEach((key) => {
      touched[key] = true;
    });

    const isNameValid = validateName();
    const isEmailValid = validateEmail();
    const isPhoneValid = validatePhone();
    const isMessageValid = validateMessage();
    const isAgreementValid = validateAgreement();

    const isFormValid =
      isNameValid &&
      isEmailValid &&
      isPhoneValid &&
      isMessageValid &&
      isAgreementValid;

    if (!isFormValid) {
      const firstInvalid = Object.keys(fields).find(
        (key) => fields[key].getAttribute('aria-invalid') === 'true'
      );
      if (firstInvalid) {
        fields[firstInvalid].focus();
      }
      return;
    }

    // Блокуємо кнопку на час відправки, щоб уникнути подвійного кліку
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'НАДСИЛАННЯ...';

    try {
      const response = await fetch('https://formsubmit.co/ajax/2dwhpdalek.dentist3@gmail.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          _subject: 'Нове повідомлення з сайту «Генерал Гачок»',
          _template: 'table',
          Імя: fields.username.value.trim(),
          Email: fields.email.value.trim(),
          Телефон: fields.phone.value.trim(),
          Тема: topicSelect ? topicSelect.options[topicSelect.selectedIndex].text : 'Загальне питання',
          Повідомлення: fields.message.value.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Помилка сервера при відправці');
      }

      if (modalDesc) {
        modalDesc.textContent = 'Ми отримали ваше повідомлення та відповімо на вказану електронну пошту найближчим часом.';
      }

      resetFormState();
      openSuccessModal();
    } catch (error) {
      console.error('[Feedback Submit Error]:', error);
      alert('Не вдалося надіслати повідомлення. Перевірте підключення до інтернету та спробуйте ще раз.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });
});