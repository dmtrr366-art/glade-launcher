/**
 * Admin Panel API Routes
 * Управление пользователями, блокировками и публикацией модов.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const paths = require('../paths');
const authRoutes = require('./auth');

const router = express.Router();

// Папка для загрузки реальных файлов модов (из paths.js)
const UPLOADS_DIR = paths.MODS_DIR;

// Конфигурация загрузчика Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jar';
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-]/g, '_');
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E4);
    cb(null, `${base}-${unique}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 150 * 1024 * 1024 } // до 150 МБ
});

// Middleware проверки прав администратора
function requireAdmin(req, res, next) {
  authRoutes.requireAuth(req, res, () => {
    if (req.user.role !== 'admin' && req.user.role !== 'head_admin') {
      return res.status(403).json({ error: 'Доступ запрещён: требуются права администратора.' });
    }
    next();
  });
}

// Применяем проверку прав администратора ко всем эндпоинтам админки
router.use(requireAdmin);

/* =========================================================================
   1. Статистика сервера для дашборда
========================================================================= */
router.get('/stats', (req, res) => {
  try {
    const stats = db.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (err) {
    console.error('[Admin Stats Error]', err);
    res.status(500).json({ error: 'Ошибка получения статистики.' });
  }
});

/* =========================================================================
   2. Список зарегистрированных пользователей
========================================================================= */
router.get('/users', (req, res) => {
  try {
    const users = db.getUsers();
    const now = Date.now();
    const ONLINE_THRESHOLD = 2 * 60 * 1000; // 2 минуты активности = онлайн

    const sanitizedUsers = users.map(u => {
      const isOnline = u.lastSeenAt 
        ? (now - new Date(u.lastSeenAt).getTime()) <= ONLINE_THRESHOLD 
        : false;

      return {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role || 'user',
        isBanned: !!u.isBanned,
        banReason: u.banReason || '',
        bannedAt: u.bannedAt || null,
        createdAt: u.createdAt,
        lastSeenAt: u.lastSeenAt || null,
        isOnline
      };
    });

    res.json({
      success: true,
      count: sanitizedUsers.length,
      users: sanitizedUsers
    });
  } catch (err) {
    console.error('[Admin Users Error]', err);
    res.status(500).json({ error: 'Ошибка получения списка пользователей.' });
  }
});

/* =========================================================================
   3. Блокировка пользователя в клиенте (Бан)
========================================================================= */
router.post('/users/:id/ban', (req, res) => {
  try {
    const targetId = req.params.id;
    const { reason } = req.body;

    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'Нельзя заблокировать собственный аккаунт администратора.' });
    }

    const targetUser = db.findUserById(targetId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Пользователь не найден.' });
    }

    const banReason = (reason && reason.trim()) ? reason.trim() : 'Нарушение правил проекта Glade';
    const updatedUser = db.banUser(targetId, banReason);

    console.log(`[ADMIN ACTION] Администратор "${req.user.username}" забанил пользователя "${updatedUser.username}". Причина: ${banReason}`);

    res.json({
      success: true,
      message: `Пользователь ${updatedUser.username} успешно заблокирован в клиенте.`,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        isBanned: updatedUser.isBanned,
        banReason: updatedUser.banReason,
        bannedAt: updatedUser.bannedAt
      }
    });
  } catch (err) {
    console.error('[Admin Ban Error]', err);
    res.status(500).json({ error: 'Ошибка блокировки пользователя.' });
  }
});

/* =========================================================================
   4. Разблокировка пользователя (Разбан)
========================================================================= */
router.post('/users/:id/unban', (req, res) => {
  try {
    const targetId = req.params.id;
    const targetUser = db.findUserById(targetId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Пользователь не найден.' });
    }

    const updatedUser = db.unbanUser(targetId);
    console.log(`[ADMIN ACTION] Администратор "${req.user.username}" разблокировал пользователя "${updatedUser.username}".`);

    res.json({
      success: true,
      message: `Пользователь ${updatedUser.username} успешно разблокирован.`,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        isBanned: updatedUser.isBanned
      }
    });
  } catch (err) {
    console.error('[Admin Unban Error]', err);
    res.status(500).json({ error: 'Ошибка разблокировки пользователя.' });
  }
});

