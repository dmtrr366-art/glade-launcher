/**
 * Glade Launcher — Titlebar & Window Controls Manager
 * Обеспечивает нативное управление окном (свернуть, развернуть, закрыть)
 * и перетаскивание окна на всех страницах приложения.
 */

(function initTitlebar() {
  function setup() {
    // Определяем платформу (macOS или Windows/Linux)
    const isMac = (window.electronAPI && window.electronAPI.platform === 'darwin') ||
                  (navigator.platform && navigator.platform.toUpperCase().indexOf('MAC') >= 0) ||
                  (navigator.userAgent && (navigator.userAgent.indexOf('Mac') >= 0 || navigator.userAgent.indexOf('Darwin') >= 0));

    if (isMac) {
      document.documentElement.classList.add('is-mac');
    }

    if (window.electronAPI && window.electronAPI.isElectron) {
      document.documentElement.classList.add('is-electron');
    }

    // Если шапка уже создана, не дублируем
    if (document.getElementById('appTitlebar')) return;

    const titlebar = document.createElement('header');
    titlebar.id = 'appTitlebar';
    titlebar.className = 'app-titlebar';
    titlebar.innerHTML = `
      <div class="titlebar-drag-region">
        <div class="titlebar-brand">
          <svg width="18" height="18" viewBox="0 0 40 30" fill="currentColor">
            <path d="M2 8l8 7 10-12 10 12 8-7-4 15H6z"/>
            <rect x="6" y="25" width="28" height="3" rx="1"/>
          </svg>
          <span>GLADE LAUNCHER</span>
        </div>
      </div>
      <div class="titlebar-controls">
        <button id="tbMinBtn" class="titlebar-btn" title="Свернуть" aria-label="Свернуть">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
            <path d="M2 8h12"/>
          </svg>
        </button>
        <button id="tbMaxBtn" class="titlebar-btn" title="Развернуть" aria-label="Развернуть">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
            <rect x="2.5" y="2.5" width="11" height="11" rx="1"/>
          </svg>
        </button>
        <button id="tbCloseBtn" class="titlebar-btn btn-close" title="Закрыть" aria-label="Закрыть">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
            <path d="M3 3l10 10M13 3L3 13"/>
          </svg>
        </button>
      </div>
    `;

    document.body.prepend(titlebar);

    // Подключаем обработчики кнопок
    const minBtn = document.getElementById('tbMinBtn');
    const maxBtn = document.getElementById('tbMaxBtn');
    const closeBtn = document.getElementById('tbCloseBtn');

    if (minBtn) {
      minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.electronAPI && window.electronAPI.minimize) {
          window.electronAPI.minimize();
        } else if (typeof say === 'function') {
          say('Сворачивание доступно в десктопном приложении');
        }
      });
    }

    if (maxBtn) {
      maxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.electronAPI && window.electronAPI.maximize) {
          window.electronAPI.maximize();
        } else {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.electronAPI && window.electronAPI.close) {
          window.electronAPI.close();
        } else if (typeof say === 'function') {
          say('Закрытие доступно в десктопном приложении');
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
