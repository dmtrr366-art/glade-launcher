/**
 * Glade Launcher — Centralized Path & Storage Manager
 * Обеспечивает корректные пути как в режиме разработки, так и внутри скомпилированного
 * Electron приложения (где app.asar доступен только для чтения).
 */

const path = require('path');
const fs = require('fs');

// Корень проекта / бандла (может быть внутри app.asar)
const BUNDLE_ROOT = path.resolve(__dirname, '..');

// Определение директории для пользовательских перезаписываемых данных
function resolveUserDataDir() {
  if (process.env.GLADE_USER_DATA) {
    return process.env.GLADE_USER_DATA;
  }
  if (process.env.HOPLITEX_USER_DATA) {
    return process.env.HOPLITEX_USER_DATA;
  }

  // Если запущен внутри процесса Electron
  try {
    const electron = require('electron');
    const app = electron.app || (electron.remote && electron.remote.app);
    if (app && app.getPath) {
      return app.getPath('userData');
    }
  } catch (e) {}

  // Если код выполняется внутри app.asar, но переменная не задана
  if (__dirname.includes('app.asar')) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    if (process.platform === 'darwin') {
      const gladeDir = path.join(home, 'Library', 'Application Support', 'glade-launcher');
      const hopliteDir = path.join(home, 'Library', 'Application Support', 'hoplitex-launcher');
      if (!fs.existsSync(gladeDir) && fs.existsSync(hopliteDir)) return hopliteDir;
      return gladeDir;
    }
    if (process.platform === 'win32') {
      const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      const gladeDir = path.join(appdata, 'glade-launcher');
      const hopliteDir = path.join(appdata, 'hoplitex-launcher');
      if (!fs.existsSync(gladeDir) && fs.existsSync(hopliteDir)) return hopliteDir;
      return gladeDir;
    }
    const gladeDir = path.join(home, '.config', 'glade-launcher');
    const hopliteDir = path.join(home, '.config', 'hoplitex-launcher');
    if (!fs.existsSync(gladeDir) && fs.existsSync(hopliteDir)) return hopliteDir;
    return gladeDir;
  }

  // В обычном режиме разработки (npm start, npm run dev) пишем прямо в корень проекта
  return BUNDLE_ROOT;
}

const USER_DATA = resolveUserDataDir();

const DATA_DIR = path.join(USER_DATA, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.join(USER_DATA, 'uploads');
const MODS_DIR = path.join(UPLOADS_DIR, 'mods');
const SKINS_DIR = path.join(UPLOADS_DIR, 'skins');
const CAPES_DIR = path.join(UPLOADS_DIR, 'capes');
const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');
const BANNERS_DIR = path.join(UPLOADS_DIR, 'banners');
const WALLPAPERS_DIR = path.join(UPLOADS_DIR, 'wallpapers');
const TICKETS_DIR = path.join(UPLOADS_DIR, 'tickets');

// Инициализация структуры папок и первичное наполнение данными
function initStorage() {
  [DATA_DIR, UPLOADS_DIR, MODS_DIR, SKINS_DIR, CAPES_DIR, AVATARS_DIR, BANNERS_DIR, WALLPAPERS_DIR, TICKETS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.error(`[Storage] Не удалось создать папку ${dir}:`, err.message);
      }
    }
  });

  // Если БД еще нет в userData, копируем начальную базу из бандла
  if (!fs.existsSync(DB_FILE)) {
    const bundledDb = path.join(BUNDLE_ROOT, 'data', 'db.json');
    if (fs.existsSync(bundledDb)) {
      try {
        fs.copyFileSync(bundledDb, DB_FILE);
        console.log(`[Storage] Начальная база данных db.json скопирована в: ${DB_FILE}`);
      } catch (err) {
        console.error('[Storage] Ошибка копирования db.json:', err.message);
      }
    }
  }

  // Копирование дефолтных скинов и плащей в uploads, если их еще нет
  function copyBundledFiles(subDir, targetDir) {
    const srcDir = path.join(BUNDLE_ROOT, subDir);
    if (fs.existsSync(srcDir)) {
      try {
        const files = fs.readdirSync(srcDir);
        files.forEach(f => {
          const target = path.join(targetDir, f);
          if (!fs.existsSync(target)) {
            try {
              fs.copyFileSync(path.join(srcDir, f), target);
            } catch (e) {}
          }
        });
      } catch (e) {}
    }
  }

  copyBundledFiles(path.join('uploads', 'skins'), SKINS_DIR);
  copyBundledFiles(path.join('assets', 'skins'), SKINS_DIR);
  copyBundledFiles(path.join('uploads', 'capes'), CAPES_DIR);
  copyBundledFiles(path.join('assets', 'capes'), CAPES_DIR);
  copyBundledFiles(path.join('uploads', 'mods'), MODS_DIR);
}

// Запускаем инициализацию немедленно при импорте модуля
initStorage();

module.exports = {
  BUNDLE_ROOT,
  USER_DATA,
  DATA_DIR,
  DB_FILE,
  UPLOADS_DIR,
  MODS_DIR,
  SKINS_DIR,
  CAPES_DIR,
  AVATARS_DIR,
  BANNERS_DIR,
  WALLPAPERS_DIR,
  TICKETS_DIR
};
