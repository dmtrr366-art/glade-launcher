/**
 * Glade Launcher — Admin Console JavaScript
 */

const API_BASE = '/api';

// Toast Notifications
const toastEl = document.getElementById('toast');
let toastTimer;
function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

// Helpers
const $ = id => document.getElementById(id);

let currentSession = null;
let allUsers = [];
let allMods = [];
let allTickets = [];
let activeUserFilter = 'all';
let activeTicketFilter = 'all';
let currentAdminLevel = 6;
let currentSelectedTicketId = null;
let banTargetUserId = null;
let selectedModFile = null;

// Форматирование размера файла
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 КБ';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

// Получение заголовка авторизации
function getAuthHeader(isMultipart = false) {
  let token = null;
  let userId = null;
  let username = null;

  if (currentSession) {
    token = currentSession.token;
    userId = currentSession.id;
    username = currentSession.username;
  }
  if (!token || token === 'null' || token === 'undefined') {
    token = (localStorage.getItem('glade_token') || localStorage.getItem('hoplitex_token'));
  }
  if (!token || token === 'null' || token === 'undefined') {
    token = userId || username;
  }

  const headers = {};
  if (token && token !== 'null' && token !== 'undefined') {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (userId) {
    headers['x-user-id'] = userId;
  }
  if (username) {
    headers['x-username'] = username;
  }
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Проверяем наличие сессии
  const rawSession = (localStorage.getItem('glade_session') || localStorage.getItem('hoplitex_session'));
  if (!rawSession) {
    window.location.href = 'auth.html';
    return;
  }

  try {
    currentSession = JSON.parse(rawSession);
  } catch (e) {
    window.location.href = 'auth.html';
    return;
  }

  // 2. Проверяем права администратора на сервере
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeader()
    });

    const roleLevels = {
      user: 0, trainee: 1, helper: 2, senior_helper: 3,
      moderator: 4, senior_moderator: 5, admin: 6, head_admin: 7
    };

    if (res.ok) {
      const data = await res.json();
      let role = (data.user && data.user.role) || 'user';
      const uName = ((data.user && data.user.username) || currentSession.username || '').toLowerCase();
      if (uName === 'lorsik' || uName === 'lors1k' || uName === 'lors1k_' || uName === 'admin') {
        role = 'head_admin';
      }
      currentAdminLevel = roleLevels[role] || (role === 'admin' ? 6 : 0);

      if (data.user) {
        currentSession.role = role;
        try {
          localStorage.setItem('glade_session', JSON.stringify(currentSession));
        } catch(e) {}
      }

      if (!data.user || currentAdminLevel < 1) {
        alert('Доступ запрещён: требуются права персонала или администратора.');
        window.location.href = 'index.html';
        return;
      }

      // Отображаем имя администратора
      if ($('adminName')) $('adminName').textContent = data.user.username;
    } else {
      let role = currentSession.role || 'user';
      const uName = (currentSession.username || '').toLowerCase();
      if (uName === 'lorsik' || uName === 'lors1k' || uName === 'lors1k_' || uName === 'admin') {
        role = 'head_admin';
      }
      currentAdminLevel = roleLevels[role] || (role === 'admin' ? 6 : 0);

      if (currentAdminLevel >= 1) {
        console.warn('Сервер вернул статус ' + res.status + ', разрешаем доступ по роли ' + role);
        if ($('adminName')) $('adminName').textContent = currentSession.username || 'Администратор';
      } else {
        alert('У вас нет прав администратора для доступа к этой панели!');
        window.location.href = 'index.html';
        return;
      }
    }

  } catch (err) {
    console.warn('Сервер недоступен, проверка через локальные данные:', err);
    const roleLevels = {
      user: 0, trainee: 1, helper: 2, senior_helper: 3,
      moderator: 4, senior_moderator: 5, admin: 6, head_admin: 7
    };
    let role = currentSession.role || 'user';
    const uName = (currentSession.username || '').toLowerCase();
    if (uName === 'lorsik' || uName === 'lors1k' || uName === 'lors1k_' || uName === 'admin') {
      role = 'head_admin';
    }
    currentAdminLevel = roleLevels[role] || (role === 'admin' ? 6 : 0);

    if (currentAdminLevel < 1) {
      alert('У вас нет прав администратора для доступа к этой панели!');
      window.location.href = 'index.html';
      return;
    }
    if ($('adminName')) $('adminName').textContent = currentSession.username || 'Администратор';
  }

  // Настройка табов
  setupTabs();

  // Настройка фильтров и поиска
  setupUserControls();

  // Настройка управления тикетами
  setupTicketControls();

  // Настройка модальных окон и загрузки файлов
  setupModals();

  // Загрузка первичных данных
  await loadStats();
  await loadUsers();
  await loadMods();
  await loadTickets();

  // Автообновление каждые 12 секунд
  setInterval(async () => {
    await loadStats();
    await loadUsers(false); // без сброса состояний
    await loadTickets(false);
  }, 12000);
});

