/**
 * Glade Launcher — Friends & Direct Messaging Client
 * Управление списком друзей, отправка заявок и чат в реальном времени.
 */

(function initFriends() {
  let friends = [];
  let requests = { incoming: [], outgoing: [] };
  let currentTab = 'all'; // 'all' | 'online' | 'requests'
  let activeFriend = null; // текущий выбранный друг { id, username, skinUrl, isOnline, ... }
  let activeMessages = []; // сообщения текущего диалога
  let pollInterval = null;
  let isSending = false;

  // DOM элементы
  const elListContainer = document.getElementById('friendsListContainer');
  const elTabs = document.getElementById('friendsTabs');
  const elCountAll = document.getElementById('tabCountAll');
  const elCountOnline = document.getElementById('tabCountOnline');
  const elCountRequests = document.getElementById('tabCountRequests');
  const elAddForm = document.getElementById('addFriendForm');
  const elAddInput = document.getElementById('addFriendInput');
  const elAddBtn = document.getElementById('addFriendBtn');

  // Чат элементы
  const elPlaceholder = document.getElementById('chatPlaceholder');
  const elActiveArea = document.getElementById('chatActiveArea');
  const elChatHeaderAvatar = document.getElementById('chatHeaderAvatar');
  const elChatHeaderStatusDot = document.getElementById('chatHeaderStatusDot');
  const elChatHeaderName = document.getElementById('chatHeaderName');
  const elChatHeaderStatus = document.getElementById('chatHeaderStatus');
  const elChatDeleteBtn = document.getElementById('chatDeleteFriendBtn');
  const elChatMessages = document.getElementById('chatMessages');
  const elChatForm = document.getElementById('chatForm');
  const elChatInput = document.getElementById('chatInput');
  const elChatSendBtn = document.getElementById('chatSendBtn');

  // Получение заголовков авторизации
  function getAuthHeaders() {
    try {
      const s = JSON.parse((localStorage.getItem('glade_session') || localStorage.getItem('hoplitex_session')) || '{}');
      const token = s.token || s.id || (localStorage.getItem('glade_token') || localStorage.getItem('hoplitex_token'));
      if (token) {
        return {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };
      }
    } catch (e) {}
    return { 'Content-Type': 'application/json' };
  }

  // Утилита безопасного экранирования HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Форматирование времени
  function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // Уведомление через всплывающий тост (использует say из app.js или локальный fallback)
  function notify(msg) {
    if (typeof say === 'function') {
      say(msg);
    } else {
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3500);
      }
    }
  }

  // Загрузка данных друзей и заявок
  async function loadFriendsData(silent = false) {
    try {
      const res = await fetch('/api/friends', {
        headers: getAuthHeaders()
      });

      if (res.status === 401) {
        console.warn('[Friends] Требуется авторизация');
        if (elListContainer && !silent) {
          elListContainer.innerHTML = `
            <div class="friends-empty" style="color:var(--muted);padding:30px 14px;">
              Для общения и просмотра списка друзей необходимо войти в аккаунт.<br><br>
              <a href="auth.html" style="color:var(--o1);text-decoration:underline;font-weight:600;">Войти в аккаунт</a>
            </div>
          `;
        }
        return;
      }

      if (!res.ok) throw new Error('Не удалось загрузить друзей');

      const data = await res.json();
      friends = data.friends || [];
      requests = data.requests || { incoming: [], outgoing: [] };

      updateCounts();
      renderList();

      // Если выбран друг, обновляем его статус и аватар
      if (activeFriend) {
        const updated = friends.find(f => f.id === activeFriend.id);
        if (updated) {
          activeFriend = updated;
          updateChatHeader();
        } else {
          // Друг был удален
          closeChat();
        }
      }
    } catch (err) {
      if (!silent) {
        console.error('[Friends] Ошибка загрузки:', err);
        if (elListContainer) {
          elListContainer.innerHTML = `<div class="friends-empty" style="color:#ff6666">Ошибка подключения к серверу.</div>`;
        }
      }
    }
  }

  // Обновление бейджей счётчиков во вкладках
  function updateCounts() {
    const totalCount = friends.length;
    const onlineCount = friends.filter(f => f.isOnline).length;
    const requestsCount = (requests.incoming || []).length;

    if (elCountAll) elCountAll.textContent = totalCount;
    if (elCountOnline) elCountOnline.textContent = onlineCount;
    if (elCountRequests) {
      elCountRequests.textContent = requestsCount;
      elCountRequests.style.display = requestsCount > 0 ? 'inline-block' : 'none';
    }

    // Обновляем бейдж во всей навигации приложения
    const navBadge = document.getElementById('friendsBadge');
    if (navBadge) {
      const totalNotify = requestsCount + friends.reduce((sum, f) => sum + (f.unreadCount || 0), 0);
      if (totalNotify > 0) {
        navBadge.textContent = totalNotify;
        navBadge.style.display = 'inline-block';
      } else {
        navBadge.style.display = 'none';
      }
    }
  }

  // Рендеринг списка в зависимости от текущей вкладки
  function renderList() {
    if (!elListContainer) return;

    if (currentTab === 'requests') {
      renderRequestsTab();
      return;
    }

    let list = friends;
    if (currentTab === 'online') {
      list = friends.filter(f => f.isOnline);
    }

    if (list.length === 0) {
      const emptyMsg = currentTab === 'online'
        ? 'Сейчас никого из ваших друзей нет в сети.'
        : 'У вас пока нет друзей.<br>Введите ник игрока выше, чтобы добавить!';
      elListContainer.innerHTML = `<div class="friends-empty">${emptyMsg}</div>`;
      return;
    }

    let html = '';
    list.forEach(friend => {
      const isActive = activeFriend && activeFriend.id === friend.id;
      const statusClass = friend.isOnline ? 'online' : 'offline';
      const statusText = friend.isOnline ? 'В сети' : 'Не в сети';
      const avatarSrc = friend.skinUrl || 'assets/skins/default.png';
      const unread = friend.unreadCount || 0;

      html += `
        <div class="friend-item ${isActive ? 'active' : ''}" data-friend-id="${friend.id}">
          <div class="friend-avatar-wrap">
            <img class="friend-avatar" src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(friend.username)}" onerror="this.src='assets/skins/default.png'">
            <span class="friend-status-dot ${statusClass}"></span>
          </div>
          <div class="friend-info">
            <div class="friend-name-row">
              <span class="friend-name">${escapeHtml(friend.username)}</span>
              ${friend.role === 'head_admin' ? '<span class="friend-role-badge" style="background:#8e44ad;color:#fff;">Гл. Админ</span>' : (friend.role === 'admin' ? '<span class="friend-role-badge">Admin</span>' : '')}
            </div>
            <div class="friend-sub ${friend.isOnline ? 'online' : ''}">${statusText}</div>
          </div>
          ${unread > 0 ? `<span class="friend-unread-badge">${unread}</span>` : ''}
        </div>
      `;
    });

    elListContainer.innerHTML = html;

    // Навешиваем клики на элементы друзей
    elListContainer.querySelectorAll('.friend-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-friend-id');
        openChat(id);
      });
    });
  }

  // Рендеринг вкладки заявок в друзья
  function renderRequestsTab() {
    const inc = requests.incoming || [];
    const out = requests.outgoing || [];

    if (inc.length === 0 && out.length === 0) {
      elListContainer.innerHTML = `<div class="friends-empty">Нет активных входящих или исходящих заявок.</div>`;
      return;
    }

    let html = '';

    if (inc.length > 0) {
      html += `<div style="font-size:11px;font-weight:700;color:var(--o3);text-transform:uppercase;padding:6px 8px;letter-spacing:0.08em;">Входящие заявки (${inc.length})</div>`;
      inc.forEach(req => {
        const u = req.sender || { username: 'Игрок', skinUrl: 'assets/skins/default.png' };
        html += `
          <div class="request-item">
            <div class="request-user">
              <img class="friend-avatar" style="width:34px;height:34px" src="${escapeHtml(u.skinUrl || 'assets/skins/default.png')}" onerror="this.src='assets/skins/default.png'">
              <div>
                <b>${escapeHtml(u.username)}</b>
                <small>Хочет добавить вас в друзья</small>
              </div>
            </div>
            <div class="request-actions">
              <button type="button" class="req-btn accept" data-req-id="${req.id}" title="Принять">Принять</button>
              <button type="button" class="req-btn reject" data-req-id="${req.id}" title="Отклонить">✕</button>
            </div>
          </div>
        `;
      });
    }

    if (out.length > 0) {
      html += `<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;padding:12px 8px 6px;letter-spacing:0.08em;">Исходящие (${out.length})</div>`;
      out.forEach(req => {
        const u = req.target || { username: 'Игрок', skinUrl: 'assets/skins/default.png' };
        html += `
          <div class="request-item">
            <div class="request-user">
              <img class="friend-avatar" style="width:34px;height:34px" src="${escapeHtml(u.skinUrl || 'assets/skins/default.png')}" onerror="this.src='assets/skins/default.png'">
              <div>
                <b>${escapeHtml(u.username)}</b>
                <small>Ожидание ответа игрока...</small>
              </div>
            </div>
            <div class="request-actions">
              <button type="button" class="req-btn reject" data-req-id="${req.id}" title="Отозвать заявку">Отозвать</button>
            </div>
          </div>
        `;
      });
    }

    elListContainer.innerHTML = html;

    // Обработчики принятия заявок
    elListContainer.querySelectorAll('.req-btn.accept').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const reqId = btn.getAttribute('data-req-id');
        btn.disabled = true;
        try {
          const res = await fetch('/api/friends/accept', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ requestId: reqId })
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Ошибка принятия заявки');
          notify(json.message || 'Заявка в друзья принята!');
          await loadFriendsData(true);
        } catch (err) {
          notify(err.message);
          btn.disabled = false;
        }
      });
    });

    // Обработчики отклонения/отзыва заявок
    elListContainer.querySelectorAll('.req-btn.reject').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const reqId = btn.getAttribute('data-req-id');
        btn.disabled = true;
        try {
          const res = await fetch('/api/friends/reject', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ requestId: reqId })
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Ошибка');
          notify(json.message || 'Заявка отклонена.');
          await loadFriendsData(true);
        } catch (err) {
          notify(err.message);
          btn.disabled = false;
        }
      });
    });
  }

  // Открытие чата с выбранным другом
  async function openChat(friendId) {
    const friend = friends.find(f => f.id === friendId);
    if (!friend) return;

    activeFriend = friend;
    friend.unreadCount = 0; // Сбрасываем локально

    // Переключаем интерфейс
    if (elPlaceholder) elPlaceholder.style.display = 'none';
    if (elActiveArea) {
      elActiveArea.style.display = 'flex';
    }

    updateChatHeader();
    renderList();

    // Загружаем сообщения
    await loadMessages(friend.id);

    if (elChatInput) {
      elChatInput.focus();
    }
  }

  // Закрытие чата
  function closeChat() {
    activeFriend = null;
    activeMessages = [];
    if (elPlaceholder) elPlaceholder.style.display = 'flex';
    if (elActiveArea) elActiveArea.style.display = 'none';
    renderList();
  }

  // Обновление заголовка активного чата
  function updateChatHeader() {
    if (!activeFriend) return;
    if (elChatHeaderAvatar) {
      elChatHeaderAvatar.src = activeFriend.skinUrl || 'assets/skins/default.png';
      elChatHeaderAvatar.onerror = () => { elChatHeaderAvatar.src = 'assets/skins/default.png'; };
    }
    if (elChatHeaderName) {
      elChatHeaderName.textContent = activeFriend.username;
    }
    if (elChatHeaderStatusDot) {
      elChatHeaderStatusDot.className = `friend-status-dot ${activeFriend.isOnline ? 'online' : 'offline'}`;
    }
    if (elChatHeaderStatus) {
      elChatHeaderStatus.className = `chat-header-status ${activeFriend.isOnline ? 'online' : ''}`;
      elChatHeaderStatus.textContent = activeFriend.isOnline ? 'В сети' : 'Не в сети';
    }
  }

  // Загрузка сообщений переписки
  async function loadMessages(friendId, silent = false) {
    if (!activeFriend || activeFriend.id !== friendId) return;

    try {
      const res = await fetch(`/api/friends/messages/${friendId}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Ошибка загрузки сообщений');

      const data = await res.json();
      const newMessages = data.messages || [];

      // Проверяем, изменились ли сообщения
      const isDifferent = newMessages.length !== activeMessages.length ||
        (newMessages.length > 0 && activeMessages.length > 0 &&
         newMessages[newMessages.length - 1].id !== activeMessages[activeMessages.length - 1].id);

      if (isDifferent) {
        // Проверяем, был ли пользователь внизу скролла
        const wasNearBottom = elChatMessages
          ? (elChatMessages.scrollHeight - elChatMessages.scrollTop - elChatMessages.clientHeight < 120)
          : true;

        activeMessages = newMessages;
        renderMessages();

        if (wasNearBottom) {
          scrollChatToBottom();
        }
      }
    } catch (err) {
      if (!silent) {
        console.error('[Friends] Ошибка загрузки диалога:', err);
      }
    }
  }

  // Рендеринг пузырьков сообщений
  function renderMessages() {
    if (!elChatMessages) return;

    if (activeMessages.length === 0) {
      elChatMessages.innerHTML = `
        <div style="margin:auto;text-align:center;color:var(--muted);font-size:13.5px;">
          <p>Начало диалога с <b>${escapeHtml(activeFriend ? activeFriend.username : 'игроком')}</b>.</p>
          <p style="font-size:12px;opacity:0.7">Напишите первое сообщение ниже!</p>
        </div>
      `;
      return;
    }

    let html = '';
    activeMessages.forEach(msg => {
      const isMine = msg.senderId !== (activeFriend ? activeFriend.id : null);
      const wrapClass = isMine ? 'mine' : 'theirs';
      const timeStr = formatTime(msg.createdAt);

      html += `
        <div class="msg-bubble-wrap ${wrapClass}">
          <div class="msg-bubble">${escapeHtml(msg.text)}</div>
          <span class="msg-time">${timeStr}</span>
        </div>
      `;
    });

    elChatMessages.innerHTML = html;
  }

  function scrollChatToBottom() {
    if (elChatMessages) {
      elChatMessages.scrollTop = elChatMessages.scrollHeight;
    }
  }

  // Отправка сообщения
  async function sendMessage() {
    if (!activeFriend || isSending) return;
    const text = elChatInput ? elChatInput.value.trim() : '';
    if (!text) return;

    isSending = true;
    if (elChatSendBtn) elChatSendBtn.disabled = true;

    try {
      const res = await fetch('/api/friends/messages', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          friendId: activeFriend.id,
          text: text
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Не удалось отправить сообщение');

      // Очищаем поле ввода
      if (elChatInput) elChatInput.value = '';

      // Добавляем сообщение в локальный список и отрисовываем
      if (json.sentMessage) {
        activeMessages.push(json.sentMessage);
        renderMessages();
        scrollChatToBottom();
      } else {
        await loadMessages(activeFriend.id, true);
      }
    } catch (err) {
      notify(err.message);
    } finally {
      isSending = false;
      if (elChatSendBtn) elChatSendBtn.disabled = false;
      if (elChatInput) elChatInput.focus();
    }
  }

  // Отправка заявки в друзья
  async function handleAddFriend() {
    const username = elAddInput ? elAddInput.value.trim() : '';
    if (!username) {
      notify('Введите никнейм игрока');
      if (elAddInput) elAddInput.focus();
      return;
    }

    if (elAddBtn) elAddBtn.disabled = true;

    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ username })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Не удалось отправить заявку');

      notify(json.message || `Заявка отправлена игроку ${username}!`);
      if (elAddInput) elAddInput.value = '';

      // Переключаемся на вкладку заявок, чтобы видеть статус
      currentTab = 'requests';
      updateTabsUI();
      await loadFriendsData(true);
    } catch (err) {
      notify(err.message);
    } finally {
      if (elAddBtn) elAddBtn.disabled = false;
    }
  }

  // Удаление друга
  async function handleDeleteFriend() {
    if (!activeFriend) return;
    const name = activeFriend.username;
    if (!confirm(`Вы действительно хотите удалить ${name} из списка друзей?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/friends/${activeFriend.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ошибка удаления друга');

      notify(`Игрок ${name} удален из друзей.`);
      closeChat();
      await loadFriendsData(true);
    } catch (err) {
      notify(err.message);
    }
  }

  // Переключение активного таба
  function updateTabsUI() {
    if (!elTabs) return;
    elTabs.querySelectorAll('.f-tab-btn').forEach(btn => {
      const tab = btn.getAttribute('data-tab');
      if (tab === currentTab) {
        btn.classList.add('on');
      } else {
        btn.classList.remove('on');
      }
    });
    renderList();
  }

  // Инициализация событий
  function bindEvents() {
    // Вкладки
    if (elTabs) {
      elTabs.querySelectorAll('.f-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          currentTab = btn.getAttribute('data-tab');
          updateTabsUI();
        });
      });
    }

    // Добавление друга
    if (elAddForm) {
      elAddForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleAddFriend();
      });
    }

    // Удаление друга из чата
    if (elChatDeleteBtn) {
      elChatDeleteBtn.addEventListener('click', handleDeleteFriend);
    }

    // Отправка сообщений
    if (elChatForm) {
      elChatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage();
      });
    }

    if (elChatInput) {
      elChatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }

    // Фоновое обновление каждые 2.5 секунды
    pollInterval = setInterval(async () => {
      await loadFriendsData(true);
      if (activeFriend) {
        await loadMessages(activeFriend.id, true);
      }
    }, 2500);

    window.addEventListener('beforeunload', () => {
      if (pollInterval) clearInterval(pollInterval);
    });
  }

  // Запуск при загрузке документа
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bindEvents();
      loadFriendsData();
    });
  } else {
    bindEvents();
    loadFriendsData();
  }
})();
