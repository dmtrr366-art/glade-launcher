/**
 * Authentication API Routes
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const paths = require('../paths');
const mailer = require('../mailer');

const router = express.Router();

// Папки для хранения файлов (из paths.js)
const SKINS_DIR = paths.SKINS_DIR;
const CAPES_DIR = paths.CAPES_DIR;
const AVATARS_DIR = paths.AVATARS_DIR;
const BANNERS_DIR = paths.BANNERS_DIR;
const WALLPAPERS_DIR = paths.WALLPAPERS_DIR;

// Фильтр для картинок (png, jpg, jpeg, webp, gif)
const imageFileFilter = (req, file, cb) => {
  const allowed = /\.(png|jpg|jpeg|webp|gif)$/i;
  if (allowed.test(file.originalname) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Разрешены только файлы изображений (.png, .jpg, .jpeg, .webp, .gif)'));
  }
};

// Мультер для аватарок
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATARS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const cleanNick = (req.user && req.user.username ? req.user.username : 'player').replace(/[^a-zA-Z0-9_]/g, '_');
    cb(null, `avatar-${cleanNick}-${Date.now()}${ext}`);
  }
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: imageFileFilter
});

// Мультер для баннеров
const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, BANNERS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const cleanNick = (req.user && req.user.username ? req.user.username : 'player').replace(/[^a-zA-Z0-9_]/g, '_');
    cb(null, `banner-${cleanNick}-${Date.now()}${ext}`);
  }
});
const uploadBanner = multer({
  storage: bannerStorage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: imageFileFilter
});

// Мультер для обоев лаунчера
const wallpaperStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, WALLPAPERS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const cleanNick = (req.user && req.user.username ? req.user.username : 'player').replace(/[^a-zA-Z0-9_]/g, '_');
    cb(null, `wall-${cleanNick}-${Date.now()}${ext}`);
  }
});
const uploadWallpaper = multer({
  storage: wallpaperStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: imageFileFilter
});

// Настройка multer для скинов
const skinStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, SKINS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const cleanNick = (req.user && req.user.username ? req.user.username : 'player').replace(/[^a-zA-Z0-9_]/g, '_');
    cb(null, `${cleanNick}-${Date.now()}${ext}`);
  }
});
const uploadSkin = multer({
  storage: skinStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png' || file.originalname.toLowerCase().endsWith('.png')) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только файлы скина в формате .png'));
    }
  }
});

// Настройка multer для плащей
const capeStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CAPES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const cleanNick = (req.user && req.user.username ? req.user.username : 'player').replace(/[^a-zA-Z0-9_]/g, '_');
    cb(null, `cape-${cleanNick}-${Date.now()}${ext}`);
  }
});
const uploadCape = multer({
  storage: capeStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png' || file.originalname.toLowerCase().endsWith('.png')) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только файлы плаща в формате .png'));
    }
  }
});

// Генерация 6-значного числового кода
function generate6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Маскирование почты (a***r@mail.com)
function maskEmail(email) {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  if (name.length <= 2) return `${name[0]}*@${domain}`;
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

// Middleware проверки авторизации по токену
function requireAuth(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers['x-user-id']) {
    token = req.headers['x-user-id'];
  } else if (req.headers['x-username']) {
    token = req.headers['x-username'];
  }

  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: 'Требуется авторизация.' });
  }

  let session = db.getSession(token);
  let user = null;
  if (session) {
    user = db.findUserById(session.userId);
  }
  if (!user && token) {
    user = db.findUserById(token) || (db.getUsers() || []).find(u => 
      (u.username && u.username.toLowerCase() === token.toLowerCase()) || 
      (u.email && u.email.toLowerCase() === token.toLowerCase()) || 
      u.id === token
    );
    if (user) {
      if (!db.data.sessions) db.data.sessions = {};
      db.data.sessions[token] = { userId: user.id, createdAt: new Date().toISOString() };
      db._saveData();
    }
  }

  if (!user) {
    return res.status(401).json({ error: 'Сессия недействительна или устарела.' });
  }

  // Проверка бана
  if (user.isBanned) {
    return res.status(403).json({
      error: 'Ваш аккаунт заблокирован администратором.',
      isBanned: true,
      banReason: user.banReason || 'Нарушение правил проекта',
      bannedAt: user.bannedAt
    });
  }

  // Обновляем онлайн статус пользователя
  db.touchUser(user.id);

  req.user = user;
  req.token = token;
  next();
}

/* =========================================================================
   1. Регистрация нового аккаунта с обязательным Email
========================================================================= */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Заполните все обязательные поля.' });
    }

    const cleanUser = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!/^[a-zA-Z0-9_]{3,16}$/.test(cleanUser)) {
      return res.status(400).json({ error: 'Имя пользователя: от 3 до 16 символов (латиница, цифры, «_»).' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Введите корректный адрес электронной почты.' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 4 символа.' });
    }

    if (db.findUserByUsername(cleanUser)) {
      return res.status(409).json({ error: 'Пользователь с таким логином уже существует.' });
    }

    if (db.findUserByEmail(cleanEmail)) {
      return res.status(409).json({ error: 'Пользователь с таким email уже зарегистрирован.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = db.createUser({
      username: cleanUser,
      email: cleanEmail,
      passwordHash
    });

    // Генерируем код для первого входа
    const code = generate6DigitCode();
    db.saveVerificationCode(cleanEmail, code, 'login', 10);
    const mailResult = await mailer.sendLoginCode(cleanEmail, code);

    res.status(201).json({
      success: true,
      message: 'Регистрация успешна! Код подтверждения отправлен на почту.',
      email: cleanEmail,
      devCode: mailResult.devCode || null
    });
  } catch (err) {
    console.error('[Register Error]', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера при регистрации.' });
  }
});