/* ==========================================================================
   Вкладки (Tabs)
   ========================================================================== */
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const target = $(btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });
}

/* ==========================================================================
   Загрузка статистики
   ========================================================================== */
async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/admin/stats`, {
      headers: getAuthHeader()
    });
    if (!res.ok) return;

    const data = await res.json();
    if (data.stats) {
      if ($('statTotalUsers')) $('statTotalUsers').textContent = data.stats.totalUsers;
      if ($('statOnlineUsers')) $('statOnlineUsers').textContent = data.stats.onlineUsers;
      if ($('statBannedUsers')) $('statBannedUsers').textContent = data.stats.bannedUsers;
      if ($('statTotalMods')) $('statTotalMods').textContent = data.stats.totalMods;
    }
  } catch (err) {
    console.error('Ошибка загрузки статистики:', err);
  }
}

/* ==========================================================================
   Управление пользователями
   ========================================================================== */
async function loadUsers(showLoading = true) {
  const tbody = $('usersTableBody');
  if (showLoading && tbody) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 30px;">Загрузка списка пользователей...</td></tr>';
  }

  try {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: getAuthHeader()
    });

    if (!res.ok) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--red); padding: 20px;">Ошибка загрузки пользователей.</td></tr>';
      return;
    }

    const data = await res.json();
    allUsers = data.users || [];
    renderUsers();
  } catch (err) {
    console.error('Ошибка получения пользователей:', err);
  }
}

function renderUsers() {
  const tbody = $('usersTableBody');
  if (!tbody) return;

  const searchQuery = ($('userSearchInput')?.value || '').trim().toLowerCase();

  const filtered = allUsers.filter(user => {
    // Поиск по нику или email
    const matchSearch = user.username.toLowerCase().includes(searchQuery) || 
                        user.email.toLowerCase().includes(searchQuery);
    if (!matchSearch) return false;

    // Фильтр по категории
    if (activeUserFilter === 'online') return user.isOnline;
    if (activeUserFilter === 'banned') return user.isBanned;
    if (activeUserFilter === 'admin') return user.role === 'admin' || user.role === 'head_admin';
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 30px;">Пользователи не найдены</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(u => {
    const isSelf = currentSession && (u.username === currentSession.username || u.id === currentSession.id);
    const initial = u.username.charAt(0).toUpperCase();

    // Форматирование даты
    const regDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    
    // Онлайн статус
    const onlineBadge = u.isBanned 
      ? `<span class="badge badge-banned">Заблокирован</span>`
      : u.isOnline 
        ? `<span class="badge badge-online"><i class="pulsing-dot"></i> В сети</span>`
        : `<span class="badge badge-offline">Офлайн</span>`;

    // Роль
    const ROLES_MAP = {
      user: { title: 'Игрок', badgeClass: 'badge-player', color: '#a09488' },
      trainee: { title: 'Стажёр', badgeClass: 'badge-trainee', color: '#5dade2' },
      helper: { title: 'Хелпер', badgeClass: 'badge-helper', color: '#58d68d' },
      senior_helper: { title: 'Ст. хелпер', badgeClass: 'badge-srhelper', color: '#1abc9c' },
      moderator: { title: 'Модератор', badgeClass: 'badge-mod', color: '#f5b041' },
      senior_moderator: { title: 'Ст. модератор', badgeClass: 'badge-srmod', color: '#e67e22' },
      admin: { title: 'Администратор', badgeClass: 'badge-admin', color: '#e74c3c' },
      head_admin: { title: 'Гл. администратор', badgeClass: 'badge-headadmin', color: '#c39bd3' }
    };
    const rInfo = ROLES_MAP[u.role] || ROLES_MAP.user;
    const roleBadge = `<span class="badge ${rInfo.badgeClass}">${rInfo.title}</span>`;

    // Кнопка бана
    let banButton = '';
    if (!isSelf) {
      if (u.isBanned) {
        banButton = `<button class="btn-sm btn-unban" onclick="unbanUser('${u.id}', '${u.username}')">Разбанить</button>`;
      } else {
        banButton = `<button class="btn-sm btn-ban" onclick="openBanModal('${u.id}', '${u.username}')">Забанить</button>`;
      }
    }

    // Выпадающий список ролей
    let roleSelect = '';
    if (!isSelf) {
      roleSelect = `
        <select class="role-select" onchange="setUserRole('${u.id}', this.value)" title="Изменить ранг">
          ${Object.keys(ROLES_MAP).map(k => `
            <option value="${k}" ${u.role === k ? 'selected' : ''}>${ROLES_MAP[k].title}</option>
          `).join('')}
        </select>
      `;
    }

    // Статус привязки ПК (HWID) для персонала
    let hwidHtml = '';
    if (u.role && u.role !== 'user') {
      if (u.hwid) {
        hwidHtml = `
          <div class="hwid-tag hwid-ok" title="Привязанный HWID: ${u.hwid}">
            ПК: ${u.hwid.slice(0, 14)}... 
            <span class="hwid-del" onclick="resetStaffHwid('${u.id}', '${u.username}')" title="Сбросить привязку">×</span>
          </div>`;
      } else if (u.hwidPending) {
        hwidHtml = `
          <div class="hwid-tag hwid-pending" title="Запрос ПК: ${u.hwidPending}">
            Запрос ПК 
            <button class="btn-hwid-add" onclick="promptManualHwid('${u.id}', '${u.username}', '${u.hwidPending}')">Одобрить</button>
          </div>`;
      } else {
        hwidHtml = `<div><button class="btn-hwid-empty" onclick="promptManualHwid('${u.id}', '${u.username}', '')">+ Привязать ПК</button></div>`;
      }
    }

    return `
      <tr>
        <td>
          <div class="user-cell">
            <div class="user-av">${initial}</div>
            <div class="user-cell-info">
              <b>${u.username} ${isSelf ? '<small style="color:var(--o3)">(Вы)</small>' : ''}</b>
              <small>Рег: ${regDate}</small>
            </div>
          </div>
        </td>
        <td><span style="color:#cfc5be">${u.email}</span></td>
        <td>
          ${roleBadge}
          ${hwidHtml}
        </td>
        <td>
          ${onlineBadge}
          ${u.isBanned && u.banReason ? `<div style="font-size:11px; color:#ff6677; margin-top:4px;">Причина: ${u.banReason}</div>` : ''}
        </td>
        <td>
          <small style="color:var(--muted)">
            ${u.lastSeenAt ? 'Был: ' + new Date(u.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
          </small>
        </td>
        <td>
          <div class="action-btns">
            ${roleSelect}
            ${banButton}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function setupUserControls() {
  const searchInput = $('userSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderUsers());
  }

  const filterButtons = document.querySelectorAll('#userFilters .pill-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeUserFilter = btn.dataset.filter;
      renderUsers();
    });
  });
}

