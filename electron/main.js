/**
 * Glade Launcher — Electron Main Process
 * Превращает лаунчер в полноценное нативное десктопное приложение.
 */

const { app, BrowserWindow, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');
const http = require('http');

// Устанавливаем системное имя приложения для меню macOS
if (app && app.setName) {
  app.setName('Glade Launcher');
}

let mainWindow = null;
const SERVER_PORT = process.env.PORT || 3000;

// Устанавливаем путь к пользовательским данным ДО инициализации модулей
if (app && app.getPath) {
  try {
    const userData = app.getPath('userData');
    process.env.GLADE_USER_DATA = userData;
    process.env.HOPLITEX_USER_DATA = userData;
  } catch (e) {}
}

// Установка фирменной иконки в панель Dock на macOS
const icnsPath = path.join(__dirname, '..', 'build', 'icon.icns');
const pngPath = path.join(__dirname, '..', 'app-icon.png');
const icoPath = path.join(__dirname, '..', 'favicon.ico');

if (app && process.platform === 'darwin' && app.dock) {
  try {
    const icon = nativeImage.createFromPath(pngPath);
    if (!icon.isEmpty()) {
      app.dock.setIcon(icon);
    } else {
      app.dock.setIcon(icnsPath);
    }
  } catch (e) {
    try { app.dock.setIcon(icnsPath); } catch (e2) {}
  }
}

// Запуск встроенного Express бэкенда с гарантированным ожиданием готовности
function startBackendServer() {
  return new Promise((resolve) => {
    // Проверяем, запущен ли уже сервер (например, при отдельном запуске разработчиком)
    const checkReq = http.get(`http://127.0.0.1:${SERVER_PORT}/api/mods`, (res) => {
      console.log(`[Electron] Сервер уже работает на порту ${SERVER_PORT}`);
      resolve();
    });

    checkReq.on('error', () => {
      console.log('[Electron] Запуск локального Express сервера...');
      try {
        require('../server/server.js');
      } catch (err) {
        console.error('[Electron] Ошибка запуска сервера:', err);
      }

      // Опрашиваем сервер с интервалом 200 мс, пока он не начнет отвечать 200 OK
      let attempts = 0;
      const pollTimer = setInterval(() => {
        attempts++;
        const pollReq = http.get(`http://127.0.0.1:${SERVER_PORT}/api/mods`, (res) => {
          clearInterval(pollTimer);
          console.log(`[Electron] Сервер успешно запущен и готов к работе на порту ${SERVER_PORT}!`);
          resolve();
        });
        pollReq.on('error', () => {
          if (attempts >= 50) { // максимум 10 секунд ожидания
            clearInterval(pollTimer);
            console.error('[Electron] Таймаут ожидания сервера');
            resolve();
          }
        });
        pollReq.setTimeout(300, () => pollReq.destroy());
      }, 200);
    });

    checkReq.setTimeout(400, () => {
      checkReq.destroy();
    });
  });
}

function createWindow() {
  const windowIcon = process.platform === 'win32' ? icoPath : (process.platform === 'darwin' ? icnsPath : pngPath);

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 980,
    minHeight: 660,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 11 },
    backgroundColor: '#070605',
    icon: windowIcon,
    title: 'Glade Launcher',
    show: false, // Покажем после ready-to-show или по страховочному таймеру
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Загружаем лаунчер через 127.0.0.1 (избегает проблем с IPv6/localhost на macOS)
  mainWindow.loadURL(`http://127.0.0.1:${SERVER_PORT}`);

  // Страховочный таймер показа окна (гарантирует, что окно не останется скрытым)
  const showTimeout = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 1800);

  mainWindow.once('ready-to-show', () => {
    clearTimeout(showTimeout);
    mainWindow.show();
  });

  // Автоматический перезапрос страницы при временной недоступности (ERR_CONNECTION_REFUSED)
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.warn(`[Electron] did-fail-load: ${errorCode} (${errorDescription}). Перезагрузка через 800 мс...`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(`http://127.0.0.1:${SERVER_PORT}`);
      }
    }, 800);
  });

  // Горячая клавиша F12 или Cmd+Option+I для открытия консоли инструментов разработчика
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.meta && input.alt && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Открытие внешних ссылок в браузере системы
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC обработчики кнопок окна (Свернуть / Развернуть / Закрыть)
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('open-external', (event, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url);
  }
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// Запуск игрового клиента Minecraft через Electron IPC
ipcMain.handle('launch-game', async (event, options) => {
  try {
    const launcherService = require('../server/launcher-service');
    return await launcherService.launchGame(options);
  } catch (err) {
    console.error('[Electron IPC launch-game] Error:', err);
    return {
      success: false,
      error: err.message || 'Ошибка запуска Minecraft'
    };
  }
});

// Открытие папки игры или лаунчера в системном проводнике (Finder / Explorer)
ipcMain.handle('open-folder', async (event, folderType) => {
  try {
    let targetPath;
    if (folderType === 'game' || folderType === 'minecraft') {
      const launcherService = require('../server/launcher-service');
      targetPath = launcherService.getMinecraftDir();
    } else {
      const paths = require('../server/paths');
      targetPath = paths.USER_DATA;
    }

    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    const err = await shell.openPath(targetPath);
    if (err) {
      console.warn('[Electron IPC open-folder] shell.openPath error:', err);
      return { success: false, error: err };
    }
    return { success: true, path: targetPath };
  } catch (err) {
    console.error('[Electron IPC open-folder] Error:', err);
    return { success: false, error: err.message };
  }
});

// Получение системных путей игры и лаунчера
ipcMain.handle('get-paths', async () => {
  try {
    const launcherService = require('../server/launcher-service');
    const paths = require('../server/paths');
    return {
      success: true,
      gameDir: launcherService.getMinecraftDir(),
      userDataDir: paths.USER_DATA
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

if (app && app.whenReady) {
  app.whenReady().then(async () => {
    if (process.platform === 'darwin' && app.dock) {
      try {
        const icon = nativeImage.createFromPath(pngPath);
        if (!icon.isEmpty()) {
          app.dock.setIcon(icon);
        } else {
          app.dock.setIcon(icnsPath);
        }
      } catch (e) {}
    }

    await startBackendServer();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
