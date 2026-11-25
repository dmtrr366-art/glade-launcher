/**
 * Glade Launcher — Support Tickets Client Script
 * Чат тикетов между игроком и администрацией, прикрепление файлов и автообновление
 */

(function () {
  'use strict';

  function getApiBase() {
    if (window.location.protocol === 'file:' || !window.location.origin.startsWith('http')) {
      return 'http://127.0.0.1:3000/api';
    }
    return '/api';
  }
  const API_ENDPOINT = getApiBase();

  function getEl(id) {
    return document.getElementById(id);
  }

  function showToast(msg) {
    const t = getEl('toast');
    if (!t) {
      alert(msg);
      return;
    }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
  }

  function getStoredUser() {
    try {
      const raw = localStorage.getItem('glade_session') || localStorage.getItem('glade_user') || localStorage.getItem('hoplitex_session') || localStorage.getItem('hoplitex_user');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function getAuthHeaders() {
    const headers = {};
    try {
      const s = JSON.parse(localStorage.getItem('glade_session') || localStorage.getItem('hoplitex_session') || '{}');
      const token = s.token || s.id || s.username || localStorage.getItem('glade_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (s.id) headers['x-user-id'] = s.id;
      if (s.username) headers['x-username'] = s.username;
    } catch (e) {}
    return headers;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatLinks(str) {
    if (!str) return '';
    const escaped = escapeHtml(str);
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return escaped.replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--o1,#ff8c00);text-decoration:underline;">${url}</a>`);
  }

  function formatDate(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return isoStr;
    }
  }

  function formatSize(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  window.openLightbox = function(url) {
    let box = getEl('imageLightbox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'imageLightbox';
      box.className = 'image-lightbox';
      box.onclick = () => box.remove();
      document.body.appendChild(box);
    }
    box.innerHTML = `<img src="${url}" alt="Доказательство">`;
  };

  function initSupport() {
    const user = getStoredUser();
    const usernameInput = getEl('ticketUsername');
    const subjectInput = getEl('ticketSubject');
    const proofsInput = getEl('ticketProofs');
    const submitBtn = getEl('submitTicketBtn');
    const refreshBtn = getEl('refreshTicketsBtn');
    const dropzone = getEl('fileDropzone');
    const fileInput = getEl('ticketFileInput');
    const chooseBtn = getEl('chooseFileBtn');
    const previewList = getEl('filePreviewList');
    const dropzoneText = getEl('dropzoneText');
    const dropzoneSub = getEl('dropzoneSub');

    let selectedFiles = [];

    // Автозаполнение имени
    if (user && user.username) {
      if (usernameInput) usernameInput.value = user.username;
      if (getEl('uname')) getEl('uname').textContent = user.username;
    }

    // Обновление списка предпросмотра файлов
    function updateFilePreviews() {
      if (!previewList) return;

      if (selectedFiles.length === 0) {
        previewList.innerHTML = '';
        if (dropzoneText) dropzoneText.textContent = 'Нажмите для выбора файлов или перетащите сюда';
        if (dropzoneSub) dropzoneSub.textContent = 'Скриншоты (PNG, JPG), видеозаписи (MP4, WEBM), архивы (до 100 МБ)';
        if (dropzone) dropzone.style.borderColor = 'rgba(255, 140, 0, 0.4)';
        return;
      }

      if (dropzoneText) dropzoneText.textContent = `Прикреплено файлов: ${selectedFiles.length} (нажмите для добавления)`;
      if (dropzoneSub) dropzoneSub.textContent = 'Файлы готовы к отправке вместе с тикетом';
      if (dropzone) dropzone.style.borderColor = '#2ecc71';

      previewList.innerHTML = selectedFiles.map((file, idx) => {
        const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
        let thumbHtml = '';
        if (isImg) {
          try {
            const objUrl = URL.createObjectURL(file);
            thumbHtml = `<img src="${objUrl}" class="file-preview-thumb" alt="Превью" onerror="this.onerror=null;this.src='favicon-32x32.png'">`;
          } catch (e) {
            thumbHtml = `<div class="file-preview-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--o1,#ff8c00);font-size:12px;font-weight:700;">IMG</div>`;
          }
        } else {
          const isVid = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(file.name);
          thumbHtml = `<div class="file-preview-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--o1,#ff8c00);font-size:12px;font-weight:700;">${isVid ? 'VID' : 'DOC'}</div>`;
        }

        return `
          <div class="file-preview-item">
            ${thumbHtml}
            <div class="file-preview-info">
              <span class="file-preview-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
              <span class="file-preview-size">${formatSize(file.size)}</span>
            </div>
            <button type="button" class="file-remove-btn" onclick="removeSelectedFile(${idx})" title="Удалить файл">&times;</button>
          </div>
        `;
      }).join('');
    }

    window.removeSelectedFile = function(idx) {
      selectedFiles.splice(idx, 1);
      updateFilePreviews();
    };

    function addFiles(newFiles) {
      if (!newFiles || newFiles.length === 0) return;
      let addedCount = 0;
      for (let i = 0; i < newFiles.length; i++) {
        const f = newFiles[i];
        if (selectedFiles.length >= 10) {
          showToast('Максимум 10 файлов на одно обращение');
          break;
        }
        if (f.size > 100 * 1024 * 1024) {
          showToast(`Файл "${f.name}" больше 100 МБ`);
          continue;
        }
        selectedFiles.push(f);
        addedCount++;
      }
      if (addedCount > 0) {
        showToast(`Прикреплено: ${addedCount} файл(ов)`);
      }
      updateFilePreviews();
    }

    function triggerFilePicker(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (fileInput) fileInput.click();
    }

    if (dropzone) {
      dropzone.addEventListener('click', triggerFilePicker);

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const arr = [];
          for (let i = 0; i < e.dataTransfer.files.length; i++) {
            arr.push(e.dataTransfer.files[i]);
          }
          addFiles(arr);
        }
      });
    }

    if (chooseBtn) {
      chooseBtn.addEventListener('click', triggerFilePicker);
    }

    if (fileInput) {
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
          const arr = [];
          for (let i = 0; i < fileInput.files.length; i++) {
            arr.push(fileInput.files[i]);
          }
          addFiles(arr);
          setTimeout(() => { fileInput.value = ''; }, 300);
        }
      });
    }

    // Загрузка списка тикетов и диалогов
    async function loadMyTickets() {
      const curName = (usernameInput && usernameInput.value ? usernameInput.value : (user ? user.username : '')).trim();
      const listEl = getEl('myTicketList');
      if (!listEl) return;

      if (!curName) {
        listEl.innerHTML = '<div class="ticket-empty">Укажите ваше имя выше, чтобы увидеть ваши обращения.</div>';
        return;
      }

      try {
        const res = await fetch(`${API_ENDPOINT}/tickets/my?username=${encodeURIComponent(curName)}`, {
          headers: getAuthHeaders()
        });
        const data = await res.json();

        if (!data.success || !data.tickets || data.tickets.length === 0) {
          listEl.innerHTML = '<div class="ticket-empty">У вас пока нет поданных тикетов.</div>';
          return;
        }

        listEl.innerHTML = data.tickets.map(t => {
          let badgeClass = 'badge-open';
          let statusTitle = 'Открыт';
          if (t.status === 'IN_PROGRESS') {
            badgeClass = 'badge-in_progress';
            statusTitle = 'В обработке';
          } else if (t.status === 'CLOSED') {
            badgeClass = 'badge-closed';
            statusTitle = 'Закрыт';
          }

          // История сообщений чата
          const messages = Array.isArray(t.messages) && t.messages.length > 0
            ? t.messages
            : [
                {
                  sender: t.username,
                  senderRole: 'player',
                  text: (t.subject || '') + (t.proofs ? '\n\n' + t.proofs : ''),
                  attachments: t.attachments || [],
                  createdAt: t.createdAt
                }
              ];

          const chatHtml = messages.map(m => {
            const isAdmin = m.senderRole === 'admin';
            const bubbleClass = isAdmin ? 'chat-msg-admin' : 'chat-msg-player';
            const senderName = isAdmin ? `🛡️ Администрация (${escapeHtml(m.sender)})` : `👤 ${escapeHtml(m.sender)}`;

            let attHtml = '';
            if (m.attachments && m.attachments.length > 0) {
              attHtml = `
                <div class="ticket-attachments" style="margin-top:6px;">
                  ${m.attachments.map(att => {
                    const isImg = /\.(png|jpe?g|webp|gif)$/i.test(att.filename) || (att.mimetype && att.mimetype.startsWith('image/'));
                    const isVid = /\.(mp4|webm|mov|mkv)$/i.test(att.filename) || (att.mimetype && att.mimetype.startsWith('video/'));
                    if (isImg) {
                      return `<img src="${att.url}" alt="${escapeHtml(att.originalname)}" class="att-img" onclick="openLightbox('${att.url}')" title="${escapeHtml(att.originalname)} (${formatSize(att.size)})">`;
                    }
                    if (isVid) {
                      return `
                        <div style="width:100%;margin-top:4px;">
                          <video src="${att.url}" controls preload="metadata" style="max-width:100%;max-height:180px;border-radius:6px;background:#000;border:1px solid rgba(255,140,0,0.3);"></video>
                          <div style="font-size:11px;color:#888;">${escapeHtml(att.originalname)} (${formatSize(att.size)})</div>
                        </div>
                      `;
                    }
                    return `
                      <a href="${att.url}" download="${escapeHtml(att.originalname)}" target="_blank" class="att-file-pill">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        ${escapeHtml(att.originalname)} (${formatSize(att.size)})
                      </a>
                    `;
                  }).join('')}
                </div>
              `;
            }

            return `
              <div class="chat-msg ${bubbleClass}">
                <div class="chat-msg-header">
                  <span class="chat-msg-sender ${isAdmin ? 'admin' : ''}">${senderName}</span>
                  <span>${formatDate(m.createdAt)}</span>
                </div>
                <div class="chat-msg-text">${formatLinks(m.text)}</div>
                ${attHtml}
              </div>
            `;
          }).join('');

          let chatInputHtml = '';
          if (t.status !== 'CLOSED') {
            chatInputHtml = `
              <div style="display:flex;gap:6px;margin-top:10px;">
                <input type="text" id="playerChatInp_${t.id}" class="chat-input" placeholder="Напишите ответ администрации..." onkeydown="if(event.key==='Enter') sendPlayerChat('${t.id}')">
                <button type="button" class="pbtn" onclick="sendPlayerChat('${t.id}')" style="padding:7px 14px;font-size:12px;white-space:nowrap;">Отправить</button>
              </div>
            `;
          } else {
            chatInputHtml = `
              <div style="font-size:11px;color:#888;margin-top:8px;text-align:center;padding:6px;background:rgba(255,255,255,0.03);border-radius:4px;">
                Тикет закрыт ${t.closedAt ? formatDate(t.closedAt) : ''}. Диалог завершен. Будет удален через 24ч.
              </div>
            `;
          }

          return `
            <div class="ticket-card" id="card_${t.id}">
              <div class="ticket-card-header">
                <span style="font-size:12px;color:#bbb;">Тикет <b>#${escapeHtml(t.id.substring(t.id.lastIndexOf('_') + 1))}</b> • ${formatDate(t.createdAt)}</span>
                <span class="ticket-badge ${badgeClass}">${statusTitle}</span>
              </div>
              <div style="font-size:13px;color:#f0f0f0;">
                <b style="color:var(--o1,#ff8c00);">Проблема:</b> ${escapeHtml(t.subject)}
              </div>

              <!-- Диалог чата -->
              <div class="ticket-chat-dialog">
                ${chatHtml}
              </div>

              <!-- Поле ответа игрока в чат -->
              ${chatInputHtml}
            </div>
          `;
        }).join('');

      } catch (err) {
        console.error('Ошибка загрузки тикетов:', err);
        listEl.innerHTML = '<div class="ticket-empty" style="color:#e74c3c;">Не удалось загрузить тикеты. Проверьте соединение с сервером.</div>';
      }
    }

    // Отправка сообщения игроком в чат тикета
    window.sendPlayerChat = async function(ticketId) {
      const curName = (usernameInput && usernameInput.value ? usernameInput.value : (user ? user.username : '')).trim();
      const inp = getEl(`playerChatInp_${ticketId}`);
      if (!inp) return;
      const text = inp.value.trim();
      if (!text) {
        showToast('Введите сообщение для отправки');
        return;
      }

      inp.disabled = true;
      try {
        const res = await fetch(`${API_ENDPOINT}/tickets/${ticketId}/message`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text, sender: curName })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showToast('Сообщение отправлено!');
          inp.value = '';
          await loadMyTickets();
        } else {
          showToast(data.error || 'Ошибка отправки сообщения');
        }
      } catch (err) {
        showToast('Ошибка связи с сервером');
      } finally {
        inp.disabled = false;
      }
    };

    // Отправка нового тикета
    if (submitBtn) {
      submitBtn.addEventListener('click', async (e) => {
        if (e) e.preventDefault();

        let username = (usernameInput ? usernameInput.value : '').trim();
        if (!username) {
          const u = getStoredUser();
          if (u && u.username) {
            username = u.username;
            if (usernameInput) usernameInput.value = username;
          }
        }

        const subject = (subjectInput ? subjectInput.value : '').trim();
        const proofs = (proofsInput ? proofsInput.value : '').trim();

        if (!username) {
          showToast('Пожалуйста, укажите ваше имя');
          if (usernameInput) usernameInput.focus();
          return;
        }
        if (!subject) {
          showToast('Опишите суть проблемы или нарушения');
          if (subjectInput) subjectInput.focus();
          return;
        }
        if (!proofs && selectedFiles.length === 0) {
          showToast('Прикрепите файлы доказательств или напишите описание');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка...';

        try {
          const formData = new FormData();
          formData.append('username', username);
          formData.append('subject', subject);
          formData.append('proofs', proofs || (selectedFiles.length > 0 ? `Прикреплено файлов: ${selectedFiles.length}` : ''));
          if (user && user.id) formData.append('userId', user.id);
          
          for (let i = 0; i < selectedFiles.length; i++) {
            formData.append('files', selectedFiles[i]);
          }

          const res = await fetch(`${API_ENDPOINT}/tickets`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
          });

          const data = await res.json();
          if (res.ok && data.success) {
            showToast('Тикет и файлы успешно отправлены!');
            if (subjectInput) subjectInput.value = '';
            if (proofsInput) proofsInput.value = '';
            selectedFiles = [];
            updateFilePreviews();
            await loadMyTickets();
          } else {
            showToast(data.error || 'Ошибка отправки тикета');
          }
        } catch (err) {
          console.error('Ошибка отправки тикета:', err);
          showToast('Не удалось отправить тикет: ' + (err.message || 'ошибка сети'));
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Отправить тикет';
        }
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => loadMyTickets());
    }

    if (usernameInput) {
      usernameInput.addEventListener('change', () => loadMyTickets());
    }

    // Первичная загрузка тикетов
    loadMyTickets();

    // Периодическое автообновление тикетов у игрока каждые 6 секунд
    setInterval(() => {
      loadMyTickets();
    }, 6000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupport);
  } else {
    initSupport();
  }

})();