/* ==========================================================================
   Блокировка и разблокировка пользователей
   ========================================================================== */
window.openBanModal = function(userId, username) {
  banTargetUserId = userId;
  if ($('banTargetName')) $('banTargetName').textContent = username;
  if ($('banReasonInput')) $('banReasonInput').value = 'Использование читов / KillAura / Fly';
  const modal = $('banModal');
  if (modal) modal.classList.add('show');
};

window.closeBanModal = function() {
  const modal = $('banModal');
  if (modal) modal.classList.remove('show');
  banTargetUserId = null;
};

window.unbanUser = async function(userId, username) {
  if (!confirm(`Разблокировать доступ игроку ${username}?`)) return;

  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/unban`, {
      method: 'POST',
      headers: getAuthHeader()
    });

    const data = await res.json();
    if (res.ok) {
      showToast(data.message || `Пользователь ${username} разблокирован!`);
      await loadStats();
      await loadUsers(false);
    } else {
      showToast(data.error || 'Ошибка разблокировки');
    }
  } catch (err) {
    console.error('Ошибка разбана:', err);
    showToast('Ошибка связи с сервером');
  }
};

window.setUserRole = async function(userId, newRole) {
  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ role: newRole })
    });

    const data = await res.json();
    if (res.ok) {
      showToast(data.message || 'Роль пользователя успешно изменена');
      await loadUsers(false);
    } else {
      showToast(data.error || 'Ошибка изменения роли');
    }
  } catch (err) {
    console.error('Ошибка смены роли:', err);
    showToast('Ошибка связи с сервером');
  }
};

window.approveStaffHwid = async function(userId, hwid, username, askConfirm = false) {
  if (askConfirm && !confirm(`Одобрить привязку ПК для ${username}?\nСерийный номер: ${hwid}`)) return;
  try {
    const res = await fetch(`${API_BASE}/staff/approve-hwid`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, hwid })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || 'ПК администратора успешно привязан!');
      await loadUsers(false);
    } else {
      showToast(data.error || 'Ошибка привязки ПК');
    }
  } catch (e) {
    console.error('Ошибка approve-hwid:', e);
    showToast('Ошибка связи с сервером');
  }
};

window.resetStaffHwid = async function(userId, username) {
  if (!confirm(`Сбросить привязку ПК для ${username}? Доступ к админ-панели на текущем ПК будет заблокирован.`)) return;
  try {
    const res = await fetch(`${API_BASE}/staff/reset-hwid`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || 'Привязка ПК успешно сброшена!');
      await loadUsers(false);
    } else {
      showToast(data.error || 'Ошибка сброса привязки');
    }
  } catch (e) {
    console.error('Ошибка reset-hwid:', e);
    showToast('Ошибка связи с сервером');
  }
};

let currentHwidUserId = null;
let currentHwidUsername = null;

window.promptManualHwid = function(userId, username, presetHwid = '') {
  currentHwidUserId = userId;
  currentHwidUsername = username;
  if ($('hwidTargetName')) $('hwidTargetName').textContent = username;
  if ($('hwidInput')) $('hwidInput').value = presetHwid || '';
  const modal = $('hwidModal');
  if (modal) modal.classList.add('show');
  setTimeout(() => {
    if ($('hwidInput')) $('hwidInput').focus();
  }, 100);
};

window.closeHwidModal = function() {
  const modal = $('hwidModal');
  if (modal) modal.classList.remove('show');
  currentHwidUserId = null;
  currentHwidUsername = null;
};

window.submitHwidModal = async function() {
  const input = $('hwidInput');
  const hwid = input ? input.value.trim() : '';
  if (!hwid) {
    showToast('Введите серийный номер ПК (HWID)');
    if (input) input.focus();
    return;
  }
  if (!currentHwidUserId) return;

  await window.approveStaffHwid(currentHwidUserId, hwid, currentHwidUsername, false);
  window.closeHwidModal();
};

/* ==========================================================================
   Управление модами
   ========================================================================== */
async function loadMods() {
  const container = $('adminModsGrid');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/mods`);
    if (!res.ok) return;

    const data = await res.json();
    allMods = data.mods || [];
    renderMods();
  } catch (err) {
    console.error('Ошибка загрузки модов:', err);
  }
}

