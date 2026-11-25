/**
 * Glade Launcher — Appearance Management Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  const theme = window.GladeTheme;
  if (!theme) return;

  const currentConfig = theme.loadConfig();

  // Получаем сессию игрока
  let currentUser = 'Игрок';
  try {
    const s = JSON.parse((localStorage.getItem('glade_session') || localStorage.getItem('hoplitex_session')) || '{}');
    if (s.username) currentUser = s.username;
  } catch (e) {}

  // Заполняем ник в превью профиля
  const prevUname = document.getElementById('prevUname');
  if (prevUname) prevUname.textContent = currentUser;

  /* -------------------------------------------------------------
     1. ПАЛИТРА ЦВЕТОВ
  ------------------------------------------------------------- */
  const colorGrid = document.getElementById('colorPresetsGrid');
  const customColorPicker = document.getElementById('customColorPicker');
  const customColorHex = document.getElementById('customColorHex');
  const applyCustomColorBtn = document.getElementById('applyCustomColorBtn');

  if (colorGrid) {
    colorGrid.innerHTML = Object.values(theme.COLOR_PRESETS).map(p => `
      <div class="color-item ${currentConfig.colorTheme === p.id ? 'active' : ''}" data-id="${p.id}">
        <div class="color-circle" style="background: ${p.o1}; color: ${p.glow};"></div>
        <span class="color-name">${p.name}</span>
      </div>
    `).join('');

    colorGrid.addEventListener('click', (e) => {
      const item = e.target.closest('.color-item');
      if (!item) return;
      const id = item.dataset.id;
      colorGrid.querySelectorAll('.color-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');

      currentConfig.colorTheme = id;
      theme.applyTheme(currentConfig);
      theme.saveConfig(currentConfig);
      say(`Выбрана цветовая гамма: ${theme.COLOR_PRESETS[id].name}`);
    });
  }

  if (customColorPicker && customColorHex) {
    if (currentConfig.customColor) {
      customColorPicker.value = currentConfig.customColor;
      customColorHex.value = currentConfig.customColor;
    }

    customColorPicker.addEventListener('input', (e) => {
      customColorHex.value = e.target.value;
    });

    if (applyCustomColorBtn) {
      applyCustomColorBtn.addEventListener('click', () => {
        const hex = customColorHex.value.trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
          if (colorGrid) colorGrid.querySelectorAll('.color-item').forEach(el => el.classList.remove('active'));
          currentConfig.colorTheme = 'custom';
          currentConfig.customColor = hex;
          theme.applyTheme(currentConfig);
          theme.saveConfig(currentConfig);
          say(`Применен собственный цвет: ${hex}`);
        } else {
          say('Введите корректный HEX-цвет (например: #ff6a00)');
        }
      });
    }
  }

  /* -------------------------------------------------------------
     2. ГЛАВНЫЙ ФОН (ГДЕ КНОПКА ИГРАТЬ)
  ------------------------------------------------------------- */
  const heroGrid = document.getElementById('heroPresetsGrid');
  const heroLivePreview = document.getElementById('heroLivePreview');
  const heroUrlInput = document.getElementById('heroUrlInput');
  const applyHeroUrlBtn = document.getElementById('applyHeroUrlBtn');
  const heroFileInput = document.getElementById('heroFileInput');
  const resetHeroBtn = document.getElementById('resetHeroBtn');

  function updateLiveHeroPreview() {
    if (!heroLivePreview) return;
    if (currentConfig.heroUrl) {
      heroLivePreview.style.backgroundImage = `linear-gradient(90deg, rgba(7,6,5,0.68) 0%, rgba(7,6,5,0.15) 60%), url('${currentConfig.heroUrl}')`;
    } else {
      const p = theme.HERO_PRESETS[currentConfig.heroPreset] || theme.HERO_PRESETS.default;
      heroLivePreview.style.background = p.style;
    }
  }

  if (heroGrid) {
    heroGrid.innerHTML = Object.values(theme.HERO_PRESETS).map(hp => `
      <div class="preset-thumb-card ${currentConfig.heroPreset === hp.id && !currentConfig.heroUrl ? 'active' : ''}" data-id="${hp.id}" style="background: ${hp.thumb};"></div>
    `).join('');

    heroGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.preset-thumb-card');
      if (!card) return;
      const id = card.dataset.id;
      heroGrid.querySelectorAll('.preset-thumb-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      currentConfig.heroPreset = id;
      currentConfig.heroUrl = '';
      if (heroUrlInput) heroUrlInput.value = '';

      theme.applyTheme(currentConfig);
      theme.saveConfig(currentConfig);
      updateLiveHeroPreview();
      say('Главный фон изменен');
    });
  }

  if (applyHeroUrlBtn && heroUrlInput) {
    if (currentConfig.heroUrl) heroUrlInput.value = currentConfig.heroUrl;

    applyHeroUrlBtn.addEventListener('click', () => {
      const url = heroUrlInput.value.trim();
      if (url) {
        if (heroGrid) heroGrid.querySelectorAll('.preset-thumb-card').forEach(c => c.classList.remove('active'));
        currentConfig.heroPreset = 'custom';
        currentConfig.heroUrl = url;
        theme.applyTheme(currentConfig);
        theme.saveConfig(currentConfig);
        updateLiveHeroPreview();
        say('Ссылка на главный фон успешно применена');
      }
    });
  }

  if (heroFileInput) {
    heroFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('hero', file);

      try {
        say('Загрузка главного фона на сервер...');
        const res = await fetch('/api/auth/upload-hero', {
          method: 'POST',
          headers: getAuthHeaders(false),
          body: formData
        });
        const data = await res.json();
        if (res.ok && data.heroUrl) {
          if (heroGrid) heroGrid.querySelectorAll('.preset-thumb-card').forEach(c => c.classList.remove('active'));
          currentConfig.heroPreset = 'custom';
          currentConfig.heroUrl = data.heroUrl;
          if (heroUrlInput) heroUrlInput.value = data.heroUrl;
          theme.applyTheme(currentConfig);
          theme.saveConfig(currentConfig);
          updateLiveHeroPreview();
          say('Собственный главный фон успешно установлен');
        } else {
          say(data.error || 'Ошибка загрузки фона');
        }
      } catch (err) {
        say('Ошибка соединения с сервером');
      }
    });
  }

  if (resetHeroBtn) {
    resetHeroBtn.addEventListener('click', () => {
      if (heroGrid) {
        heroGrid.querySelectorAll('.preset-thumb-card').forEach(c => c.classList.remove('active'));
        const def = heroGrid.querySelector('[data-id="default"]');
        if (def) def.classList.add('active');
      }
      currentConfig.heroPreset = 'default';
      currentConfig.heroUrl = '';
      if (heroUrlInput) heroUrlInput.value = '';
      theme.applyTheme(currentConfig);
      theme.saveConfig(currentConfig);
      updateLiveHeroPreview();
      say('Главный фон сброшен к оригинальному');
    });
  }

  updateLiveHeroPreview();

  /* -------------------------------------------------------------
     3. ФОН БАННЕРА ПРОФИЛЯ
  ------------------------------------------------------------- */
  const bannerGrid = document.getElementById('bannerPresetsGrid');
  const bannerLivePreview = document.getElementById('bannerLivePreview');
  const bannerUrlInput = document.getElementById('bannerUrlInput');
  const applyBannerUrlBtn = document.getElementById('applyBannerUrlBtn');
  const bannerFileInput = document.getElementById('bannerFileInput');
  const resetBannerBtn = document.getElementById('resetBannerBtn');

  function updateLiveBannerPreview() {
    if (!bannerLivePreview) return;
    if (currentConfig.bannerUrl) {
      bannerLivePreview.style.backgroundImage = `linear-gradient(90deg, rgba(7,6,5,0.72) 0%, rgba(7,6,5,0.2) 65%), url('${currentConfig.bannerUrl}')`;
    } else {
      const p = theme.BANNER_PRESETS[currentConfig.bannerPreset] || theme.BANNER_PRESETS.default;
      bannerLivePreview.style.background = p.style;
    }
  }

  if (bannerGrid) {
    bannerGrid.innerHTML = Object.values(theme.BANNER_PRESETS).map(bp => `
      <div class="preset-thumb-card ${currentConfig.bannerPreset === bp.id && !currentConfig.bannerUrl ? 'active' : ''}" data-id="${bp.id}" style="background: ${bp.thumb};"></div>
    `).join('');

    bannerGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.preset-thumb-card');
      if (!card) return;
      const id = card.dataset.id;
      bannerGrid.querySelectorAll('.preset-thumb-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      currentConfig.bannerPreset = id;
      currentConfig.bannerUrl = '';
      if (bannerUrlInput) bannerUrlInput.value = '';

      theme.applyTheme(currentConfig);
      theme.saveConfig(currentConfig);
      updateLiveBannerPreview();
      say('Градиент баннера профиля применен');
    });
  }

  if (applyBannerUrlBtn && bannerUrlInput) {
    if (currentConfig.bannerUrl) bannerUrlInput.value = currentConfig.bannerUrl;

    applyBannerUrlBtn.addEventListener('click', () => {
      const url = bannerUrlInput.value.trim();
      if (url) {
        if (bannerGrid) bannerGrid.querySelectorAll('.preset-thumb-card').forEach(c => c.classList.remove('active'));
        currentConfig.bannerPreset = 'custom';
        currentConfig.bannerUrl = url;
        theme.applyTheme(currentConfig);
        theme.saveConfig(currentConfig);
        updateLiveBannerPreview();
        say('Ссылка на баннер профиля успешно применена');
      }
    });
  }

  if (bannerFileInput) {
    bannerFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('banner', file);

      try {
        say('Загрузка баннера на сервер...');
        const res = await fetch('/api/auth/upload-banner', {
          method: 'POST',
          headers: getAuthHeaders(false),
          body: formData
        });
        const data = await res.json();
        if (res.ok && data.bannerUrl) {
          if (bannerGrid) bannerGrid.querySelectorAll('.preset-thumb-card').forEach(c => c.classList.remove('active'));
          currentConfig.bannerPreset = 'custom';
          currentConfig.bannerUrl = data.bannerUrl;
          if (bannerUrlInput) bannerUrlInput.value = data.bannerUrl;
          theme.applyTheme(currentConfig);
          theme.saveConfig(currentConfig);
          updateLiveBannerPreview();
          say('Собственный баннер профиля успешно установлен');
        } else {
          say(data.error || 'Ошибка загрузки баннера');
        }
      } catch (err) {
        say('Ошибка соединения с сервером');
      }
    });
  }

  if (resetBannerBtn) {
    resetBannerBtn.addEventListener('click', () => {
      if (bannerGrid) {
        bannerGrid.querySelectorAll('.preset-thumb-card').forEach(c => c.classList.remove('active'));
        const def = bannerGrid.querySelector('[data-id="default"]');
        if (def) def.classList.add('active');
      }
      currentConfig.bannerPreset = 'default';
      currentConfig.bannerUrl = '';
      if (bannerUrlInput) bannerUrlInput.value = '';
      theme.applyTheme(currentConfig);
      theme.saveConfig(currentConfig);
      updateLiveBannerPreview();
      say('Баннер профиля сброшен к оригинальному');
    });
  }

  updateLiveBannerPreview();

  /* -------------------------------------------------------------
     4. АВАТАРКА ПРОФИЛЯ
  ------------------------------------------------------------- */
  const avatarFileInput = document.getElementById('avatarFileInput');
  const useSkinAvatarBtn = document.getElementById('useSkinAvatarBtn');
  const resetAvatarBtn = document.getElementById('resetAvatarBtn');
  const prevPav = document.getElementById('prevPav');

  function updatePreviewAvatar() {
    if (!prevPav) return;
    if (currentConfig.avatarType === 'custom' && currentConfig.avatarUrl) {
      prevPav.innerHTML = `<img src="${currentConfig.avatarUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;">`;
    } else {
      prevPav.innerHTML = theme.DEFAULT_SKIN_SVG;
    }
  }

  if (useSkinAvatarBtn) {
    useSkinAvatarBtn.addEventListener('click', () => {
      currentConfig.avatarType = 'skin';
      currentConfig.avatarUrl = '';
      theme.applyTheme(currentConfig);
      theme.saveConfig(currentConfig);
      updatePreviewAvatar();
      say('Включено отображение лица из скина игрока');
    });
  }

  if (resetAvatarBtn) {
    resetAvatarBtn.addEventListener('click', () => {
      currentConfig.avatarType = 'skin';
      currentConfig.avatarUrl = '';
      theme.applyTheme(currentConfig);
      theme.saveConfig(currentConfig);
      updatePreviewAvatar();
      say('Аватарка сброшена к стандартной');
    });
  }

  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('avatar', file);

      try {
        say('Загрузка аватарки...');
        const res = await fetch('/api/auth/upload-avatar', {
          method: 'POST',
          headers: getAuthHeaders(false),
          body: formData
        });
        const data = await res.json();
        if (res.ok && data.avatarUrl) {
          currentConfig.avatarType = 'custom';
          currentConfig.avatarUrl = data.avatarUrl;
          theme.applyTheme(currentConfig);
          theme.saveConfig(currentConfig);
          updatePreviewAvatar();
          say('Собственная аватарка успешно установлена');
        } else {
          say(data.error || 'Ошибка загрузки аватара');
        }
      } catch (err) {
        say('Ошибка соединения с сервером');
      }
    });
  }

  updatePreviewAvatar();

  /* -------------------------------------------------------------
     5. КНОПКИ ДЕЙСТВИЙ
  ------------------------------------------------------------- */
  const saveAllBtn = document.getElementById('saveAppearanceBtn');
  const resetAllBtn = document.getElementById('resetAllAppearanceBtn');

  if (saveAllBtn) {
    saveAllBtn.addEventListener('click', async () => {
      theme.saveConfig(currentConfig);
      theme.applyTheme(currentConfig);

      // Синхронизация с сервером
      try {
        const res = await fetch('/api/auth/customization', {
          method: 'POST',
          headers: getAuthHeaders(true),
          body: JSON.stringify(currentConfig)
        });
        if (res.ok) {
          say('Оформление успешно сохранено в профиле');
          return;
        }
      } catch (e) {}

      say('Оформление сохранено локально');
    });
  }

  if (resetAllBtn) {
    resetAllBtn.addEventListener('click', () => {
      if (confirm('Сбросить все настройки оформления к стандартным?')) {
        const def = {
          colorTheme: 'fire',
          customColor: '#ff6a00',
          heroPreset: 'default',
          heroUrl: '',
          bannerPreset: 'default',
          bannerUrl: '',
          avatarType: 'skin',
          avatarUrl: ''
        };
        theme.saveConfig(def);
        theme.applyTheme(def);
        location.reload();
      }
    });
  }

  // Вспомогательная функция для заголовков авторизации
  function getAuthHeaders(isJson = true) {
    try {
      const s = JSON.parse((localStorage.getItem('glade_session') || localStorage.getItem('hoplitex_session')) || '{}');
      const token = s.token || s.id || s.username || (localStorage.getItem('glade_token') || localStorage.getItem('hoplitex_token'));
      const headers = {};
      if (token && token !== 'null' && token !== 'undefined') {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (s.id) headers['x-user-id'] = s.id;
      if (s.username) headers['x-username'] = s.username;
      if (isJson) headers['Content-Type'] = 'application/json';
      return headers;
    } catch (e) {}
    return isJson ? { 'Content-Type': 'application/json' } : {};
  }
});
