/**
 * Glade Launcher Server
 * Node.js + Express backend
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const db = require('./db');
const paths = require('./paths');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const modsRoutes = require('./routes/mods');
const friendsRoutes = require('./routes/friends');
const launcherRoutes = require('./routes/launcher');
const staffRoutes = require('./routes/staff');
const ticketsRoutes = require('./routes/tickets');
const navigatorRoutes = require('./routes/navigator');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = paths.BUNDLE_ROOT;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Логирование HTTP-запросов API
app.use('/api', (req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// Роуты аутентификации
app.use('/api/auth', authRoutes);

// Роуты каталога модов (публичные)
app.use('/api/mods', modsRoutes);

// Роуты друзей и чата (защищенные)
app.use('/api/friends', friendsRoutes);

// Роуты панели администратора (защищенные)
app.use('/api/admin', adminRoutes);

// Роуты системы персонала и наказаний (связка мода с лаунчером)
app.use('/api/staff', staffRoutes);

// Роуты запуска игры Minecraft
app.use('/api/launcher', launcherRoutes);

// Роуты тикетов поддержки
app.use('/api/tickets', ticketsRoutes);

// Роуты путеводителя по игровым режимам
app.use('/api/navigator', navigatorRoutes);

// Периодическая автоматическая очистка закрытых тикетов старше 24ч (каждые 30 мин)
setInterval(() => {
  try {
    const db = require('./db');
    db.cleanupExpiredTickets();
  } catch (e) {}
}, 30 * 60 * 1000);

// API скинов для Minecraft клиента Glade и лаунчера
app.get('/api/skins/:username', (req, res) => {
  const username = req.params.username;
  const user = db.findUserByUsername(username);
  let skinPath = null;
  if (user && user.skinUrl) {
    if (user.skinUrl.startsWith('/uploads/skins/')) {
      skinPath = path.join(paths.SKINS_DIR, path.basename(user.skinUrl));
    } else if (user.skinUrl.startsWith('/assets/skins/')) {
      skinPath = path.join(paths.BUNDLE_ROOT, 'assets', 'skins', path.basename(user.skinUrl));
    }
  }
  if (!skinPath || !fs.existsSync(skinPath)) {
    const directUpload = path.join(paths.SKINS_DIR, `${username}.png`);
    const directAsset = path.join(paths.BUNDLE_ROOT, 'assets', 'skins', `${username}.png`);
    if (fs.existsSync(directUpload)) skinPath = directUpload;
    else if (fs.existsSync(directAsset)) skinPath = directAsset;
    else skinPath = path.join(paths.BUNDLE_ROOT, 'assets', 'skins', 'default.png');
  }

  if (fs.existsSync(skinPath)) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=60');
    fs.createReadStream(skinPath).pipe(res);
  } else {
    res.status(404).send('Skin not found');
  }
});

app.get('/api/skins/:username/model', (req, res) => {
  const username = req.params.username;
  const user = db.findUserByUsername(username);
  const model = (user && user.modelType) || 'default';
  res.json({ model });
});

// Раздача загруженных пользовательских файлов (скины, плащи, моды) из userData
app.use('/uploads', express.static(paths.UPLOADS_DIR));

// Раздача статических файлов лаунчера (HTML, CSS, JS, assets)
app.use(express.static(ROOT_DIR));

// Главный роут перенаправляет на index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

// Обработка 404 для API
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Эндпоинт API не найден.' });
});

// Запуск сервера с привязкой ко всем сетевым интерфейсам (0.0.0.0)
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('\n==================================================');
  console.log(`🚀 Сервер Glade Launcher успешно запущен!`);
  console.log(`🌐 Адрес лаунчера: http://127.0.0.1:${PORT}`);
  console.log(`📁 Пользовательские данные: ${paths.USER_DATA}`);
  console.log('==================================================\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[Server] Порт ${PORT} уже занят. Используется запущенный экземпляр сервера.`);
  } else {
    console.error('[Server Error]', err);
  }
});

module.exports = app;