/* =========================================================================
   2. Шаг 1 входа: проверка логина/email и пароля + отправка кода на почту
========================================================================= */
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Введите логин/email и пароль.' });
    }

    const user = db.findUserByIdentifier(identifier);
    if (!user) {
      return res.status(401).json({ error: 'Неверный логин или пароль.' });
    }

    // Проверка бана до отправки кода
    if (user.isBanned) {
      return res.status(403).json({
        error: 'Ваш аккаунт заблокирован администратором.',
        isBanned: true,
        banReason: user.banReason || 'Нарушение правил проекта',
        bannedAt: user.bannedAt
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Неверный логин или пароль.' });
    }

    // Генерируем 6-значный код подтверждения
    const code = generate6DigitCode();
    db.saveVerificationCode(user.email, code, 'login', 10);
    const mailResult = await mailer.sendLoginCode(user.email, code);

    res.json({
      success: true,
      message: 'Код подтверждения отправлен на вашу почту.',
      email: user.email,
      maskedEmail: maskEmail(user.email),
      devCode: mailResult.devCode || null
    });
  } catch (err) {
    console.error('[Login Error]', err);
    res.status(500).json({ error: 'Ошибка сервера при авторизации.' });
  }
});

/* =========================================================================
   3. Шаг 2 входа: проверка кода подтверждения и выдача сессии
========================================================================= */
router.post('/verify-login', (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Укажите email и код подтверждения.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const stored = db.getVerificationCode(cleanEmail, 'login');

    if (!stored) {
      return res.status(400).json({ error: 'Код подтверждения не найден или истек. Запросите код заново.' });
    }

    if (stored.code !== code.toString().trim()) {
      return res.status(400).json({ error: 'Неверный код подтверждения.' });
    }

    db.deleteVerificationCode(cleanEmail);

    const user = db.findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден.' });
    }

    if (user.isBanned) {
      return res.status(403).json({
        error: 'Ваш аккаунт заблокирован администратором.',
        isBanned: true,
        banReason: user.banReason || 'Нарушение правил проекта',
        bannedAt: user.bannedAt
      });
    }

    // Создаем сессию и обновляем онлайн
    const token = db.createSession(user.id);
    db.touchUser(user.id);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'user',
        isBanned: user.isBanned || false,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error('[Verify Login Error]', err);
    res.status(500).json({ error: 'Ошибка проверки кода.' });
  }
});

/* =========================================================================
   4. Повторная отправка кода
========================================================================= */
router.post('/resend-code', async (req, res) => {
  try {
    const { email, type = 'login' } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Укажите email.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь с такой почтой не найден.' });
    }

    const code = generate6DigitCode();
    db.saveVerificationCode(cleanEmail, code, type, 10);

    let mailResult;
    if (type === 'reset') {
      mailResult = await mailer.sendPasswordResetCode(cleanEmail, code);
    } else {
      mailResult = await mailer.sendLoginCode(cleanEmail, code);
    }

    res.json({
      success: true,
      message: 'Новый код отправлен на почту.',
      devCode: mailResult.devCode || null
    });
  } catch (err) {
    console.error('[Resend Code Error]', err);
    res.status(500).json({ error: 'Ошибка отправки кода.' });
  }
});