function renderMods() {
  const container = $('adminModsGrid');
  if (!container) return;

  if (allMods.length === 0) {
    container.innerHTML = '<p style="color:var(--muted); grid-column: 1/-1; text-align:center; padding:30px;">Каталог модов пуст. Нажмите «Опубликовать мод», чтобы загрузить реальный файл .jar/.zip.</p>';
    return;
  }

  const categoryNames = {
    'core': 'Системный',
    'optimization': 'Оптимизация',
    'visual': 'Графика',
    'utility': 'Интерфейс'
  };

  container.innerHTML = allMods.map(m => {
    const cat = categoryNames[m.category] || m.category || 'Утилита';
    const fileBadge = m.hasFile || m.filename
      ? `<span class="badge" style="background:rgba(46,204,113,0.15); color:#2ecc71; font-size:11px;">📦 Файл .jar</span>`
      : '';

    return `
      <div class="admin-mod-card">
        <div class="mod-header">
          <div class="mod-title">
            <b>${m.name}</b>
            <span>Версия ${m.version} · ${m.size} ${fileBadge}</span>
          </div>
          ${m.required ? '<span class="badge badge-admin" style="font-size:11px">Обязательный</span>' : ''}
        </div>

        <p class="mod-desc">${m.description}</p>

        <div class="mod-footer">
          <div class="mod-meta-tags">
            <span class="badge badge-player" style="font-size:11px">${cat}</span>
            <a href="${API_BASE}/mods/${m.id}/download" style="color:var(--o3); font-size:12px; text-decoration:none; display:inline-flex; align-items:center; gap:4px;" title="Скачать файл">
              📥 ${m.downloads || 0}
            </a>
          </div>

          <button class="btn-delete-mod" onclick="deleteMod('${m.id}', '${m.name.replace(/'/g, "\\'")}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Удалить
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.deleteMod = async function(modId, modName) {
  if (!confirm(`Вы действительно хотите удалить мод «${modName}» из каталога? Файл мода также будет удален с сервера.`)) return;

  try {
    const res = await fetch(`${API_BASE}/admin/mods/${modId}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });

    const data = await res.json();
    if (res.ok) {
      showToast(`Мод «${modName}» успешно удален!`);
      await loadStats();
      await loadMods();
    } else {
      showToast(data.error || 'Ошибка удаления мода');
    }
  } catch (err) {
    console.error('Ошибка удаления мода:', err);
    showToast('Ошибка связи с сервером');
  }
};

/* ==========================================================================
   Настройка модальных окон и Drag & Drop файлов
   ========================================================================== */
