/**
 * Glade Auth Client Module
 * Взаимодействует с Node.js бэкендом (/api/auth)
 * Если сервер недоступен (например, открыто через file://), использует fallback на localStorage.
 */

const STORAGE_KEYS = {
  USERS: 'glade_users',
  SESSION: 'glade_session',
  PENDING_CODES: 'glade_pending_codes',
  TOKEN: 'glade_token'
};

// Проверка доступности Node.js бэкенда
let isServerAvailable = null;
async function checkBackend() {
  if (window.location.protocol === 'file:') {
    return false;
  }
  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': 'Bearer test' }
    });
    return res.status !== 404;
  } catch (e) {
    return false;
  }
}

// Хеширование пароля SHA-256 для оффлайн fallback
async function fallbackHash(password) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const AuthDB = {
  // Получить текущую сессию
  getCurrentUser() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSION) || localStorage.getItem('hoplitex_session');
      if (!data) return null;
      const session = JSON.parse(data);
      return session && session.loggedIn ? session : null;
    } catch (e) {
      return null;
    }
  },

  // Установить активную сессию
  setSession(user, token = null) {
    const sessionToken = token || (user && (user.id || user.username));
    const sessionData = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || 'user',
      isBanned: !!user.isBanned,
      token: sessionToken,
      loggedIn: true,
      loginAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionData));
    if (sessionToken) {
      localStorage.setItem(STORAGE_KEYS.TOKEN, sessionToken);
    }
  },

  // Выход из системы
  async logout() {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN) || localStorage.getItem('hoplitex_token');
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (e) {}
    }
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    window.location.href = 'auth.html';
  },

  // Показ плавающего уведомления симулятора почты (если нет реального SMTP)
  notifyIncomingMail(email, code, type) {
    console.log(`%c[Glade Mailer] Письмо на ${email} (${type}): КОД ${code}`, 'color: #ff8a1f; font-weight: bold; font-size: 14px;');

    if (typeof document === 'undefined' || !document.getElementById) return;
    const alertEl = document.getElementById('mailAlert');
    const titleEl = document.getElementById('mailTitle');
    const bodyEl = document.getElementById('mailBody');
    const copyBtn = document.getElementById('mailCopyBtn');

    if (!alertEl || !bodyEl) return;

    const titleText = type === 'login' ? 'Код для входа в аккаунт' : 'Код для восстановления пароля';
    if (titleEl) titleEl.textContent = `Письмо на ${email}`;
    bodyEl.innerHTML = `${titleText}: <b>${code}</b>`;

    alertEl.classList.add('show');

    if (copyBtn) {
      copyBtn.onclick = () => {
        const visibleInputs = [...document.querySelectorAll('.code-input')].filter(el => !el.closest('.hidden'));
        if (visibleInputs.length > 0) {
          visibleInputs[0].value = code;
          visibleInputs[0].focus();
        }
        alertEl.classList.remove('show');
      };
    }

    clearTimeout(this._mailTimer);
    this._mailTimer = setTimeout(() => {
      alertEl.classList.remove('show');
    }, 15000);
  },

  /* ================== РЕГИСТРАЦИЯ ================== */
  async register(username, email, password) {
    const cleanUser = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Пытаемся отправить на Node.js сервер
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, email: cleanEmail, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка регистрации на сервере.');
      }

      if (data.devCode) {
        this.notifyIncomingMail(cleanEmail, data.devCode, 'login');
      }

      return { username: cleanUser, email: cleanEmail };
    } catch (err) {
      if (err.message && !err.message.includes('fetch')) {
        throw err;
      }
      console.warn('[Auth] Node.js сервер не ответил, используем локальную базу localStorage');
      return this._localRegister(cleanUser, cleanEmail, password);
    }
  },

  /* ================== ВХОД: ШАГ 1 ================== */
  async checkCredentialsAndSendCode(identifier, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.isBanned) {
          throw new Error(`🚫 ДОСТУП ЗАБЛОКИРОВАН: ${data.banReason || 'Нарушение правил'}`);
        }
        throw new Error(data.error || 'Неверный логин или пароль.');
      }

      if (data.devCode) {
        this.notifyIncomingMail(data.email, data.devCode, 'login');
      }

      return {
        email: data.email,
        maskedEmail: data.maskedEmail || data.email
      };
    } catch (err) {
      if (err.message && !err.message.includes('fetch')) {
        throw err;
      }
      console.warn('[Auth] Node.js сервер не ответил, используем локальную базу localStorage');
      return this._localCheckCredentials(identifier, password);
    }
  },

  /* ================== ВХОД: ШАГ 2 ================== */
  async completeLoginWithCode(email, code) {
    try {
      const res = await fetch('/api/auth/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Неверный код подтверждения.');
      }

      this.setSession(data.user, data.token);
      return data.user;
    } catch (err) {
      if (err.message && !err.message.includes('fetch')) {
        throw err;
      }
      return this._localVerifyCode(email, code, 'login');
    }
  },

  /* ================== ПОВТОРНЫЙ КОД ================== */
  async resendCode(email, type = 'login') {
    try {
      const res = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка повторной отправки кода.');
      if (data.devCode) {
        this.notifyIncomingMail(email, data.devCode, type);
      }
    } catch (err) {
      if (err.message && !err.message.includes('fetch')) throw err;
      this._localSendCode(email, type);
    }
  },

  /* ================== СБРОС ПАРОЛЯ ================== */
  async requestPasswordReset(email) {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Пользователь не найден.');
      if (data.devCode) {
        this.notifyIncomingMail(data.email, data.devCode, 'reset');
      }
      return data;
    } catch (err) {
      if (err.message && !err.message.includes('fetch')) throw err;
      return this._localForgot(email);
    }
  },

  async completePasswordReset(email, code, newPassword) {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка смены пароля.');
      this.setSession(data.user, data.token);
      return data.user;
    } catch (err) {
      if (err.message && !err.message.includes('fetch')) throw err;
      return this._localReset(email, code, newPassword);
    }
  },

  /* ================== ОФФЛАЙН FALLBACK МЕТОДЫ (LOCALSTORAGE) ================== */
  _localGetUsers() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    } catch (e) { return []; }
  },
  _localSaveUsers(u) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(u));
  },
  _localSendCode(email, type) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    let pending = {};
    try { pending = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.PENDING_CODES) || '{}'); } catch (e) {}
    pending[email.toLowerCase()] = { code, expireAt: Date.now() + 600000, type };
    sessionStorage.setItem(STORAGE_KEYS.PENDING_CODES, JSON.stringify(pending));
    this.notifyIncomingMail(email, code, type);
    return code;
  },
  async _localRegister(username, email, password) {
    const users = this._localGetUsers();
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      throw new Error('Пользователь с таким логином уже существует.');
    }
    if (users.some(u => u.email.toLowerCase() === email)) {
      throw new Error('Пользователь с таким email уже зарегистрирован.');
    }
    const hash = await fallbackHash(password);
    const user = { id: Date.now().toString(), username, email, passwordHash: hash };
    users.push(user);
    this._localSaveUsers(users);
    this._localSendCode(email, 'login');
    return user;
  },
  async _localCheckCredentials(identifier, password) {
    const cleanId = identifier.trim().toLowerCase();
    const users = this._localGetUsers();
    const user = users.find(u => u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId);
    if (!user) throw new Error('Неверный логин или пароль.');
    const hash = await fallbackHash(password);
    if (user.passwordHash !== hash) throw new Error('Неверный логин или пароль.');
    this._localSendCode(user.email, 'login');
    return { email: user.email, maskedEmail: user.email };
  },
  _localVerifyCode(email, inputCode, type) {
    let pending = {};
    try { pending = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.PENDING_CODES) || '{}'); } catch (e) {}
    const item = pending[email.toLowerCase()];
    if (!item || item.type !== type || item.code !== inputCode.trim()) {
      throw new Error('Неверный код подтверждения.');
    }
    delete pending[email.toLowerCase()];
    sessionStorage.setItem(STORAGE_KEYS.PENDING_CODES, JSON.stringify(pending));
    const user = this._localGetUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
    this.setSession(user || { username: 'Игрок', email });
    return user;
  },
  _localForgot(email) {
    const cleanEmail = email.trim().toLowerCase();
    const user = this._localGetUsers().find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) throw new Error('Пользователь с такой почтой не найден.');
    this._localSendCode(user.email, 'reset');
    return { email: user.email, maskedEmail: user.email };
  },
  async _localReset(email, code, newPassword) {
    this._localVerifyCode(email, code, 'reset');
    const users = this._localGetUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      user.passwordHash = await fallbackHash(newPassword);
      this._localSaveUsers(users);
    }
    this.setSession(user || { username: 'Игрок', email });
    return user;
  }
};

