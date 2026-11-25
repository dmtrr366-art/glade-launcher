/**
 * Public Mods API Routes
 * Служит для синхронизации каталога модов и скачивания файлов клиентами лаунчера.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const paths = require('../paths');

const router = express.Router();
const UPLOADS_DIR = paths.MODS_DIR;

function getAuthUser(req) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers['x-user-id']) {
    token = req.headers['x-user-id'];
  } else if (req.headers['x-username']) {
    token = req.headers['x-username'];
  } else if (req.query.token) {
    token = req.query.token;
  }
  if (!token) return null;
  const session = db.getSession(token);
  if (session) return db.findUserById(session.userId);
  return db.findUserById(token) || db.findUserByUsername(token);
}

// Получить список всех модов из базы (staffOnly моды видны только персоналу)
router.get('/', (req, res) => {
  try {
    const user = getAuthUser(req);
    const isStaff = user && user.role && user.role !== 'user';
    let mods = db.getMods();
    if (!isStaff) {
      mods = mods.filter(m => !m.staffOnly);
    }
    res.json({
      success: true,
      count: mods.length,
      mods
    });
  } catch (err) {
    console.error('[Mods API Error]', err);
    res.status(500).json({ error: 'Ошибка получения каталога модов.' });
  }
});

// Получить конкретный мод по ID
router.get('/:id', (req, res) => {
  const mod = db.findModById(req.params.id);
  if (!mod) {
    return res.status(404).json({ error: 'Мод не найден.' });
  }
  if (mod.staffOnly) {
    const user = getAuthUser(req);
    if (!user || !user.role || user.role === 'user') {
      return res.status(403).json({ error: 'Доступ запрещён: этот мод предназначен только для персонала Glade.' });
    }
  }
  res.json({ success: true, mod });
});

// Реальное скачивание файла мода (.jar / .zip)
router.get('/:id/download', (req, res) => {
  const mod = db.findModById(req.params.id);
  if (!mod) {
    return res.status(404).json({ error: 'Мод не найден.' });
  }

  // Защита: скачивать мод для персонала разрешено только стажёрам и выше
  if (mod.staffOnly) {
    const user = getAuthUser(req);
    if (!user || !user.role || user.role === 'user') {
      return res.status(403).json({ error: 'Доступ запрещён: скачивание доступно только авторизованному персоналу Glade.' });
    }
  }

  // Увеличиваем счетчик загрузок
  mod.downloads = (mod.downloads || 0) + 1;
  db._saveData();

  if (mod.id === 'glade-staff') {
    const coreModPath = path.join(paths.BUNDLE_ROOT, 'server', 'mods', 'glade-core.jar');
    if (fs.existsSync(coreModPath)) {
      return res.download(coreModPath, 'glade-staff-v1.0.jar');
    }
  }

  if (mod.filename) {
    const filePath = path.join(UPLOADS_DIR, mod.filename);
    if (fs.existsSync(filePath)) {
      const downloadName = mod.originalName || `${mod.name.replace(/[^a-zA-Z0-9_\-]/g, '_')}-v${mod.version}.jar`;
      return res.download(filePath, downloadName);
    }
  }

  // Если физического файла нет на диске (например, базовый системный мод), отправляем виртуальный .jar файл-заглушку
  const safeName = (mod.name || 'mod').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const dummyFilename = `${safeName}-v${mod.version || '1.0'}.jar`;
  const dummyContent = `// Glade Launcher Mod Package\n// Name: ${mod.name}\n// Version: ${mod.version}\n// Category: ${mod.category}\n`;

  res.setHeader('Content-Disposition', `attachment; filename="${dummyFilename}"`);
  res.setHeader('Content-Type', 'application/java-archive');
  res.send(Buffer.from(dummyContent, 'utf-8'));
});

// Увеличить счётчик загрузок мода через POST
router.post('/:id/download', (req, res) => {
  const mod = db.findModById(req.params.id);
  if (!mod) {
    return res.status(404).json({ error: 'Мод не найден.' });
  }
  mod.downloads = (mod.downloads || 0) + 1;
  db._saveData();
  res.json({ success: true, downloads: mod.downloads });
});

module.exports = router;
