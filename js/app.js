/**
 * Glade Launcher Application Script
 */

const API_BASE = '/api';

// Проверка сессии при открытии любой страницы лаунчера
(function checkAuthentication() {
  const session = (localStorage.getItem('glade_session') || localStorage.getItem('hoplitex_session'));
  if (!session) {
    window.location.href = 'auth.html';
    return;
  }
  try {
    const s = JSON.parse(session);
    if (!s || !s.loggedIn) {
      window.location.href = 'auth.html';
    }
  } catch (e) {
    window.location.href = 'auth.html';
  }
})();

// Уведомления Toast
const toast = document.getElementById('toast');
let toastTimer;
function say(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

const $ = id => document.getElementById(id);

// Обработка кликов по кнопкам соцсетей проекта
window.openSocialLink = function(e, network) {
  if (e) e.preventDefault();
  const links = window.GLADE_SOCIAL_LINKS || {
    tg: 'https://t.me/moonfallbest',
    ds: 'https://discord.gg/PyJzjwb4Bp',
    yt: '',
    tt: ''
  };
  const url = links[network];
  if (url && url !== '#') {
    try {
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(url);
        return;
      }
    } catch (err) {}
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    const titles = { tg: 'Telegram', ds: 'Discord', yt: 'YouTube', tt: 'TikTok' };
    say(`Ссылка на ${titles[network] || 'соцсеть'} скоро появится`);
  }
};

// Получение заголовка авторизации
function getAuthHeaders() {
  try {
    const s = JSON.parse((localStorage.getItem('glade_session') || localStorage.getItem('hoplitex_session')) || '{}');
    const token = s.token || s.id || s.username || (localStorage.getItem('glade_token') || localStorage.getItem('hoplitex_token'));
    if (token && token !== 'null' && token !== 'undefined') {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      if (s.id) headers['x-user-id'] = s.id;
      if (s.username) headers['x-username'] = s.username;
      return headers;
    }
  } catch (e) {}
  return { 'Content-Type': 'application/json' };
}