window.AuthDB = AuthDB;

/* =========================================================================
   Логика интерфейса auth.html
========================================================================= */
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    // Если уже есть сессия, перенаправляем в лаунчер
    if (AuthDB.getCurrentUser()) {
      window.location.href = 'index.html';
      return;
    }

    const tabsContainer = document.getElementById('authTabs');
    const tabButtons = document.querySelectorAll('.tab');
    const subtitle = document.getElementById('authSubtitle');

    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');
    const forgotSection = document.getElementById('forgotSection');

    const loginCodeForm = document.getElementById('loginCodeForm');
    const loginError = document.getElementById('loginError');
    const loginCodeError = document.getElementById('loginCodeError');
    const loginTargetEmail = document.getElementById('loginTargetEmail');

    const registerForm = document.getElementById('registerForm');
    const regError = document.getElementById('regError');

    const forgotEmailForm = document.getElementById('forgotEmailForm');
    const forgotResetForm = document.getElementById('forgotResetForm');
    const forgotEmailError = document.getElementById('forgotEmailError');
    const forgotResetError = document.getElementById('forgotResetError');
    const forgotTargetEmail = document.getElementById('forgotTargetEmail');

    let currentPendingEmail = null;

    const mailCloseBtn = document.getElementById('mailCloseBtn');
    if (mailCloseBtn) {
      mailCloseBtn.onclick = () => {
        document.getElementById('mailAlert').classList.remove('show');
      };
    }

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        clearErrors();

        loginForm.classList.remove('hidden');
        loginCodeForm.classList.add('hidden');

        if (btn.dataset.tab === 'login') {
          subtitle.textContent = 'Вход и безопасность аккаунта';
          loginSection.classList.remove('hidden');
          registerSection.classList.add('hidden');
          forgotSection.classList.add('hidden');
        } else {
          subtitle.textContent = 'Создайте аккаунт Glade';
          loginSection.classList.add('hidden');
          registerSection.classList.remove('hidden');
          forgotSection.classList.add('hidden');
        }
      });
    });

    function clearErrors() {
      loginError.textContent = '';
      loginCodeError.textContent = '';
      regError.textContent = '';
      forgotEmailError.textContent = '';
      forgotResetError.textContent = '';
    }

    /* ------------------- ВХОД: ШАГ 1 ------------------- */
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.textContent = '';

      const id = document.getElementById('loginIdentifier').value;
      const pass = document.getElementById('loginPass').value;

      try {
        const res = await AuthDB.checkCredentialsAndSendCode(id, pass);
        currentPendingEmail = res.email;

        loginTargetEmail.textContent = res.maskedEmail || res.email;
        loginForm.classList.add('hidden');
        loginCodeForm.classList.remove('hidden');
        document.getElementById('loginCode').value = '';
        document.getElementById('loginCode').focus();
      } catch (err) {
        loginError.textContent = err.message || 'Ошибка входа.';
      }
    });

    /* ------------------- ВХОД: ШАГ 2 ------------------- */
    loginCodeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginCodeError.textContent = '';

      if (!currentPendingEmail) {
        loginCodeError.textContent = 'Сессия устарела. Попробуйте войти заново.';
        return;
      }

      const code = document.getElementById('loginCode').value;
      try {
        await AuthDB.completeLoginWithCode(currentPendingEmail, code);
        window.location.href = 'index.html';
      } catch (err) {
        loginCodeError.textContent = err.message || 'Неверный код.';
      }
    });

    document.getElementById('resendLoginCodeBtn').addEventListener('click', async () => {
      if (currentPendingEmail) {
        loginCodeError.textContent = '';
        try {
          await AuthDB.resendCode(currentPendingEmail, 'login');
        } catch (err) {
          loginCodeError.textContent = err.message || 'Ошибка отправки кода.';
        }
      }
    });

    document.getElementById('backToLoginStep1Btn').addEventListener('click', () => {
      loginCodeForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
      loginCodeError.textContent = '';
    });

    /* ------------------- РЕГИСТРАЦИЯ ------------------- */
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      regError.textContent = '';

      const user = document.getElementById('regUser').value;
      const email = document.getElementById('regEmail').value;
      const pass = document.getElementById('regPass').value;
      const passConfirm = document.getElementById('regPassConfirm').value;

      if (pass !== passConfirm) {
        regError.textContent = 'Пароли не совпадают.';
        return;
      }

      try {
        const res = await AuthDB.register(user, email, pass);
        currentPendingEmail = res.email;

        tabButtons.forEach(b => b.classList.remove('on'));
        document.querySelector('[data-tab="login"]').classList.add('on');
        registerSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
        loginForm.classList.add('hidden');
        loginCodeForm.classList.remove('hidden');

        loginTargetEmail.textContent = res.email;
        document.getElementById('loginCode').value = '';
        document.getElementById('loginCode').focus();
      } catch (err) {
        regError.textContent = err.message || 'Ошибка регистрации.';
      }
    });

    /* ------------------- ВОССТАНОВЛЕНИЕ ПАРОЛЯ ------------------- */
    document.getElementById('toForgotLink').addEventListener('click', (e) => {
      e.preventDefault();
      clearErrors();
      subtitle.textContent = 'Восстановление доступа к аккаунту';
      tabsContainer.classList.add('hidden');
      loginSection.classList.add('hidden');
      registerSection.classList.add('hidden');
      forgotSection.classList.remove('hidden');
      forgotEmailForm.classList.remove('hidden');
      forgotResetForm.classList.add('hidden');
    });

    document.getElementById('backToLoginFromForgotBtn').addEventListener('click', () => {
      clearErrors();
      subtitle.textContent = 'Вход и безопасность аккаунта';
      tabsContainer.classList.remove('hidden');
      forgotSection.classList.add('hidden');
      loginSection.classList.remove('hidden');
      loginForm.classList.remove('hidden');
      loginCodeForm.classList.add('hidden');
    });

    forgotEmailForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      forgotEmailError.textContent = '';

      const email = document.getElementById('forgotEmail').value;
      try {
        const res = await AuthDB.requestPasswordReset(email);
        currentPendingEmail = res.email || email;

        forgotTargetEmail.textContent = res.maskedEmail || res.email || email;
        forgotEmailForm.classList.add('hidden');
        forgotResetForm.classList.remove('hidden');
        document.getElementById('forgotCode').value = '';
        document.getElementById('forgotCode').focus();
      } catch (err) {
        forgotEmailError.textContent = err.message || 'Ошибка отправки кода.';
      }
    });

    forgotResetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      forgotResetError.textContent = '';

      const code = document.getElementById('forgotCode').value;
      const newPass = document.getElementById('forgotNewPass').value;
      const newPassConfirm = document.getElementById('forgotNewPassConfirm').value;

      if (newPass !== newPassConfirm) {
        forgotResetError.textContent = 'Пароли не совпадают.';
        return;
      }

      try {
        await AuthDB.completePasswordReset(currentPendingEmail, code, newPass);
        window.location.href = 'index.html';
      } catch (err) {
        forgotResetError.textContent = err.message || 'Ошибка смены пароля.';
      }
    });

    document.getElementById('resendForgotCodeBtn').addEventListener('click', async () => {
      if (currentPendingEmail) {
        forgotResetError.textContent = '';
        try {
          await AuthDB.resendCode(currentPendingEmail, 'reset');
        } catch (err) {
          forgotResetError.textContent = err.message || 'Ошибка отправки кода.';
        }
      }
    });

    document.getElementById('cancelForgotResetBtn').addEventListener('click', () => {
      document.getElementById('backToLoginFromForgotBtn').click();
    });
  });
}