/* =========================================================================
   5. Шаг 1 сброса пароля: отправка кода восстановления
========================================================================= */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Укажите email.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.findUserByEmail(cleanEmail);

    if (!user) {
      return res.status(404).json({ error: 'Пользователь с указанной почтой не найден.' });
    }

    const code = generate6DigitCode();
    db.saveVerificationCode(cleanEmail, code, 'reset', 10);
    const mailResult = await mailer.sendPasswordResetCode(cleanEmail, code);

    res.json({
      success: true,
      message: 'Код для восстановления пароля отправлен на почту.',
      email: cleanEmail,
      maskedEmail: maskEmail(cleanEmail),
      devCode: mailResult.devCode || null
    });
  } catch (err) {
    console.error('[Forgot Password Error]', err);
    res.status(500).json({ error: 'Ошибка восстановления пароля.' });
  }
});

/* =========================================================================
   6. Шаг 2 сброса пароля: проверка кода и сохранение нового пароля
========================================================================= */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Заполните все поля.' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 4 символа.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const stored = db.getVerificationCode(cleanEmail, 'reset');

    if (!stored) {
      return res.status(400).json({ error: 'Код сброса не найден или истек.' });
    }

    if (stored.code !== code.toString().trim()) {
      return res.status(400).json({ error: 'Неверный код подтверждения.' });
    }

    db.deleteVerificationCode(cleanEmail);

    const user = db.findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    db.updateUser(user.id, { passwordHash });

    // Сразу авторизуем после успешного сброса
    const token = db.createSession(user.id);
    db.touchUser(user.id);

    res.json({
      success: true,
      message: 'Пароль успешно изменен!',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'user'
      }
    });
  } catch (err) {
    console.error('[Reset Password Error]', err);
    res.status(500).json({ error: 'Ошибка смены пароля.' });
  }
});

/* =========================================================================
   7. Текущий пользователь и профиль
========================================================================= */
router.get('/me', requireAuth, (req, res) => {
  // Определяем дефолтные скины/плащи если еще не назначены
  let skinUrl = req.user.skinUrl;
  let capeUrl = req.user.capeUrl;
  let modelType = req.user.modelType || 'default';

  if (!skinUrl) {
    if (req.user.username.toLowerCase() === 'lorsik' || req.user.username.toLowerCase() === 'lors1k_') {
      skinUrl = '/assets/skins/Lors1k_.png';
    } else {
      skinUrl = '/assets/skins/default.png';
    }
  }

  if (capeUrl === undefined) {
    if (req.user.username.toLowerCase() === 'lorsik' || req.user.username.toLowerCase() === 'lors1k_') {
      capeUrl = '/assets/capes/Lors1k_.png';
    } else {
      capeUrl = '/assets/capes/default.png';
    }
  }

  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role || 'user',
      isBanned: req.user.isBanned || false,
      banReason: req.user.banReason || '',
      bannedAt: req.user.bannedAt || null,
      lastSeenAt: req.user.lastSeenAt,
      createdAt: req.user.createdAt,
      skinUrl: skinUrl,
      capeUrl: capeUrl,
      modelType: modelType,
      avatarUrl: req.user.avatarUrl || null,
      bannerUrl: req.user.bannerUrl || null,
      heroUrl: req.user.heroUrl || null,
      wallpaperUrl: req.user.wallpaperUrl || null,
      customization: req.user.customization || {}
    }
  });
});

/* =========================================================================
   8. Heartbeat (онлайн статус и проверка состояния пользователя)
========================================================================= */
router.post('/heartbeat', requireAuth, (req, res) => {
  res.json({
    ok: true,
    online: true,
    role: req.user.role || 'user',
    isBanned: req.user.isBanned || false,
    timestamp: new Date().toISOString()
  });
});

// Запрет смены никнейма в профиле (ник задается строго при регистрации)
router.post('/update-profile', requireAuth, (req, res) => {
  return res.status(400).json({
    error: 'Никнейм указывается при регистрации и не подлежит изменению.'
  });
});

/* =========================================================================
   9. Управление 3D скином и плащом игрока
========================================================================= */
router.post('/upload-skin', requireAuth, (req, res) => {
  uploadSkin.single('skin')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Ошибка загрузки файла скина.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Выберите файл скина (.png).' });
    }
    const skinUrl = `/uploads/skins/${req.file.filename}`;
    const model = req.body && req.body.model === 'slim' ? 'slim' : 'default';
    db.updateUser(req.user.id, { skinUrl, modelType: model });
    res.json({
      success: true,
      message: 'Скин успешно загружен и сохранен!',
      skinUrl,
      modelType: model
    });
  });
});