/* =========================================================================
   5. Назначение роли (user / trainee / helper / moderator / admin / etc.)
========================================================================= */
router.post('/users/:id/role', (req, res) => {
  try {
    const targetId = req.params.id;
    const { role } = req.body;

    if (!db.STAFF_ROLES || !db.STAFF_ROLES[role]) {
      return res.status(400).json({ error: 'Недопустимая роль пользователя.' });
    }

    if (targetId === req.user.id && (role !== 'admin' && role !== 'head_admin')) {
      return res.status(400).json({ error: 'Нельзя лишить самого себя прав администратора.' });
    }

    const updatedUser = db.setUserRole(targetId, role);
    if (!updatedUser) {
      return res.status(404).json({ error: 'Пользователь не найден.' });
    }

    const roleTitle = db.STAFF_ROLES[role] ? db.STAFF_ROLES[role].title : role;
    res.json({
      success: true,
      message: `Роль пользователя ${updatedUser.username} изменена на "${roleTitle}".`,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role
      }
    });
  } catch (err) {
    console.error('[Admin Role Error]', err);
    res.status(500).json({ error: 'Ошибка изменения роли пользователя.' });
  }
});

/* =========================================================================
   5.1. Получение журнала наказаний
========================================================================= */
router.get('/punish-logs', (req, res) => {
  try {
    const logs = db.getPunishLogs(200);
    res.json({
      success: true,
      logs
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки журнала наказаний.' });
  }
});

/* =========================================================================
   6. Публикация мода в каталог (с поддержкой реального файла .jar/.zip)
========================================================================= */
router.post('/mods', upload.single('modFile'), (req, res) => {
  try {
    const { name, description, version, category, required } = req.body;
    let size = req.body.size;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Укажите название мода.' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Укажите описание мода.' });
    }

    let filename = null;
    let originalName = null;
    let fileSize = 0;
    let filePath = null;

    if (req.file) {
      filename = req.file.filename;
      try {
        originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      } catch (e) {
        originalName = req.file.originalname;
      }
      fileSize = req.file.size;
      filePath = `uploads/mods/${filename}`;

      // Автоматический расчет размера файла, если пользователь не ввел вручную
      if (!size || !size.trim()) {
        if (fileSize < 1024 * 1024) {
          size = (fileSize / 1024).toFixed(1) + ' КБ';
        } else {
          size = (fileSize / (1024 * 1024)).toFixed(1) + ' МБ';
        }
      }
    } else if (!size || !size.trim()) {
      size = '1,0 МБ';
    }

    const isRequired = required === 'true' || required === true || required === '1' || required === 1;

    const newMod = db.createMod({
      name: name.trim(),
      description: description.trim(),
      version: version ? version.trim() : '1.0.0',
      size: size ? size.trim() : '1,0 МБ',
      category: category ? category.trim() : 'utility',
      required: isRequired,
      filename,
      originalName,
      fileSize,
      filePath
    });

    console.log(`[ADMIN ACTION] Администратор "${req.user.username}" опубликовал мод: ${newMod.name} (файл: ${filename || 'без файла'}, размер: ${newMod.size})`);

    res.status(201).json({
      success: true,
      message: `Мод «${newMod.name}» успешно опубликован в каталог!`,
      mod: newMod
    });
  } catch (err) {
    console.error('[Admin Create Mod Error]', err);
    res.status(500).json({ error: 'Ошибка публикации мода.' });
  }
});

/* =========================================================================
   7. Удаление мода из каталога
========================================================================= */
router.delete('/mods/:id', (req, res) => {
  try {
    const modId = req.params.id;
    const mod = db.findModById(modId);
    if (!mod) {
      return res.status(404).json({ error: 'Мод не найден в каталоге.' });
    }

    db.deleteMod(modId);
    console.log(`[ADMIN ACTION] Администратор "${req.user.username}" удалил мод: ${mod.name}`);

    res.json({
      success: true,
      message: `Мод «${mod.name}» успешно удален из каталога.`
    });
  } catch (err) {
    console.error('[Admin Delete Mod Error]', err);
    res.status(500).json({ error: 'Ошибка удаления мода.' });
  }
});

module.exports = router;