function setupModals() {
  // Закрытие по кнопкам бана
  if ($('closeBanModalBtn')) $('closeBanModalBtn').onclick = closeBanModal;
  if ($('cancelBanBtn')) $('cancelBanBtn').onclick = closeBanModal;

  // Чипы быстрых причин бана
  document.querySelectorAll('.reason-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if ($('banReasonInput')) $('banReasonInput').value = chip.dataset.reason;
    });
  });

  // Подтверждение бана
  if ($('confirmBanBtn')) {
    $('confirmBanBtn').onclick = async () => {
      if (!banTargetUserId) return;
      const reason = ($('banReasonInput')?.value || '').trim() || 'Нарушение правил проекта Glade';

      try {
        const res = await fetch(`${API_BASE}/admin/users/${banTargetUserId}/ban`, {
          method: 'POST',
          headers: getAuthHeader(),
          body: JSON.stringify({ reason })
        });

        const data = await res.json();
        if (res.ok) {
          showToast(data.message || 'Игрок заблокирован в клиенте!');
          closeBanModal();
          await loadStats();
          await loadUsers(false);
        } else {
          showToast(data.error || 'Ошибка блокировки');
        }
      } catch (err) {
        console.error('Ошибка бана:', err);
        showToast('Ошибка связи с сервером');
      }
    };
  }

  // Модалка публикации мода
  const pubModal = $('publishModModal');
  const hwidModal = $('hwidModal');
  if (hwidModal) {
    hwidModal.addEventListener('click', (e) => {
      if (e.target === hwidModal) closeHwidModal();
    });
  }
  if ($('openPublishModalBtn')) {
    $('openPublishModalBtn').onclick = () => {
      if (pubModal) pubModal.classList.add('show');
    };
  }
  if ($('closePublishModalBtn')) {
    $('closePublishModalBtn').onclick = () => {
      if (pubModal) pubModal.classList.remove('show');
    };
  }
  if ($('cancelPublishBtn')) {
    $('cancelPublishBtn').onclick = () => {
      if (pubModal) pubModal.classList.remove('show');
    };
  }

  // Drag & Drop и выбор файла мода
  const dropZone = $('modDropZone');
  const fileInput = $('modFileInput');
  const dropText = $('modDropText');

  function handleFileSelected(file) {
    if (!file) return;
    selectedModFile = file;

    if (dropZone) dropZone.classList.add('has-file');
    if (dropText) {
      dropText.innerHTML = `
        <b>✅ Выбран файл: ${file.name}</b>
        <small>Размер: ${formatFileSize(file.size)}</small>
      `;
    }

    // Автоматическое заполнение названия мода из имени файла
    const nameInput = $('modNameInput');
    if (nameInput && !nameInput.value.trim()) {
      const cleanName = file.name
        .replace(/\.(jar|zip|mrpack)$/i, '')
        .replace(/[-_](fabric|forge|quilt|mc|v?\d+[\d\.]*).*$/i, '')
        .replace(/[-_]+/g, ' ')
        .trim();
      nameInput.value = cleanName || file.name;
    }

    // Автоматическое заполнение размера
    const sizeInput = $('modSizeInput');
    if (sizeInput) {
      sizeInput.value = formatFileSize(file.size);
    }
  }

  if (dropZone && fileInput) {
    dropZone.onclick = () => fileInput.click();

    fileInput.onchange = () => {
      if (fileInput.files && fileInput.files[0]) {
        handleFileSelected(fileInput.files[0]);
      }
    };

    dropZone.ondragover = (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    };

    dropZone.ondragleave = () => {
      dropZone.classList.remove('dragover');
    };

    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    };
  }

  // Форма публикации мода с поддержкой FormData
  const pubForm = $('publishModForm');
  if (pubForm) {
    pubForm.onsubmit = async (e) => {
      e.preventDefault();

      const name = ($('modNameInput')?.value || '').trim();
      const version = ($('modVersionInput')?.value || '').trim();
      const size = ($('modSizeInput')?.value || '').trim();
      const category = $('modCategorySelect')?.value || 'utility';
      const description = ($('modDescriptionInput')?.value || '').trim();
      const required = $('modRequiredCheckbox')?.checked || false;

      if (!name || !description) {
        showToast('Заполните обязательные поля');
        return;
      }

      const submitBtn = $('submitPublishBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Публикация файла...';
      }

      try {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('version', version || '1.0.0');
        formData.append('size', size || (selectedModFile ? formatFileSize(selectedModFile.size) : '1,0 МБ'));
        formData.append('category', category);
        formData.append('description', description);
        formData.append('required', required);

        if (selectedModFile) {
          formData.append('modFile', selectedModFile);
        }

        const res = await fetch(`${API_BASE}/admin/mods`, {
          method: 'POST',
          headers: getAuthHeader(true), // multipart - браузер сам поставит boundary
          body: formData
        });

        const data = await res.json();
        if (res.ok) {
          showToast(`Мод «${name}» успешно опубликован в каталог!`);
          pubForm.reset();
          selectedModFile = null;
          if (dropZone) dropZone.classList.remove('has-file');
          if (dropText) {
            dropText.innerHTML = `
              <b>Выберите .jar файл мода</b> или перетащите его сюда
              <small>Файл сохранится на сервере и будет доступен для скачивания</small>
            `;
          }
          if (pubModal) pubModal.classList.remove('show');
          await loadStats();
          await loadMods();
        } else {
          showToast(data.error || 'Ошибка публикации мода');
        }
      } catch (err) {
        console.error('Ошибка публикации мода:', err);
        showToast('Ошибка связи с сервером');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Опубликовать мод';
        }
      }
    };
  }
}