router.post('/upload-cape', requireAuth, (req, res) => {
  uploadCape.single('cape')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Ошибка загрузки файла плаща.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Выберите файл плаща (.png).' });
    }
    const capeUrl = `/uploads/capes/${req.file.filename}`;
    db.updateUser(req.user.id, { capeUrl });
    res.json({
      success: true,
      message: 'Плащ успешно загружен!',
      capeUrl
    });
  });
});

router.post('/skin-model', requireAuth, (req, res) => {
  const model = req.body && req.body.model === 'slim' ? 'slim' : 'default';
  db.updateUser(req.user.id, { modelType: model });
  res.json({ success: true, modelType: model });
});

router.post('/reset-skin', requireAuth, (req, res) => {
  const defaultSkin = '/assets/skins/default.png';
  db.updateUser(req.user.id, { skinUrl: defaultSkin });
  res.json({ success: true, skinUrl: defaultSkin, message: 'Скин сброшен к стандартному' });
});

router.post('/reset-cape', requireAuth, (req, res) => {
  db.updateUser(req.user.id, { capeUrl: null });
  res.json({ success: true, capeUrl: null, message: 'Плащ снят' });
});

/* =========================================================================
   10. Кастомизация оформления (аватарка, баннер, обои, тема)
========================================================================= */
router.post('/upload-avatar', requireAuth, (req, res) => {
  uploadAvatar.single('avatar')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Ошибка загрузки аватара.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Выберите файл изображения.' });
    }
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const cust = req.user.customization || {};
    cust.avatarUrl = avatarUrl;
    cust.avatarType = 'custom';
    db.updateUser(req.user.id, { avatarUrl, customization: cust });
    res.json({
      success: true,
      message: 'Аватар успешно обновлен!',
      avatarUrl
    });
  });
});

router.post('/upload-hero', requireAuth, (req, res) => {
  uploadBanner.single('hero')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Ошибка загрузки фона.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Выберите файл изображения.' });
    }
    const heroUrl = `/uploads/banners/${req.file.filename}`;
    const cust = req.user.customization || {};
    cust.heroUrl = heroUrl;
    cust.heroPreset = 'custom';
    db.updateUser(req.user.id, { heroUrl, customization: cust });
    res.json({
      success: true,
      message: 'Главный фон успешно обновлен!',
      heroUrl
    });
  });
});

router.post('/upload-banner', requireAuth, (req, res) => {
  uploadBanner.single('banner')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Ошибка загрузки баннера.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Выберите файл изображения.' });
    }
    const bannerUrl = `/uploads/banners/${req.file.filename}`;
    const cust = req.user.customization || {};
    cust.bannerUrl = bannerUrl;
    cust.bannerPreset = 'custom';
    db.updateUser(req.user.id, { bannerUrl, customization: cust });
    res.json({
      success: true,
      message: 'Фон баннера успешно обновлен!',
      bannerUrl
    });
  });
});

router.post('/upload-wallpaper', requireAuth, (req, res) => {
  uploadWallpaper.single('wallpaper')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Ошибка загрузки фона.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Выберите файл изображения.' });
    }
    const wallpaperUrl = `/uploads/wallpapers/${req.file.filename}`;
    const cust = req.user.customization || {};
    cust.wallpaperUrl = wallpaperUrl;
    cust.wallpaperPreset = 'custom';
    db.updateUser(req.user.id, { wallpaperUrl, customization: cust });
    res.json({
      success: true,
      message: 'Общий фон лаунчера успешно обновлен!',
      wallpaperUrl
    });
  });
});

router.post('/customization', requireAuth, (req, res) => {
  const currentCust = req.user.customization || {};
  const newCust = Object.assign({}, currentCust, req.body || {});
  
  const updates = { customization: newCust };
  if (newCust.avatarUrl !== undefined) updates.avatarUrl = newCust.avatarUrl;
  if (newCust.bannerUrl !== undefined) updates.bannerUrl = newCust.bannerUrl;
  if (newCust.heroUrl !== undefined) updates.heroUrl = newCust.heroUrl;
  
  db.updateUser(req.user.id, updates);
  res.json({
    success: true,
    message: 'Настройки оформления сохранены!',
    customization: newCust
  });
});

router.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    db.deleteSession(token);
  }
  res.json({ success: true, message: 'Вы вышли из системы.' });
});

router.requireAuth = requireAuth;
module.exports = router;
