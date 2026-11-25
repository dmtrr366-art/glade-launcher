/**
 * Glade Launcher — Universal Customization & Theme Engine
 * Обеспечивает мгновенное применение цветовой гаммы, главного фона экрана Играть,
 * фонов баннеров профиля и аватарок пользователя на всех страницах.
 */

(function initThemeEngine() {
  const STORAGE_KEY = 'glade_customization';

  // 8 фирменных цветовых палитр без смайликов
  const COLOR_PRESETS = {
    fire: {
      id: 'fire',
      name: 'Оранжевый',
      o1: '#ff6a00',
      o2: '#d84300',
      o3: '#ff8a1f',
      glow: 'rgba(255, 106, 0, 0.35)'
    },
    diamond: {
      id: 'diamond',
      name: 'Бирюзовый',
      o1: '#00d2ff',
      o2: '#0072ff',
      o3: '#38d9ff',
      glow: 'rgba(0, 210, 255, 0.35)'
    },
    ender: {
      id: 'ender',
      name: 'Фиолетовый',
      o1: '#a855f7',
      o2: '#7c3aed',
      o3: '#c084fc',
      glow: 'rgba(168, 85, 247, 0.35)'
    },
    emerald: {
      id: 'emerald',
      name: 'Изумрудный',
      o1: '#10b981',
      o2: '#059669',
      o3: '#34d399',
      glow: 'rgba(16, 185, 129, 0.35)'
    },
    ruby: {
      id: 'ruby',
      name: 'Красный',
      o1: '#f43f5e',
      o2: '#be123c',
      o3: '#fb7185',
      glow: 'rgba(244, 63, 94, 0.35)'
    },
    gold: {
      id: 'gold',
      name: 'Янтарный',
      o1: '#f59e0b',
      o2: '#b45309',
      o3: '#fbbf24',
      glow: 'rgba(245, 158, 11, 0.35)'
    },
    cyber: {
      id: 'cyber',
      name: 'Розовый',
      o1: '#ec4899',
      o2: '#be185d',
      o3: '#f472b6',
      glow: 'rgba(236, 72, 153, 0.35)'
    },
    steel: {
      id: 'steel',
      name: 'Графитовый',
      o1: '#94a3b8',
      o2: '#475569',
      o3: '#cbd5e1',
      glow: 'rgba(148, 163, 184, 0.35)'
    }
  };

  // 4 пресета для главного экрана с кнопкой Играть (1-й: наша стоковая красивая оранжевая фотография!)
  const HERO_PRESETS = {
    default: {
      id: 'default',
      name: 'Оригинальный арт',
      style: "linear-gradient(90deg, rgba(7,6,5,0.55) 0%, rgba(7,6,5,0.1) 58%), url('assets/hero-default.jpg') center/cover no-repeat",
      thumb: "url('assets/hero-default.jpg') center/cover no-repeat"
    },
    red: {
      id: 'red',
      name: 'Багровый незер',
      style: "linear-gradient(90deg, rgba(7,6,5,0.55) 0%, rgba(7,6,5,0.15) 60%), linear-gradient(135deg, #240505 0%, #b81414 100%)",
      thumb: "linear-gradient(135deg, #240505 0%, #b81414 100%)"
    },
    purple: {
      id: 'purple',
      name: 'Эндер фиолетовый',
      style: "linear-gradient(90deg, rgba(7,6,5,0.55) 0%, rgba(7,6,5,0.15) 60%), linear-gradient(135deg, #120324 0%, #6b12a8 100%)",
      thumb: "linear-gradient(135deg, #120324 0%, #6b12a8 100%)"
    },
    blue: {
      id: 'blue',
      name: 'Ледяной сапфир',
      style: "linear-gradient(90deg, rgba(7,6,5,0.55) 0%, rgba(7,6,5,0.15) 60%), linear-gradient(135deg, #021424 0%, #0077cc 100%)",
      thumb: "linear-gradient(135deg, #021424 0%, #0077cc 100%)"
    }
  };

  // 4 пресета для шапки/баннера профиля
  const BANNER_PRESETS = {
    default: {
      id: 'default',
      name: 'Оранжевый Hoplite',
      style: "linear-gradient(90deg, rgba(7,6,5,0.55) 0%, rgba(7,6,5,0.15) 60%), linear-gradient(135deg, #1b0a02 0%, #d45500 100%)",
      thumb: "linear-gradient(135deg, #1b0a02 0%, #d45500 100%)"
    },
    red: {
      id: 'red',
      name: 'Багровый незер',
      style: "linear-gradient(90deg, rgba(7,6,5,0.55) 0%, rgba(7,6,5,0.15) 60%), linear-gradient(135deg, #240505 0%, #b81414 100%)",
      thumb: "linear-gradient(135deg, #240505 0%, #b81414 100%)"
    },
    purple: {
      id: 'purple',
      name: 'Эндер фиолетовый',
      style: "linear-gradient(90deg, rgba(7,6,5,0.55) 0%, rgba(7,6,5,0.15) 60%), linear-gradient(135deg, #120324 0%, #6b12a8 100%)",
      thumb: "linear-gradient(135deg, #120324 0%, #6b12a8 100%)"
    },
    blue: {
      id: 'blue',
      name: 'Ледяной сапфир',
      style: "linear-gradient(90deg, rgba(7,6,5,0.55) 0%, rgba(7,6,5,0.15) 60%), linear-gradient(135deg, #021424 0%, #0077cc 100%)",
      thumb: "linear-gradient(135deg, #021424 0%, #0077cc 100%)"
    }
  };

  // Дефолтный SVG лица скина
  const DEFAULT_SKIN_SVG = '<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="0" y="0" width="8" height="8" fill="#c48a5c"/><rect x="0" y="0" width="8" height="2" fill="#4a2e18"/><rect x="0" y="2" width="1" height="2" fill="#4a2e18"/><rect x="7" y="2" width="1" height="2" fill="#4a2e18"/><rect x="1" y="4" width="2" height="1" fill="#ffffff"/><rect x="5" y="4" width="2" height="1" fill="#ffffff"/><rect x="2" y="4" width="1" height="1" fill="#ff6a00"/><rect x="5" y="4" width="1" height="1" fill="#ff6a00"/><rect x="3" y="5" width="2" height="1" fill="#9e663d"/><rect x="2" y="6" width="4" height="1" fill="#522b19"/><rect x="3" y="6" width="2" height="1" fill="#361709"/></svg>';

  // Загрузка настроек с нормализацией
  function loadConfig() {
    let cfg = {
      colorTheme: 'fire',
      customColor: '#ff6a00',
      heroPreset: 'default',
      heroUrl: '',
      bannerPreset: 'default',
      bannerUrl: '',
      avatarType: 'skin', // 'skin' | 'custom'
      avatarUrl: ''
    };
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('hoplitex_customization');
      if (saved) {
        const parsed = JSON.parse(saved);
        cfg = Object.assign(cfg, parsed);
      }
    } catch (e) {}

    // Нормализация ключей пресетов
    if (!HERO_PRESETS[cfg.heroPreset] && !cfg.heroUrl) {
      cfg.heroPreset = 'default';
    }
    if (!BANNER_PRESETS[cfg.bannerPreset] && !cfg.bannerUrl) {
      cfg.bannerPreset = 'default';
    }
    if (cfg.avatarType !== 'custom') {
      cfg.avatarType = 'skin';
    }

    return cfg;
  }

  // Сохранение настроек
  function saveConfig(cfg) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch (e) {}
  }

  // Вспомогательные функции для расчета оттенков
  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
    const num = parseInt(hex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function adjustColor(hex, percent) {
    const { r, g, b } = hexToRgb(hex);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, r + amt));
    const G = Math.min(255, Math.max(0, g + amt));
    const B = Math.min(255, Math.max(0, b + amt));
    return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
  }

  // Применение темы ко всей странице
  function applyTheme(cfg) {
    if (!cfg) cfg = loadConfig();

    let o1, o2, o3, glow;

    if (cfg.colorTheme === 'custom' && cfg.customColor) {
      o1 = cfg.customColor;
      o2 = adjustColor(o1, -22);
      o3 = adjustColor(o1, 24);
      const rgb = hexToRgb(o1);
      glow = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.38)`;
    } else {
      const preset = COLOR_PRESETS[cfg.colorTheme] || COLOR_PRESETS.fire;
      o1 = preset.o1;
      o2 = preset.o2;
      o3 = preset.o3;
      glow = preset.glow;
    }

    // Применяем CSS-переменные к корневому тегу :root
    const root = document.documentElement;
    root.style.setProperty('--o1', o1);
    root.style.setProperty('--o2', o2);
    root.style.setProperty('--o3', o3);
    root.style.setProperty('--glow', glow);

    // Добавляем или обновляем динамические CSS-стили темы
    let styleTag = document.getElementById('gladeDynamicTheme');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'gladeDynamicTheme';
      document.head.appendChild(styleTag);
    }

    let cssRules = `
      :root {
        --o1: ${o1} !important;
        --o2: ${o2} !important;
        --o3: ${o3} !important;
      }
      body {
        background: #0d0b0a !important;
        padding: 0 !important;
        padding-top: 38px !important;
        margin: 0 !important;
        overflow: hidden !important;
        height: 100vh !important;
      }
      .win {
        background: #0d0b0a !important;
        border: none !important;
        border-radius: 0 !important;
        width: 100% !important;
        height: calc(100vh - 38px) !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 14px 16px !important;
        box-sizing: border-box !important;
      }
      .nav button.on, .nav a.on {
        background: linear-gradient(90deg, ${o1}, rgba(0,0,0,0.65) 95%) !important;
        box-shadow: 0 4px 20px ${glow} !important;
      }
      .play, .pbtn {
        background: linear-gradient(180deg, ${o3}, ${o2}) !important;
        box-shadow: 0 10px 40px ${glow}, inset 0 1px 0 rgba(255,255,255,0.3) !important;
      }
      .play:hover, .pbtn:hover {
        box-shadow: 0 14px 48px ${glow}, inset 0 1px 0 rgba(255,255,255,0.4) !important;
      }
      .tabs button.on, .seg button.on {
        background: linear-gradient(90deg, ${o1}, ${o2}) !important;
      }
      .logo b, .titlebar-brand span, h1, .vhead h2 {
        background: linear-gradient(180deg, ${o3}, ${o2}) !important;
        -webkit-background-clip: text !important;
        background-clip: text !important;
        color: transparent !important;
      }
      .swoosh path:first-child { stroke: ${o1} !important; }
      .swoosh stop { stop-color: ${o1} !important; }
      .pav, .locked-tag, .role-badge {
        border-color: ${o2} !important;
      }
      .hero .arc {
        border-color: ${o2} !important;
        border-right-color: transparent !important;
        border-bottom-color: transparent !important;
        filter: drop-shadow(0 0 18px ${glow}) !important;
      }
    `;

    // 1. Главный фон (экран с кнопкой Играть - .hero)
    if (cfg.heroUrl && cfg.heroUrl.trim() !== '') {
      cssRules += `
        .hero {
          background: linear-gradient(90deg, rgba(7,6,5,0.68) 0%, rgba(7,6,5,0.15) 60%), url('${cfg.heroUrl}') center/cover no-repeat !important;
        }
      `;
    } else {
      const hp = HERO_PRESETS[cfg.heroPreset] || HERO_PRESETS.default;
      cssRules += `
        .hero {
          background: ${hp.style} !important;
        }
      `;
    }

    // 2. Фон шапки и баннера профиля (.vhead)
    if (cfg.bannerUrl && cfg.bannerUrl.trim() !== '') {
      cssRules += `
        .vhead {
          background: linear-gradient(90deg, rgba(7,6,5,0.72) 0%, rgba(7,6,5,0.2) 65%), url('${cfg.bannerUrl}') center/cover no-repeat !important;
        }
      `;
    } else {
      const bp = BANNER_PRESETS[cfg.bannerPreset] || BANNER_PRESETS.default;
      cssRules += `
        .vhead {
          background: ${bp.style} !important;
        }
      `;
    }

    styleTag.textContent = cssRules;

    // 3. Применение аватарок в DOM
    updateDomAvatars(cfg);
  }

  // Обновление аватарок на странице
  function updateDomAvatars(cfg) {
    if (!cfg) cfg = loadConfig();

    const pavElements = [document.getElementById('pav'), document.getElementById('pav2')].filter(Boolean);
    const sideAv = document.querySelector('.user .av');

    if (cfg.avatarType === 'custom' && cfg.avatarUrl) {
      const customImg = `<img src="${cfg.avatarUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;">`;
      pavElements.forEach(el => { el.innerHTML = customImg; });
      if (sideAv) sideAv.innerHTML = customImg;
    } else {
      // Режим скина
      pavElements.forEach(el => {
        if (!el.querySelector('svg') && !el.querySelector('canvas')) {
          el.innerHTML = DEFAULT_SKIN_SVG;
        }
      });
      if (sideAv && !sideAv.querySelector('svg')) {
        sideAv.innerHTML = DEFAULT_SKIN_SVG;
      }
    }
  }

  // Публичный API
  window.GladeTheme = {
    COLOR_PRESETS,
    HERO_PRESETS,
    BANNER_PRESETS,
    DEFAULT_SKIN_SVG,
    loadConfig,
    saveConfig,
    applyTheme,
    updateDomAvatars,
    syncWithServer: async function() {
      try {
        const token = localStorage.getItem('glade_token') || localStorage.getItem('hoplitex_token');
        const session = JSON.parse(localStorage.getItem('glade_session') || localStorage.getItem('hoplitex_session') || '{}');
        const authToken = token || session.token || session.id || session.username;
        if (!authToken) return;

        const res = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'x-user-id': session.id || '',
            'x-username': session.username || ''
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.user && data.user.customization) {
            const serverCust = data.user.customization;
            const localCust = loadConfig();
            const merged = Object.assign({}, localCust, serverCust);
            saveConfig(merged);
            applyTheme(merged);
          }
        }
      } catch (e) {}
    }
  };
  window.HopliteTheme = window.GladeTheme;

  // Мгновенное применение темы
  const currentConfig = loadConfig();
  applyTheme(currentConfig);

  // Повторное применение после загрузки структуры DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyTheme(loadConfig());
      window.GladeTheme.syncWithServer();
    });
  } else {
    setTimeout(() => {
      applyTheme(loadConfig());
      window.GladeTheme.syncWithServer();
    }, 10);
  }
})();