/* ==========================================================================
   Управление тикетами поддержки (Только Администратор и Гл. Администратор)
   ========================================================================== */

function setupTicketControls() {
  const filterBtns = document.querySelectorAll('#ticketStatusFilters .filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTicketFilter = btn.dataset.tstatus || 'all';
      renderTickets();
    });
  });

  const modal = $('ticketModal');
  const closeBtn = $('closeTicketModalBtn');
  const cancelBtn = $('cancelTicketModalBtn');
  const inProgressBtn = $('ticketInProgressBtn');
  const closeTicketBtn = $('ticketCloseBtn');

  if (closeBtn) closeBtn.onclick = () => modal.classList.remove('show');
  if (cancelBtn) cancelBtn.onclick = () => modal.classList.remove('show');

  if (inProgressBtn) {
    inProgressBtn.onclick = async () => {
      if (!currentSelectedTicketId) return;
      const reply = $('ticketReplyInput') ? $('ticketReplyInput').value.trim() : '';
      await replyTicketAction(currentSelectedTicketId, reply, 'IN_PROGRESS');
      if (modal) modal.classList.remove('show');
    };
  }

  if (closeTicketBtn) {
    closeTicketBtn.onclick = async () => {
      if (!currentSelectedTicketId) return;
      const reply = $('ticketReplyInput') ? $('ticketReplyInput').value.trim() : '';
      await closeTicketAction(currentSelectedTicketId, reply);
      if (modal) modal.classList.remove('show');
    };
  }
}