// Отображение экрана бана
function showBanOverlay(reason, bannedAt) {
  if (document.getElementById('banOverlay')) return; // уже отображен

  const overlay = document.createElement('div');
  overlay.id = 'banOverlay';
  overlay.className = 'ban-overlay';

  const dateStr = bannedAt 
    ? new Date(bannedAt).toLocaleString('ru-RU') 
    : new Date().toLocaleString('ru-RU');

  overlay.innerHTML = `
    <div class="ban-card">
      <div class="ban-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
      </div>
      <h2>ДОСТУП ЗАБЛОКИРОВАН</h2>
      <p class="ban-sub">Администрация сервера заблокировала ваш доступ к клиенту Glade Launcher.</p>
      
      <div class="ban-details">
        <div><b>Причина:</b> <span>${reason || 'Нарушение правил проекта'}</span></div>
        <div><b>Дата:</b> <span>${dateStr}</span></div>
      </div>

      <button id="banLogoutBtn" class="ban-btn">Выйти из аккаунта</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Блокируем кнопку запуска игры, если она есть
  if ($('play')) {
    $('play').disabled = true;
    $('play').style.opacity = '0.4';
    $('play').style.cursor = 'not-allowed';
  }

  document.getElementById('banLogoutBtn').addEventListener('click', () => {
    localStorage.removeItem('glade_session'); localStorage.removeItem('hoplitex_session');
    window.location.href = 'auth.html';
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  // Получаем данные текущей сессии
  let currentUser = 'Игрок';
  let currentEmail = '';
  let currentRole = 'user';
  let token = null;

  const STAFF_ROLE_MAP = {
    user: { title: 'Игрок', color: '#a89480', borderColor: 'transparent' },
    trainee: { title: 'Стажёр', color: '#5dade2', borderColor: '#3498db' },
    helper: { title: 'Хелпер', color: '#58d68d', borderColor: '#2ecc71' },
    senior_helper: { title: 'Ст. хелпер', color: '#48c9b0', borderColor: '#1abc9c' },
    moderator: { title: 'Модератор', color: '#f39c12', borderColor: '#e67e22' },
    senior_moderator: { title: 'Ст. модератор', color: '#e67e22', borderColor: '#d35400' },
    admin: { title: 'Администратор', color: '#e74c3c', borderColor: '#c0392b' },
    head_admin: { title: 'Гл. администратор', color: '#c39bd3', borderColor: '#8e44ad' }
  };

  try {
    const s = JSON.parse((localStorage.getItem('glade_session') || localStorage.getItem('hoplitex_session')) || '{}');
    if (s.username) currentUser = s.username;
    if (s.email) currentEmail = s.email;
    const lowerUser = (s.username || '').toLowerCase();
    if (lowerUser === 'lorsik' || lowerUser === 'lors1k' || lowerUser === 'lors1k_' || lowerUser === 'admin') {
      currentRole = 'head_admin';
      s.role = 'head_admin';
      try { localStorage.setItem('glade_session', JSON.stringify(s)); } catch (e) {}
    } else if (s.role) {
      currentRole = s.role;
    }
    token = s.token || s.id || s.username || (localStorage.getItem('glade_token') || localStorage.getItem('hoplitex_token'));
    if (token === 'null' || token === 'undefined') token = null;
  } catch (e) {}

  // Заполняем данные на странице
  if ($('uname')) $('uname').textContent = currentUser;
  if ($('pname')) $('pname').textContent = currentUser;
  if ($('pnick')) $('pnick').textContent = currentUser;
  if ($('pemail')) $('pemail').textContent = currentEmail || 'Не привязана';
  if ($('prole')) {
    const rInfo = STAFF_ROLE_MAP[currentRole] || STAFF_ROLE_MAP.user;
    $('prole').textContent = rInfo.title;
    $('prole').style.color = rInfo.color;
    $('prole').style.borderColor = rInfo.borderColor;
  }

  // Кнопка выхода из системы
  const logoutBtn = $('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      try {
        fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: getAuthHeaders()
        });
      } catch (err) {}
      localStorage.removeItem('glade_session'); localStorage.removeItem('hoplitex_session');
      window.location.href = 'auth.html';
    });
  }



  /* ---------------------- ПРОВЕРКА СТАТУСА И БАНА (HEARTBEAT) ---------------------- */
  async function checkUserStatus() {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: getAuthHeaders()
      });

      if (res.status === 403) {
        const data = await res.json();
        showBanOverlay(data.banReason, data.bannedAt);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          if (data.user.isBanned) {
            showBanOverlay(data.user.banReason, data.user.bannedAt);
            return;
          }
          currentRole = data.user.role || 'user';
          const lowerUser = (data.user.username || '').toLowerCase();
          if (lowerUser === 'lorsik' || lowerUser === 'lors1k' || lowerUser === 'lors1k_' || lowerUser === 'admin') {
            currentRole = 'head_admin';
          }
          try {
            const s = JSON.parse((localStorage.getItem('glade_session') || localStorage.getItem('hoplitex_session')) || '{}');
            s.role = currentRole;
            localStorage.setItem('glade_session', JSON.stringify(s));
          } catch (e) {}
          setupAdminLink(currentRole);
          if ($('prole')) {
            const rInfo = STAFF_ROLE_MAP[currentRole] || STAFF_ROLE_MAP.user;
            $('prole').textContent = rInfo.title;
            $('prole').style.color = rInfo.color;
            $('prole').style.borderColor = rInfo.borderColor;
          }
          if (window.GladeTheme && data.user.customization) {
            const merged = Object.assign({}, window.GladeTheme.loadConfig(), data.user.customization);
            window.GladeTheme.saveConfig(merged);
            window.GladeTheme.applyTheme(merged);
          }
        }
      }
    } catch (err) {
      // Сервер временно оффлайн, продолжаем локально
    }
  }

  // Отправка heartbeat для поддержания онлайн-статуса
  async function sendHeartbeat() {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/auth/heartbeat`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (res.status === 403) {
        const data = await res.json();
        showBanOverlay(data.banReason, data.bannedAt);
      }
    } catch (e) {}
  }

  // Настройка кнопки Админ-панели в боковом меню
  function setupAdminLink(role) {
    const nav = $('nav');
    if (!nav) return;

    let adminLink = document.querySelector('.nav-admin-link');
    const isStaff = ['trainee', 'helper', 'senior_helper', 'moderator', 'senior_moderator', 'admin', 'head_admin'].includes(role);
    if (isStaff) {
      if (!adminLink) {
        adminLink = document.createElement('a');
        adminLink.href = 'admin.html';
        adminLink.className = 'nav-admin-link';
        adminLink.innerHTML = `
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2l9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10"/>
          </svg>
          Админ-панель
        `;
        nav.appendChild(adminLink);
      }
    } else {
      if (adminLink) adminLink.remove();
    }
  }

  // Обновление счётчика непрочитанных сообщений и заявок в друзья
  async function updateFriendsBadge() {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/friends/unread-count`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const navBadge = document.getElementById('friendsBadge');
        if (navBadge) {
          const total = (data.totalUnread || 0) + (data.pendingRequests || 0);
          if (total > 0) {
            navBadge.textContent = total;
            navBadge.style.display = 'inline-block';
          } else {
            navBadge.style.display = 'none';
          }
        }
      }
    } catch (e) {}
  }

  // Проверяем статус при загрузке
  setupAdminLink(currentRole);
  await checkUserStatus();
  await updateFriendsBadge();

  // Запускаем периодический heartbeat и проверку сообщений раз в 15 секунд
  setInterval(() => {
    sendHeartbeat();
    updateFriendsBadge();
  }, 15000);

  /* ---------------------- МОДЫ (СИНХРОНИЗАЦИЯ С СЕРВЕРОМ) ---------------------- */
  const mgrid = $('mgrid');
  if (mgrid) {
    const cube = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2l9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10"/></svg>';
    
    // Хранилище включенных/установленных модов в localStorage
    let installedMap = {};
    try {
      installedMap = JSON.parse((localStorage.getItem('glade_installed_mods') || localStorage.getItem('hoplitex_installed_mods')) || '{}');
    } catch (e) {
      installedMap = {};
    }

    let enabledMap = {};
    try {
      enabledMap = JSON.parse((localStorage.getItem('glade_enabled_mods') || localStorage.getItem('hoplitex_enabled_mods')) || '{}');
    } catch (e) {
      enabledMap = {};
    }

    let serverMods = [];
    let tab = 'inst', q = '';

    // Загрузка модов с сервера
    async function fetchServerMods() {
      try {
        const token = localStorage.getItem('glade_auth_token') || localStorage.getItem('hoplitex_auth_token');
        const res = await fetch(`${API_BASE}/mods`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.mods)) {
            serverMods = data.mods;

            // Очищаем из локального хранилища те моды, которые были удалены с сервера админом!
            const serverModIds = new Set(serverMods.map(m => m.id));
            let changed = false;
            for (const id of Object.keys(installedMap)) {
              if (!serverModIds.has(id)) {
                delete installedMap[id];
                delete enabledMap[id];
                changed = true;
              }
            }
            if (changed) {
              localStorage.setItem('glade_installed_mods', JSON.stringify(installedMap));
              localStorage.setItem('glade_enabled_mods', JSON.stringify(enabledMap));
            }
          }
        }
      } catch (err) {
        console.warn('Сервер недоступен для загрузки каталога модов');
      }

      renderMods();
    }

    function renderMods() {
      if (serverMods.length === 0) {
        if ($('mcount')) $('mcount').textContent = 'Установлено: 0 · Включено: 0';
        mgrid.innerHTML = '<p class="empty">В каталоге пока нет опубликованных модов. Вы можете опубликовать их в панели администратора.</p>';
        return;
      }

      const allInstalled = serverMods.filter(m => m.required || installedMap[m.id]);
      const onCount = allInstalled.filter(m => m.required || (enabledMap[m.id] !== false)).length;
      if ($('mcount')) $('mcount').textContent = 'Установлено: ' + allInstalled.length + ' · Включено: ' + onCount;

      const filtered = serverMods.filter(m => {
        const isInst = m.required || !!installedMap[m.id];
        const matchTab = (tab === 'inst') ? isInst : !isInst;
        const matchSearch = m.name.toLowerCase().includes(q) || (m.description && m.description.toLowerCase().includes(q));
        return matchTab && matchSearch;
      });

      if (filtered.length === 0) {
        if (tab === 'inst') {
          mgrid.innerHTML = '<p class="empty">У вас пока нет установленных модов. Перейдите во вкладку «Каталог», чтобы установить моды.</p>';
        } else {
          mgrid.innerHTML = '<p class="empty">Все доступные моды уже установлены или не соответствуют поисковому запросу.</p>';
        }
        return;
      }

      mgrid.innerHTML = filtered.map(m => {
        const isInst = m.required || !!installedMap[m.id];
        const isEnabled = m.required || (enabledMap[m.id] !== false);
        const isLock = !!m.required;
        const hasFileBadge = m.hasFile || m.filename ? '<span title="Реальный .jar файл на сервере" style="color:#2ecc71; font-size:11px; margin-left:6px;">.jar</span>' : '';

        return `
          <article class="mod">
            <div class="top">
              <div class="mic">${cube}</div>
              <div>
                <b>${m.name}</b> ${hasFileBadge}
                ${isLock ? '<div class="tag2">Обязательный</div>' : ''}
              </div>
            </div>
            <p>${m.description || 'Описание отсутствует'}</p>
            <div class="meta">
              <span>v${m.version || '1.0'} · ${m.size || '1,0 МБ'}</span>
              ${isInst 
                ? `<label class="sw"><input type="checkbox" data-id="${m.id}" aria-label="Включить ${m.name}"${isEnabled ? ' checked' : ''}${isLock ? ' disabled' : ''}><i></i></label>`
                : `<button class="pbtn" data-add="${m.id}">Установить</button>`
              }
            </div>
          </article>
        `;
      }).join('');
    }

    if ($('mtabs')) {
      $('mtabs').onclick = e => {
        const b = e.target.closest('button');
        if (!b) return;
        tab = b.dataset.t;
        [...$('mtabs').children].forEach(x => x.classList.toggle('on', x === b));
        renderMods();
      };
    }

    if ($('msearch')) {
      $('msearch').oninput = e => {
        q = e.target.value.trim().toLowerCase();
        renderMods();
      };
    }

    mgrid.onchange = e => {
      const id = e.target.dataset.id;
      if (id) {
        enabledMap[id] = e.target.checked;
        localStorage.setItem('glade_enabled_mods', JSON.stringify(enabledMap));
        renderMods();
      }
    };

    mgrid.onclick = e => {
      const b = e.target.closest('[data-add]');
      if (!b) return;
      const modId = b.dataset.add;
      const modObj = serverMods.find(m => m.id === modId);

      installedMap[modId] = true;
      enabledMap[modId] = true;
      localStorage.setItem('glade_installed_mods', JSON.stringify(installedMap));
      localStorage.setItem('glade_enabled_mods', JSON.stringify(enabledMap));
      
      say('«' + (modObj ? modObj.name : 'Мод') + '» скачивается и устанавливается...');
      renderMods();

      // Запускаем реальное скачивание файла мода (.jar) в браузере
      const downloadLink = document.createElement('a');
      downloadLink.href = `${API_BASE}/mods/${modId}/download`;
      downloadLink.download = (modObj && modObj.originalName) ? modObj.originalName : `${modId}.jar`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };

    // Первичный запрос модов
    fetchServerMods();
  }

  /* ------------------- НАСТРОЙКИ ------------------- */
  async function openFolder(type) {
    try {
      if (window.electronAPI && window.electronAPI.openFolder) {
        const res = await window.electronAPI.openFolder(type);
        if (res && res.success) {
          say('Папка открыта в проводнике');
          return;
        }
      }
      const res = await fetch('/api/launcher/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      const data = await res.json();
      if (data && data.success) {
        say('Папка открыта в проводнике');
      } else {
        say(data.error || 'Не удалось открыть папку', 'error');
      }
    } catch (err) {
      console.error('Ошибка открытия папки:', err);
      say('Ошибка открытия папки', 'error');
    }
  }

  async function loadFolderPaths() {
    try {
      let paths = null;
      if (window.electronAPI && window.electronAPI.getPaths) {
        paths = await window.electronAPI.getPaths();
      }
      if (!paths || !paths.success) {
        const res = await fetch('/api/launcher/paths');
        paths = await res.json();
      }
      if (paths && paths.success) {
        if ($('launcherPathInput')) $('launcherPathInput').value = paths.userDataDir || '';
        if ($('gamePathInput')) $('gamePathInput').value = paths.gameDir || '';
        document.querySelectorAll('input.inp.f').forEach(input => {
          if (input.id === 'launcherPathInput' || input.id === 'gamePathInput') return;
          const label = (input.getAttribute('aria-label') || '').toLowerCase();
          if (label.includes('игры') || label.includes('minecraft')) {
            input.value = paths.gameDir || '';
          } else if (label.includes('лаунчер')) {
            input.value = paths.userDataDir || '';
          }
        });
      }
    } catch (e) {}
  }

  loadFolderPaths();

  if ($('ram')) {
    $('ram').oninput = e => $('ramo').textContent = e.target.value + ' ГБ';
  }
  if ($('ssave')) {
    $('ssave').onclick = () => say('Настройки сохранены');
  }
  if ($('sopen')) {
    $('sopen').onclick = () => openFolder('launcher');
  }
  if ($('sopenLauncher')) {
    $('sopenLauncher').onclick = () => openFolder('launcher');
  }
  if ($('sopenGame')) {
    $('sopenGame').onclick = () => openFolder('game');
  }
  if ($('sreset')) {
    $('sreset').onclick = () => {
      document.querySelectorAll('#v-settings input, #v-settings select').forEach(x => {
        if (x.type === 'checkbox') x.checked = x.defaultChecked;
        else if (x.tagName === 'SELECT') x.selectedIndex = 0;
        else x.value = x.defaultValue;
      });
      if ($('ram') && $('ramo')) $('ramo').textContent = $('ram').value + ' ГБ';
      say('Настройки сброшены');
    };
  }

  /* -------------------- ПРОФИЛЬ -------------------- */
  const pal = { 1: '#3a1c0a', 2: '#e0955a', 3: '#fff3e6', 4: '#ff6a00', 5: '#8a3a12' };
  const face = [
    '11111111',
    '11111111',
    '12222221',
    '22222222',
    '23422432',
    '22222222',
    '22255222',
    '12222221'
  ];
  const avSvg = '<svg viewBox="0 0 8 8" shape-rendering="crispEdges">' +
    face.map((r, y) => [...r].map((c, x) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[c]}"/>`).join('')).join('') +
    '</svg>';

  if (window.GladeTheme) {
    window.GladeTheme.updateDomAvatars();
  } else {
    if ($('pav')) $('pav').innerHTML = avSvg;
    if ($('pav2')) $('pav2').innerHTML = avSvg;
  }

  if ($('seg')) {
    $('seg').onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.id === 'msbtn') {
        say('Вход через Microsoft подключим вместе с запуском игры');
        return;
      }
      [...$('seg').children].forEach(x => x.classList.toggle('on', x === b));
    };
  }

  /* -------------------- 3D СКИН И ПЛАЩ (SKINVIEW3D) -------------------- */
  if ($('skin-canvas') && window.skinview3d) {
    const canvas = $('skin-canvas');
    let skinViewer = null;

    try {
      skinViewer = new skinview3d.SkinViewer({
        canvas: canvas,
        width: 280,
        height: 390,
        skin: '/assets/skins/default.png',
        model: 'default'
      });

      skinViewer.camera.position.z = 70;
      skinViewer.zoom = 0.88;
      skinViewer.autoRotate = true;
      skinViewer.autoRotateSpeed = 0.8;

      let currentAnimation = new skinview3d.WalkingAnimation();
      skinViewer.animation = currentAnimation;
      let isPaused = false;

      // Получаем актуальный скин, плащ и метаданные с сервера
      async function loadUserSkinData() {
        try {
          const res = await fetch(`${API_BASE}/auth/me`, { headers: getAuthHeaders() });
          if (res.ok) {
            const data = await res.json();
            const u = data.user;
            if (u) {
              if (u.createdAt && $('pcreated')) {
                $('pcreated').textContent = new Date(u.createdAt).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                });
              }
              if (u.role && $('prole')) {
                const rInfo = STAFF_ROLE_MAP[u.role] || STAFF_ROLE_MAP.user;
                $('prole').textContent = rInfo.title;
                $('prole').style.color = rInfo.color;
                $('prole').style.borderColor = rInfo.borderColor;
              }
              if (u.email && $('pemail')) {
                $('pemail').textContent = u.email;
              }

              const skinUrl = u.skinUrl || (u.username.toLowerCase() === 'lorsik' ? '/assets/skins/Lors1k_.png' : '/assets/skins/default.png');
              const model = u.modelType || 'default';
              skinViewer.loadSkin(skinUrl, { model });

              document.querySelectorAll('#modelToggle .m-btn').forEach(b => {
                b.classList.toggle('on', b.dataset.model === model);
              });

              if (u.capeUrl) {
                skinViewer.loadCape(u.capeUrl);
              } else if (u.username.toLowerCase() === 'lorsik') {
                skinViewer.loadCape('/assets/capes/Lors1k_.png');
              } else {
                skinViewer.resetCape();
              }
            }
          }
        } catch (e) {
          skinViewer.loadSkin('/assets/skins/default.png');
        }
      }
      loadUserSkinData();

      // Управление анимациями персонажа
      const animBtns = document.querySelectorAll('#animGroup .anim-btn[data-anim]');
      animBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          animBtns.forEach(b => b.classList.remove('on'));
          btn.classList.add('on');
          const animType = btn.dataset.anim;
          isPaused = false;
          updatePauseBtn();

          if (animType === 'idle') {
            currentAnimation = new skinview3d.IdleAnimation();
          } else if (animType === 'walk') {
            currentAnimation = new skinview3d.WalkingAnimation();
          } else if (animType === 'run') {
            currentAnimation = new skinview3d.RunningAnimation();
          } else if (animType === 'wave') {
            currentAnimation = new skinview3d.WaveAnimation();
          }
          skinViewer.animation = currentAnimation;
        });
      });

      // Кнопка паузы
      const pauseBtn = $('pauseAnimBtn');
      function updatePauseBtn() {
        if (!pauseBtn) return;
        if (isPaused) {
          pauseBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
          pauseBtn.title = 'Возобновить анимацию';
        } else {
          pauseBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
          pauseBtn.title = 'Поставить на паузу';
        }
      }
      if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
          isPaused = !isPaused;
          skinViewer.animation = isPaused ? null : currentAnimation;
          updatePauseBtn();
        });
      }

      // Переключение модели Steve (4px) / Alex (3px)
      const modelBtns = document.querySelectorAll('#modelToggle .m-btn');
      modelBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
          modelBtns.forEach(b => b.classList.remove('on'));
          btn.classList.add('on');
          const model = btn.dataset.model;
          try {
            await fetch(`${API_BASE}/auth/skin-model`, {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({ model })
            });
          } catch (e) {}

          if (skinViewer.playerObject && skinViewer.playerObject.skin) {
            skinViewer.loadSkin(skinViewer.playerObject.skin.texture, { model });
          }
          say(model === 'slim' ? 'Модель Alex (тонкие руки 3px)' : 'Модель Steve (классика 4px)');
        });
      });

      // Переключение авто-вращения
      const autoRotateBtn = $('autoRotateBtn');
      if (autoRotateBtn) {
        autoRotateBtn.addEventListener('click', () => {
          skinViewer.autoRotate = !skinViewer.autoRotate;
          autoRotateBtn.classList.toggle('on', skinViewer.autoRotate);
        });
      }

      // Загрузка скина (.png)
      const skinFileInput = $('skinFileInput');
      const uploadSkinBtn = $('uploadSkinBtn');
      if (uploadSkinBtn && skinFileInput) {
        uploadSkinBtn.addEventListener('click', () => skinFileInput.click());
        skinFileInput.addEventListener('change', async (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          if (!file.name.toLowerCase().endsWith('.png')) {
            say('Файл скина должен быть в формате .png');
            return;
          }

          const activeModelBtn = document.querySelector('#modelToggle .m-btn.on');
          const model = activeModelBtn ? activeModelBtn.dataset.model : 'default';

          const formData = new FormData();
          formData.append('skin', file);
          formData.append('model', model);

          say('Загрузка скина на сервер...');
          try {
            const token = (JSON.parse((localStorage.getItem('glade_session') || localStorage.getItem('hoplitex_session')) || '{}')).token;
            const res = await fetch(`${API_BASE}/auth/upload-skin`, {
              method: 'POST',
              headers: token ? { 'Authorization': `Bearer ${token}` } : {},
              body: formData
            });
            const data = await res.json();
            if (res.ok) {
              skinViewer.loadSkin(data.skinUrl, { model });
              say('Скин успешно установлен!');
            } else {
              say(data.error || 'Ошибка загрузки скина');
            }
          } catch (err) {
            say('Ошибка соединения с сервером');
          }
          skinFileInput.value = '';
        });
      }

      // Загрузка плаща (.png)
      const capeFileInput = $('capeFileInput');
      const uploadCapeBtn = $('uploadCapeBtn');
      if (uploadCapeBtn && capeFileInput) {
        uploadCapeBtn.addEventListener('click', () => capeFileInput.click());
        capeFileInput.addEventListener('change', async (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          if (!file.name.toLowerCase().endsWith('.png')) {
            say('Файл плаща должен быть в формате .png');
            return;
          }

          const formData = new FormData();
          formData.append('cape', file);

          say('Загрузка плаща на сервер...');
          try {
            const token = (JSON.parse((localStorage.getItem('glade_session') || localStorage.getItem('hoplitex_session')) || '{}')).token;
            const res = await fetch(`${API_BASE}/auth/upload-cape`, {
              method: 'POST',
              headers: token ? { 'Authorization': `Bearer ${token}` } : {},
              body: formData
            });
            const data = await res.json();
            if (res.ok) {
              skinViewer.loadCape(data.capeUrl);
              say('Плащ успешно одет!');
            } else {
              say(data.error || 'Ошибка загрузки плаща');
            }
          } catch (err) {
            say('Ошибка соединения с сервером');
          }
          capeFileInput.value = '';
        });
      }

      // Сброс скина
      const resetSkinBtn = $('resetSkinBtn');
      if (resetSkinBtn) {
        resetSkinBtn.addEventListener('click', async () => {
          try {
            const res = await fetch(`${API_BASE}/auth/reset-skin`, {
              method: 'POST',
              headers: getAuthHeaders()
            });
            const data = await res.json();
            skinViewer.loadSkin(data.skinUrl || '/assets/skins/default.png');
            say('Скин сброшен к стандартному');
          } catch (e) {
            skinViewer.loadSkin('/assets/skins/default.png');
          }
        });
      }

      // Снятие плаща
      const resetCapeBtn = $('resetCapeBtn');
      if (resetCapeBtn) {
        resetCapeBtn.addEventListener('click', async () => {
          try {
            await fetch(`${API_BASE}/auth/reset-cape`, {
              method: 'POST',
              headers: getAuthHeaders()
            });
            skinViewer.resetCape();
            say('Плащ успешно снят');
          } catch (e) {
            skinViewer.resetCape();
          }
        });
      }

    } catch (err) {
      console.error('[SkinViewer Error]', err);
    }
  }

  /* -------------------- ГЛАВНАЯ -------------------- */
  document.querySelectorAll('.mode').forEach(m => {
    m.addEventListener('click', () => {
      document.querySelectorAll('.mode').forEach(x => x.classList.toggle('on', x === m));
    });
  });

  /* -------------------- ЗАПУСК ИГРЫ (VERSION 1.0) -------------------- */
  if ($('play')) {
    const playBtn = $('play');
    playBtn.onclick = async () => {
      if (playBtn.disabled) return;

      const originalHtml = playBtn.innerHTML;
      playBtn.disabled = true;
      playBtn.style.opacity = '0.7';
      playBtn.style.cursor = 'wait';
      playBtn.innerHTML = 'Запуск...';

      let ram = 4;
      try {
        const savedSettings = JSON.parse((localStorage.getItem('glade_settings') || localStorage.getItem('hoplitex_settings')) || '{}');
        if (savedSettings.ram) ram = parseInt(savedSettings.ram, 10) || 4;
      } catch (e) {}

      // Определяем никнейм игрока
      let playerNick = (currentUser && currentUser !== 'Игрок') ? currentUser : 'Lors1k_';

      say('Запуск Glade (Version 1.0)...');

      try {
        let launchRes = null;
        if (window.electronAPI && typeof window.electronAPI.launchGame === 'function') {
          launchRes = await window.electronAPI.launchGame({
            engine: 'java',
            username: playerNick,
            ram: ram
          });
        } else {
          const resp = await fetch(`${API_BASE}/launcher/launch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              engine: 'java',
              username: playerNick,
              ram: ram
            })
          });
          launchRes = await resp.json();
        }

        if (launchRes && launchRes.success) {
          say(launchRes.message || 'Игра успешно запущена!');
          playBtn.innerHTML = 'В игре';
          setTimeout(() => {
            playBtn.disabled = false;
            playBtn.style.opacity = '1';
            playBtn.style.cursor = 'pointer';
            playBtn.innerHTML = originalHtml;
          }, 4000);
        } else {
          const errMsg = (launchRes && launchRes.error) || 'Не удалось запустить игру';
          say('Ошибка запуска: ' + errMsg);
          playBtn.disabled = false;
          playBtn.style.opacity = '1';
          playBtn.style.cursor = 'pointer';
          playBtn.innerHTML = originalHtml;
        }
      } catch (err) {
        console.error('Launch failed:', err);
        say('Ошибка запуска клиента: ' + (err.message || 'сервер недоступен'));
        playBtn.disabled = false;
        playBtn.style.opacity = '1';
        playBtn.style.cursor = 'pointer';
        playBtn.innerHTML = originalHtml;
      }
    };
  }

  const u = $('upd');
  if (u) {
    u.onclick = () => {
      u.classList.add('spin');
      setTimeout(() => {
        u.classList.remove('spin');
        say('Установлена последняя версия клиента');
      }, 1200);
    };
  }

  /* -------------------- УПРАВЛЕНИЕ ОКНОМ И ЗАКРЫТИЕ РАЗДЕЛОВ -------------------- */
  const minBtn = document.querySelector('.wc button[aria-label="Свернуть"]');
  const maxBtn = document.querySelector('.wc button[aria-label="Развернуть"]');
  const closeBtn = document.querySelector('.wc button[aria-label="Закрыть"]');

  // Проверяем, находимся ли мы на внутренней странице (Настройки, Моды, Профиль и др.)
  const isSubPage = !!document.querySelector('.view') && 
                    !location.pathname.endsWith('index.html') && 
                    !location.pathname.endsWith('/');

  if (minBtn) {
    minBtn.setAttribute('title', 'Свернуть окно');
    minBtn.onclick = (e) => {
      e.preventDefault();
      if (window.electronAPI && window.electronAPI.minimize) {
        window.electronAPI.minimize();
      } else {
        say('Сворачивание доступно в десктопном приложении');
      }
    };
  }

  if (maxBtn) {
    maxBtn.setAttribute('title', 'Развернуть на весь экран');
    maxBtn.onclick = (e) => {
      e.preventDefault();
      if (window.electronAPI && window.electronAPI.maximize) {
        window.electronAPI.maximize();
      } else {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
    };
  }

  // Горячая клавиша Escape для быстрого возврата на главную с внутренних вкладок
  if (isSubPage) {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.keyCode === 27) {
        window.location.href = 'index.html';
      }
    });
  }

  if (closeBtn) {
    if (isSubPage) {
      // На внутренних страницах (если есть крестик) закрывает раздел и возвращает на главную
      closeBtn.setAttribute('title', 'Закрыть и вернуться на главную (Esc)');
      closeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = 'index.html';
      };
    } else {
      // На главной странице лаунчера (index.html) крестик закрывает само приложение
      closeBtn.setAttribute('title', 'Закрыть приложение');
      closeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.electronAPI && window.electronAPI.close) {
          window.electronAPI.close();
        } else {
          say('Закрытие доступно в десктопном приложении');
        }
      };
    }
  }
});