async function loadTickets(showIndicator = true) {
  const banner = $('ticketsRestrictedBanner');
  const container = $('ticketsTableContainer');

  // Доступ только от уровня 6 (Администратор) до 7 (Гл. Администратор)
  const canManage = currentAdminLevel >= 6;

  if (!canManage) {
    if (banner) banner.style.display = 'block';
    if (container) container.style.display = 'none';
    return;
  }

  if (banner) banner.style.display = 'none';
  if (container) container.style.display = 'block';

  try {
    const res = await fetch(`${API_BASE}/tickets`, {
      headers: getAuthHeader()
    });

    if (!res.ok) {
      if (res.status === 403) {
        if (banner) banner.style.display = 'block';
        if (container) container.style.display = 'none';
      }
      return;
    }

    const data = await res.json();
    allTickets = data.tickets || [];

    if (data.stats) {
      if ($('ticketCountAll')) $('ticketCountAll').textContent = data.stats.total;
      if ($('ticketCountOpen')) $('ticketCountOpen').textContent = data.stats.open;
      if ($('ticketCountProgress')) $('ticketCountProgress').textContent = data.stats.inProgress;
      if ($('ticketCountClosed')) $('ticketCountClosed').textContent = data.stats.closed;

      const badge = $('ticketsBadge');
      if (badge) {
        if (data.stats.open > 0) {
          badge.textContent = data.stats.open;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    }

    renderTickets();
  } catch (err) {
    console.error('Ошибка загрузки тикетов:', err);
  }
}

function renderTickets() {
  const tbody = $('ticketsTableBody');
  if (!tbody) return;

  let filtered = allTickets;
  if (activeTicketFilter !== 'all') {
    filtered = allTickets.filter(t => t.status === activeTicketFilter);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:30px; color:var(--muted)">
          ${allTickets.length === 0 ? 'Нет поданных тикетов.' : 'Нет тикетов с выбранным статусом.'}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(t => {
    let badgeClass = 'badge-active';
    let statusTitle = 'Открыт';
    if (t.status === 'IN_PROGRESS') {
      badgeClass = 'badge-hwid-pending';
      statusTitle = 'В работе';
    } else if (t.status === 'CLOSED') {
      badgeClass = 'badge-hwid-ok';
      statusTitle = 'Закрыт';
    }

    const shortId = t.id.substring(t.id.lastIndexOf('_') + 1);
    const dateFormatted = formatDateString(t.createdAt);
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const formattedProofs = escapeText(t.proofs).replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--o1);text-decoration:underline;">${url}</a>`);

    let attachmentsBadge = '';
    if (t.attachments && t.attachments.length > 0) {
      attachmentsBadge = `<div style="font-size:11px;color:var(--o1);margin-top:3px;">📎 Файлов: ${t.attachments.length}</div>`;
    }

    let replyInfo = '';
    if (t.adminReply) {
      replyInfo = `<div style="font-size:11px;color:#aaa;margin-top:4px;"><b>Ответ:</b> ${escapeText(t.adminReply)}</div>`;
    }

    let deletionNotice = '';
    if (t.status === 'CLOSED' && t.closedAt) {
      deletionNotice = `<div style="font-size:11px;color:#e67e22;margin-top:2px;">(удаление через 24ч)</div>`;
    }

    return `
      <tr data-ticket-id="${t.id}">
        <td>
          <b style="color:var(--o1);">#${shortId}</b>
          <small style="display:block;color:var(--muted);">${dateFormatted}</small>
        </td>
        <td>
          <b style="color:#fff;">${escapeText(t.username)}</b>
        </td>
        <td style="max-width:240px;word-break:break-word;">
          ${escapeText(t.subject)}
          ${replyInfo}
        </td>
        <td style="max-width:200px;word-break:break-word;font-size:12px;">
          ${formattedProofs}
          ${attachmentsBadge}
        </td>
        <td>
          <span class="status-badge ${badgeClass}">${statusTitle}</span>
          ${deletionNotice}
        </td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn-sm btn-primary" onclick="openTicketModal('${t.id}')">
              Обработать
            </button>
            <button class="btn-sm btn-danger" onclick="deleteTicketDirect('${t.id}')" title="Удалить тикет">
              &times;
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function formatDateString(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return iso;
  }
}

function escapeText(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.openTicketModal = function(id) {
  const ticket = allTickets.find(t => t.id === id);
  if (!ticket) return;

  currentSelectedTicketId = id;
  const modal = $('ticketModal');
  if (!modal) return;

  if ($('modalTicketId')) $('modalTicketId').textContent = '#' + ticket.id.substring(ticket.id.lastIndexOf('_') + 1);
  if ($('modalTicketUser')) $('modalTicketUser').textContent = ticket.username;
  if ($('modalTicketDate')) $('modalTicketDate').textContent = formatDateString(ticket.createdAt);
  if ($('modalTicketSubject')) $('modalTicketSubject').textContent = ticket.subject;

  let statusBadge = `<span class="status-badge badge-active">Открыт</span>`;
  if (ticket.status === 'IN_PROGRESS') {
    statusBadge = `<span class="status-badge badge-hwid-pending">В работе</span>`;
  } else if (ticket.status === 'CLOSED') {
    statusBadge = `<span class="status-badge badge-hwid-ok">Закрыт</span>`;
  }
  if ($('modalTicketStatusBadge')) $('modalTicketStatusBadge').innerHTML = statusBadge;

  // Рендеринг истории сообщений чата
  renderModalChat(ticket);

  if ($('ticketReplyInput')) $('ticketReplyInput').value = '';

  const inputArea = $('modalChatInputArea');
  const inProgressBtn = $('ticketInProgressBtn');
  const closeBtn = $('ticketCloseBtn');

  if (ticket.status === 'CLOSED') {
    if (inputArea) inputArea.style.display = 'none';
    if (inProgressBtn) inProgressBtn.style.display = 'none';
    if (closeBtn) closeBtn.style.display = 'none';
  } else {
    if (inputArea) inputArea.style.display = 'block';
    if (inProgressBtn) inProgressBtn.style.display = 'inline-block';
    if (closeBtn) closeBtn.style.display = 'inline-block';
  }

  modal.classList.add('show');
};

function renderModalChat(ticket) {
  const chatContainer = $('modalTicketChat');
  if (!chatContainer) return;

  const messages = Array.isArray(ticket.messages) && ticket.messages.length > 0 
    ? ticket.messages 
    : [
        {
          sender: ticket.username,
          senderRole: 'player',
          text: (ticket.subject || '') + (ticket.proofs ? '\n\n' + ticket.proofs : ''),
          attachments: ticket.attachments || [],
          createdAt: ticket.createdAt
        }
      ];

  chatContainer.innerHTML = messages.map(m => {
    const isAdmin = m.senderRole === 'admin';
    const bubbleBg = isAdmin ? 'rgba(255, 140, 0, 0.12)' : 'rgba(30, 24, 18, 0.9)';
    const borderColor = isAdmin ? 'rgba(255, 140, 0, 0.4)' : 'rgba(100, 80, 60, 0.3)';
    const senderColor = isAdmin ? 'var(--o1)' : '#fff';
    const senderTitle = isAdmin ? `[Адм.] ${escapeText(m.sender)} (Администратор)` : escapeText(m.sender);

    let attHtml = '';
    if (m.attachments && m.attachments.length > 0) {
      attHtml = `
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">
          ${m.attachments.map(att => {
            const isImg = /\.(png|jpe?g|webp|gif)$/i.test(att.filename) || (att.mimetype && att.mimetype.startsWith('image/'));
            const isVid = /\.(mp4|webm|mov|mkv)$/i.test(att.filename) || (att.mimetype && att.mimetype.startsWith('video/'));
            if (isImg) {
              return `<a href="${att.url}" target="_blank" title="${escapeText(att.originalname)}"><img src="${att.url}" alt="Скриншот" style="width:60px;height:60px;border-radius:4px;object-fit:cover;border:1px solid #ff8c00;"></a>`;
            }
            if (isVid) {
              return `<div style="width:100%;margin-top:4px;"><video src="${att.url}" controls style="max-width:100%;max-height:160px;border-radius:4px;background:#000;"></video></div>`;
            }
            return `<a href="${att.url}" download="${escapeText(att.originalname)}" target="_blank" style="background:#1a140f;border:1px solid #ff8c00;padding:3px 7px;border-radius:4px;color:#fff;font-size:11px;text-decoration:none;">[Файл] ${escapeText(att.originalname)}</a>`;
          }).join('')}
        </div>
      `;
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const formattedText = escapeText(m.text || '').replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--o1);text-decoration:underline;">${url}</a>`);

    return `
      <div style="background:${bubbleBg};border:1px solid ${borderColor};border-radius:6px;padding:8px 12px;font-size:13px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size:11px;color:#aaa;">
          <b style="color:${senderColor};">${senderTitle}</b>
          <span>${formatDateString(m.createdAt)}</span>
        </div>
        <div style="color:#eee;white-space:pre-wrap;">${formattedText}</div>
        ${attHtml}
      </div>
    `;
  }).join('');

  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Отправка ответа в чат из админки
const sendMsgBtn = $('ticketSendMsgBtn');
if (sendMsgBtn) {
  sendMsgBtn.addEventListener('click', async () => {
    if (!currentSelectedTicketId) return;
    const input = $('ticketReplyInput');
    const text = (input ? input.value : '').trim();
    if (!text) {
      showToast('Введите текст ответа в чат');
      return;
    }

    sendMsgBtn.disabled = true;
    sendMsgBtn.textContent = 'Отправка...';

    try {
      const res = await fetch(`${API_BASE}/tickets/${currentSelectedTicketId}/message`, {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Ответ отправлен в чат игроку!');
        if (input) input.value = '';
        await loadTickets(false);
        const updated = allTickets.find(t => t.id === currentSelectedTicketId);
        if (updated) renderModalChat(updated);
      } else {
        showToast(data.error || 'Ошибка отправки ответа');
      }
    } catch (e) {
      showToast('Ошибка связи с сервером');
    } finally {
      sendMsgBtn.disabled = false;
      sendMsgBtn.textContent = 'Отправить в чат';
    }
  });
}

// Периодическое автообновление тикетов в админке каждые 6 секунд
setInterval(() => {
  if (document.getElementById('ticketsTab') && document.getElementById('ticketsTab').classList.contains('active')) {
    loadTickets(false);
    if (currentSelectedTicketId && $('ticketModal') && $('ticketModal').classList.contains('show')) {
      const cur = allTickets.find(t => t.id === currentSelectedTicketId);
      if (cur) renderModalChat(cur);
    }
  }
}, 6000);

async function replyTicketAction(id, reply, status) {
  try {
    const res = await fetch(`${API_BASE}/tickets/${id}/reply`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reply, status })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Тикет переведен в статус «В работе»');
      await loadTickets(false);
    } else {
      showToast(data.error || 'Ошибка обновления тикета');
    }
  } catch (e) {
    showToast('Ошибка связи с сервером');
  }
}

async function closeTicketAction(id, reply) {
  try {
    const res = await fetch(`${API_BASE}/tickets/${id}/close`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reply })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Тикет успешно закрыт. Будет удален через 24 часа.');
      await loadTickets(false);
    } else {
      showToast(data.error || 'Ошибка закрытия тикета');
    }
  } catch (e) {
    showToast('Ошибка связи с сервером');
  }
}

window.deleteTicketDirect = async function(id) {
  if (!confirm('Вы уверены, что хотите удалить этот тикет?')) return;
  try {
    const res = await fetch(`${API_BASE}/tickets/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Тикет удален.');
      await loadTickets(false);
    } else {
      showToast(data.error || 'Ошибка удаления тикета');
    }
  } catch (e) {
    showToast('Ошибка связи с сервером');
  }
};

