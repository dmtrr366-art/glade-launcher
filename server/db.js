/**
 * Local Database Module (JSON-based storage)
 * Хранит данные локально в файловой системе (data/db.json).
 * Спроектирован с чистым API, чтобы в дальнейшем переключить на внешнюю СУБД (PostgreSQL/MySQL/MongoDB).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const paths = require('./paths');

const DATA_DIR = paths.DATA_DIR;
const DB_FILE = paths.DB_FILE;

// Иерархия ролей персонала Glade
const STAFF_ROLES = {
  user: { id: 'user', title: 'Игрок', level: 0, isStaff: false, color: '#a09488' },
  trainee: { id: 'trainee', title: 'Стажёр', level: 1, isStaff: true, color: '#33ccff' },
  helper: { id: 'helper', title: 'Хелпер', level: 2, isStaff: true, color: '#2ecc71' },
  senior_helper: { id: 'senior_helper', title: 'Ст. хелпер', level: 3, isStaff: true, color: '#1abc9c' },
  moderator: { id: 'moderator', title: 'Модератор', level: 4, isStaff: true, color: '#f39c12' },
  senior_moderator: { id: 'senior_moderator', title: 'Ст. модератор', level: 5, isStaff: true, color: '#e67e22' },
  admin: { id: 'admin', title: 'Администратор', level: 6, isStaff: true, color: '#e74c3c' },
  head_admin: { id: 'head_admin', title: 'Гл. администратор', level: 7, isStaff: true, color: '#9b59b6' }
};

// Базовые моды каталога по умолчанию
const defaultMods = [
  {
    id: 'glade-core',
    name: 'Glade Core',
    description: 'Системный мод для сетевого протокола, авторизации и синхронизации с сервером.',
    version: '1.0',
    size: '2,4 МБ',
    category: 'core',
    required: true,
    downloads: 1240,
    createdAt: new Date().toISOString()
  },
  {
    id: 'glade-staff',
    name: 'Glade Staff (Модерация)',
    description: 'Официальный модуль модерации и выдачи наказаний CMI. Доступен только персоналу Glade с аппаратной привязкой HWID.',
    version: '1.0',
    size: '1,8 МБ',
    category: 'staff',
    staffOnly: true,
    required: false,
    downloads: 14,
    filename: 'glade-core.jar',
    createdAt: new Date().toISOString()
  },
  {
    id: 'sodium',
    name: 'Sodium',
    description: 'Значительное повышение FPS и плавность рендеринга мира через современный OpenGL.',
    version: '0.6.2',
    size: '1,1 МБ',
    category: 'optimization',
    required: false,
    downloads: 2890,
    createdAt: new Date().toISOString()
  },
  {
    id: 'lithium',
    name: 'Lithium',
    description: 'Оптимизация внутренней физики, логики чанков и игрового ИИ без изменения механик.',
    version: '0.14.0',
    size: '0,6 МБ',
    category: 'optimization',
    required: false,
    downloads: 2150,
    createdAt: new Date().toISOString()
  },
  {
    id: 'iris-shaders',
    name: 'Iris Shaders',
    description: 'Современная и сверхбыстрая поддержка реалистичных шейдеров в Minecraft.',
    version: '1.8.1',
    size: '2,9 МБ',
    category: 'visual',
    required: false,
    downloads: 1940,
    createdAt: new Date().toISOString()
  },
  {
    id: 'xaeros-minimap',
    name: 'Xaero’s Minimap',
    description: 'Удобная настраиваемая миникарта в углу экрана с радаром и точками смерти.',
    version: '24.5.0',
    size: '1,8 МБ',
    category: 'utility',
    required: false,
    downloads: 1620,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mod-menu',
    name: 'Mod Menu',
    description: 'Полнофункциональный графический список всех установленных модов прямо в меню игры.',
    version: '11.0.1',
    size: '0,4 МБ',
    category: 'utility',
    required: false,
    downloads: 1330,
    createdAt: new Date().toISOString()
  },
  {
    id: 'replay-mod',
    name: 'Replay Mod',
    description: 'Запись матчей и создание кинематографичных видеороликов с обзором со стороны.',
    version: '2.6.14',
    size: '5,2 МБ',
    category: 'utility',
    required: false,
    downloads: 870,
    createdAt: new Date().toISOString()
  },
  {
    id: 'zoom-lite',
    name: 'Zoom Lite',
    description: 'Плавное приближение камеры по нажатию горячей клавиши (аналог OptiFine Zoom).',
    version: '1.3.0',
    size: '0,2 МБ',
    category: 'utility',
    required: false,
    downloads: 950,
    createdAt: new Date().toISOString()
  }
];

// Начальная структура базы
const defaultData = {
  users: [],
  mods: defaultMods,
  sessions: {},
  verificationCodes: {},
  friendships: [],
  messages: [],
  tickets: [],
  navigatorModes: []
};

class LocalDatabase {
  constructor() {
    this._ensureDataDir();
    this.data = this._loadData();
    this._normalizeData();
  }

  _ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  _loadData() {
    if (!fs.existsSync(DB_FILE)) {
      this._saveData(defaultData);
      return JSON.parse(JSON.stringify(defaultData));
    }
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return parsed;
    } catch (e) {
      console.error('[DB] Ошибка чтения db.json, создана чистая база:', e);
      return JSON.parse(JSON.stringify(defaultData));
    }
  }

  _normalizeData() {
    let changed = false;
    if (!Array.isArray(this.data.users)) {
      this.data.users = [];
      changed = true;
    }
    if (!Array.isArray(this.data.mods)) {
      this.data.mods = [];
      changed = true;
    }
    if (!this.data.mods.some(m => m.id === 'glade-staff')) {
      this.data.mods.push({
        id: 'glade-staff',
        name: 'Glade Staff (Модерация)',
        description: 'Официальный модуль модерации и выдачи наказаний CMI. Доступен только персоналу Glade с аппаратной привязкой HWID.',
        version: '1.0',
        size: '1,8 МБ',
        category: 'staff',
        staffOnly: true,
        required: false,
        downloads: 14,
        filename: 'glade-core.jar',
        createdAt: new Date().toISOString()
      });
      changed = true;
    }
    if (!Array.isArray(this.data.punishLogs)) {
      this.data.punishLogs = [];
      changed = true;
    }
    if (!this.data.sessions || typeof this.data.sessions !== 'object') {
      this.data.sessions = {};
      changed = true;
    }
    if (!this.data.verificationCodes || typeof this.data.verificationCodes !== 'object') {
      this.data.verificationCodes = {};
      changed = true;
    }
    if (!Array.isArray(this.data.friendships)) {
      this.data.friendships = [];
      changed = true;
    }
    if (!Array.isArray(this.data.messages)) {
      this.data.messages = [];
      changed = true;
    }
    if (!Array.isArray(this.data.tickets)) {
      this.data.tickets = [];
      changed = true;
    }
    if (!Array.isArray(this.data.navigatorModes) || this.data.navigatorModes.length === 0) {
      this.data.navigatorModes = [
        {
          id: 'mode-test-server',
          name: 'Тестовый Сервер',
          badge: 'ТЕСТ',
          badgeColor: '#2ecc71',
          description: 'Локальный ванильный сервер 1.21.1',
          serverIps: ['127.0.0.1:25565'],
          icon: 'server',
          online: 1,
          createdAt: new Date().toISOString()
        },
        {
          id: 'mode-azerus',
          name: 'Azerus',
          badge: 'ИВЕНТ',
          badgeColor: '#e74c3c',
          description: 'Событие и приключения Glade',
          serverIps: ['127.0.0.1:25565'],
          icon: 'book',
          online: 165,
          createdAt: new Date().toISOString()
        },
        {
          id: 'mode-gtm',
          name: 'GTM - ГТА',
          badge: 'ОБНОВА',
          badgeColor: '#3498db',
          description: 'ГТА в Minecraft с оружием и бандами',
          serverIps: ['127.0.0.1:25565'],
          icon: 'gun',
          online: 67,
          createdAt: new Date().toISOString()
        },
        {
          id: 'mode-stevechaos',
          name: 'Custom SteveChaos',
          badge: 'ТОП',
          badgeColor: '#e67e22',
          description: 'Сражения классов и тактик',
          serverIps: ['127.0.0.1:25565'],
          icon: 'sword',
          online: 855,
          createdAt: new Date().toISOString()
        },
        {
          id: 'mode-swordmasters',
          name: 'Мастера Мечей',
          badge: 'ХИТ',
          badgeColor: '#9b59b6',
          description: 'Прокачка клинков и арены',
          serverIps: ['127.0.0.1:25565'],
          icon: 'blade',
          online: 433,
          createdAt: new Date().toISOString()
        },
        {
          id: 'mode-arcades',
          name: 'Аркады',
          badge: 'ИГРЫ',
          badgeColor: '#1abc9c',
          description: 'Быстрые мини-игры и паркур',
          serverIps: ['127.0.0.1:25565'],
          icon: 'gamepad',
          online: 316,
          createdAt: new Date().toISOString()
        },
        {
          id: 'mode-castlefight',
          name: 'CastleFight',
          badge: 'PVP',
          badgeColor: '#c0392b',
          description: 'Осада замков и битвы армий',
          serverIps: ['127.0.0.1:25565'],
          icon: 'castle',
          online: 157,
          createdAt: new Date().toISOString()
        }
      ];
      changed = true;
    }

    // Нормализация полей пользователей
    this.data.users.forEach((u, idx) => {
      const lower = (u.username || '').toLowerCase();
      if (lower === 'lorsik' || lower === 'lors1k' || lower === 'lors1k_' || lower === 'admin') {
        if (u.role !== 'head_admin') {
          u.role = 'head_admin';
          changed = true;
        }
      } else if (!u.role) {
        if (idx === 0) {
          u.role = 'head_admin';
        } else {
          u.role = 'user';
        }
        changed = true;
      }
      if (typeof u.isBanned !== 'boolean') {
        u.isBanned = false;
        changed = true;
      }
      if (typeof u.banReason !== 'string') {
        u.banReason = '';
        changed = true;
      }
      if (u.bannedAt === undefined) {
        u.bannedAt = null;
        changed = true;
      }
      if (!u.lastSeenAt) {
        u.lastSeenAt = u.updatedAt || u.createdAt || new Date().toISOString();
        changed = true;
      }
    });

    if (changed) {
      this._saveData();
    }
  }

  _saveData(data = this.data) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('[DB] Ошибка сохранения данных на диск:', e);
    }
  }

  /* ================== Пользователи ================== */

  getUsers() {
    return this.data.users || [];
  }

  findUserById(id) {
    return this.getUsers().find(u => u.id === id) || null;
  }

  findUserByUsername(username) {
    if (!username) return null;
    const clean = username.trim().toLowerCase();
    return this.getUsers().find(u => u.username.toLowerCase() === clean) || null;
  }

  findUserByEmail(email) {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    return this.getUsers().find(u => u.email.toLowerCase() === clean) || null;
  }

  findUserByIdentifier(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    return this.getUsers().find(u => 
      u.username.toLowerCase() === clean || u.email.toLowerCase() === clean
    ) || null;
  }

  createUser({ username, email, passwordHash, role }) {
    const isFirstUser = (this.data.users || []).length === 0;
    const lower = username.trim().toLowerCase();
    const isSpecialHeadAdmin = isFirstUser || lower === 'lorsik' || lower === 'lors1k' || lower === 'lors1k_' || lower === 'admin';
    const assignedRole = role || (isSpecialHeadAdmin ? 'head_admin' : 'user');

    const newUser = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      username: username.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: passwordHash,
      role: assignedRole,
      isBanned: false,
      banReason: '',
      bannedAt: null,
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data.users.push(newUser);
    this._saveData();
    return newUser;
  }

  updateUser(id, updates) {
    const user = this.findUserById(id);
    if (!user) return null;
    Object.assign(user, updates, { updatedAt: new Date().toISOString() });
    this._saveData();
    return user;
  }

  touchUser(id) {
    const user = this.findUserById(id);
    if (!user) return null;
    user.lastSeenAt = new Date().toISOString();
    this._saveData();
    return user;
  }

  banUser(id, reason = 'Нарушение правил проекта') {
    const user = this.findUserById(id);
    if (!user) return null;
    user.isBanned = true;
    user.banReason = reason.trim() || 'Нарушение правил проекта';
    user.bannedAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();

    // Завершаем все активные сессии пользователя
    this.deleteSessionsForUser(id);

    this._saveData();
    return user;
  }

  unbanUser(id) {
    const user = this.findUserById(id);
    if (!user) return null;
    user.isBanned = false;
    user.banReason = '';
    user.bannedAt = null;
    user.updatedAt = new Date().toISOString();
    this._saveData();
    return user;
  }

  setUserRole(id, role) {
    if (!STAFF_ROLES[role]) return null;
    const user = this.findUserById(id);
    if (!user) return null;
    user.role = role;
    if (role === 'user') {
      // При снятии с должности полностью аннулируем привязку железа
      user.hwid = null;
      user.hwidPending = null;
    }
    user.updatedAt = new Date().toISOString();
    this._saveData();
    return user;
  }

  setUserHwid(id, hwid) {
    const user = this.findUserById(id);
    if (!user) return null;
    user.hwid = hwid ? hwid.trim() : null;
    user.hwidPending = null;
    user.updatedAt = new Date().toISOString();
    this._saveData();
    return user;
  }

  setPendingHwid(username, hwid) {
    const user = this.findUserByUsername(username);
    if (!user) return null;
    user.hwidPending = hwid ? hwid.trim() : null;
    this._saveData();
    return user;
  }

  addPunishLog({ adminUsername, targetUsername, action, rule, stage, duration, reason }) {
    if (!Array.isArray(this.data.punishLogs)) {
      this.data.punishLogs = [];
    }
    const log = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      adminUsername: adminUsername || 'Неизвестно',
      targetUsername: targetUsername || 'Игрок',
      action: action || 'MUTE',
      rule: rule || 'Нарушение правил',
      stage: stage || 1,
      duration: duration || '30m',
      reason: reason || '',
      createdAt: new Date().toISOString()
    };
    this.data.punishLogs.unshift(log);
    if (this.data.punishLogs.length > 500) {
      this.data.punishLogs = this.data.punishLogs.slice(0, 500);
    }
    this._saveData();
    return log;
  }

  getPunishLogs(limit = 100) {
    const list = this.data.punishLogs || [];
    return list.slice(0, limit);
  }

  /**
   * Очистка закрытых тикетов, прошло более 24 часов с момента закрытия
   */
  cleanupExpiredTickets() {
    if (!Array.isArray(this.data.tickets)) return;
    const now = Date.now();
    const MS_24_HOURS = 24 * 60 * 60 * 1000;
    const initialCount = this.data.tickets.length;

    this.data.tickets = this.data.tickets.filter(t => {
      if (t.status === 'CLOSED' && t.closedAt) {
        const closedTime = new Date(t.closedAt).getTime();
        if (now - closedTime >= MS_24_HOURS) {
          if (Array.isArray(t.attachments)) {
            t.attachments.forEach(att => {
              try {
                if (att.filename) {
                  const fp = path.join(paths.TICKETS_DIR, att.filename);
                  if (fs.existsSync(fp)) fs.unlinkSync(fp);
                }
              } catch (e) {}
            });
          }
          return false; // удаляем навсегда
        }
      }
      return true;
    });

    if (this.data.tickets.length !== initialCount) {
      this._saveData();
      console.log(`[Tickets DB] Удалено ${initialCount - this.data.tickets.length} закрытых тикетов (старше 24ч)`);
    }
  }

  _ensureTicketMessages(ticket) {
    if (!ticket) return;
    if (!Array.isArray(ticket.messages)) {
      ticket.messages = [];
      if (ticket.subject || ticket.proofs || (ticket.attachments && ticket.attachments.length > 0)) {
        ticket.messages.push({
          id: 'msg_init',
          sender: ticket.username,
          senderRole: 'player',
          text: ((ticket.subject || '') + ((ticket.proofs && ticket.proofs.trim()) ? '\n\n' + ticket.proofs.trim() : '')).trim(),
          attachments: Array.isArray(ticket.attachments) ? ticket.attachments : [],
          createdAt: ticket.createdAt
        });
      }
      if (ticket.adminReply && ticket.adminReply.trim()) {
        ticket.messages.push({
          id: 'msg_reply',
          sender: ticket.closedBy || 'Администратор',
          senderRole: 'admin',
          text: ticket.adminReply.trim(),
          attachments: [],
          createdAt: ticket.updatedAt || ticket.createdAt
        });
      }
    }
  }

  createTicket({ username, subject, proofs, attachments, userId }) {
    if (!Array.isArray(this.data.tickets)) {
      this.data.tickets = [];
    }
    const safeUser = (username || 'Игрок').trim();
    const safeSubject = (subject || '').trim();
    const safeProofs = (proofs || '').trim();
    const safeAttachments = Array.isArray(attachments) ? attachments : [];

    const ticket = {
      id: 'ticket_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      username: safeUser,
      userId: userId || null,
      subject: safeSubject,
      proofs: safeProofs,
      attachments: safeAttachments,
      messages: [
        {
          id: 'msg_' + Date.now().toString(36),
          sender: safeUser,
          senderRole: 'player',
          text: (safeSubject + (safeProofs ? '\n\n' + safeProofs : '')).trim(),
          attachments: safeAttachments,
          createdAt: new Date().toISOString()
        }
      ],
      status: 'OPEN',                  // OPEN, IN_PROGRESS, CLOSED
      adminReply: '',
      closedBy: null,
      closedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data.tickets.unshift(ticket);
    this._saveData();
    return ticket;
  }

  getTickets(filter = {}) {
    this.cleanupExpiredTickets();
    let list = this.data.tickets || [];
    list.forEach(t => this._ensureTicketMessages(t));

    if (filter.username) {
      const q = filter.username.toLowerCase().trim();
      list = list.filter(t => t.username.toLowerCase() === q);
    }
    if (filter.status) {
      list = list.filter(t => t.status === filter.status);
    }
    return list;
  }

  getTicketById(id) {
    this.cleanupExpiredTickets();
    if (!Array.isArray(this.data.tickets)) return null;
    const ticket = this.data.tickets.find(t => t.id === id) || null;
    if (ticket) this._ensureTicketMessages(ticket);
    return ticket;
  }

  addTicketMessage(id, { sender, senderRole = 'player', text, attachments = [] }) {
    const ticket = this.getTicketById(id);
    if (!ticket) return null;
    this._ensureTicketMessages(ticket);

    const msg = {
      id: 'msg_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      sender: (sender || 'Пользователь').trim(),
      senderRole: senderRole || 'player',
      text: (text || '').trim(),
      attachments: Array.isArray(attachments) ? attachments : [],
      createdAt: new Date().toISOString()
    };

    ticket.messages.push(msg);
    if (senderRole === 'admin') {
      ticket.adminReply = msg.text || ticket.adminReply;
      if (ticket.status === 'OPEN') {
        ticket.status = 'IN_PROGRESS';
      }
    }
    ticket.updatedAt = new Date().toISOString();
    this._saveData();
    return { ticket, message: msg };
  }

  replyTicket(id, { adminUsername, reply, status = 'IN_PROGRESS' }) {
    const ticket = this.getTicketById(id);
    if (!ticket) return null;
    this._ensureTicketMessages(ticket);

    if (reply && reply.trim()) {
      ticket.messages.push({
        id: 'msg_' + Date.now().toString(36),
        sender: adminUsername || 'Администратор',
        senderRole: 'admin',
        text: reply.trim(),
        attachments: [],
        createdAt: new Date().toISOString()
      });
      ticket.adminReply = reply.trim();
    }
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    this._saveData();
    return ticket;
  }

  closeTicket(id, { adminUsername, reply }) {
    const ticket = this.getTicketById(id);
    if (!ticket) return null;
    this._ensureTicketMessages(ticket);
    ticket.status = 'CLOSED';
    if (reply && reply.trim()) {
      ticket.adminReply = reply.trim();
      ticket.messages.push({
        id: 'msg_' + Date.now().toString(36),
        sender: adminUsername || 'Администратор',
        senderRole: 'admin',
        text: reply.trim(),
        attachments: [],
        createdAt: new Date().toISOString()
      });
    }
    ticket.closedBy = adminUsername || 'Администратор';
    ticket.closedAt = new Date().toISOString();
    ticket.updatedAt = new Date().toISOString();
    this._saveData();
    return ticket;
  }

  deleteTicket(id) {
    if (!Array.isArray(this.data.tickets)) return false;
    const idx = this.data.tickets.findIndex(t => t.id === id);
    if (idx === -1) return false;
    const [removed] = this.data.tickets.splice(idx, 1);
    if (removed && Array.isArray(removed.attachments)) {
      removed.attachments.forEach(att => {
        try {
          if (att.filename) {
            const fp = path.join(paths.TICKETS_DIR, att.filename);
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
          }
        } catch (e) {}
      });
    }
    this._saveData();
    return true;
  }

  getOnlineUsers(thresholdMs = 2 * 60 * 1000) {
    const now = Date.now();
    return this.getUsers().filter(u => {
      if (!u.lastSeenAt) return false;
      const seenTime = new Date(u.lastSeenAt).getTime();
      return (now - seenTime) <= thresholdMs;
    });
  }

  getStats() {
    const users = this.getUsers();
    const onlineUsers = this.getOnlineUsers();
    const bannedUsers = users.filter(u => u.isBanned);
    const mods = this.getMods();

    return {
      totalUsers: users.length,
      onlineUsers: onlineUsers.length,
      bannedUsers: bannedUsers.length,
      totalMods: mods.length
    };
  }

  /* ================== Моды каталога ================== */

  getMods() {
    return this.data.mods || [];
  }

  findModById(id) {
    return this.getMods().find(m => m.id === id) || null;
  }

  createMod({
    name,
    description,
    version,
    size,
    category = 'utility',
    required = false,
    filename = null,
    originalName = null,
    fileSize = 0,
    filePath = null
  }) {
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.floor(100 + Math.random() * 900);
    const newMod = {
      id,
      name: name.trim(),
      description: description.trim(),
      version: version ? version.trim() : '1.0.0',
      size: size ? size.trim() : '1.0 МБ',
      category: category.trim(),
      required: !!required,
      filename: filename || null,
      originalName: originalName || null,
      fileSize: fileSize || 0,
      filePath: filePath || null,
      hasFile: !!filename,
      downloads: 0,
      createdAt: new Date().toISOString()
    };
    if (!this.data.mods) this.data.mods = [];
    this.data.mods.unshift(newMod); // новый мод в начало
    this._saveData();
    return newMod;
  }

  deleteMod(id) {
    if (!this.data.mods) return false;
    const initialLen = this.data.mods.length;
    const mod = this.findModById(id);

    // Удаляем физический файл с диска, если он есть
    if (mod && mod.filename) {
      const physicalFile = path.join(paths.MODS_DIR, mod.filename);
      try {
        if (fs.existsSync(physicalFile)) {
          fs.unlinkSync(physicalFile);
          console.log(`[DB] Файл мода "${mod.filename}" успешно удалён с диска.`);
        }
      } catch (err) {
        console.error(`[DB] Ошибка удаления файла "${mod.filename}":`, err);
      }
    }

    this.data.mods = this.data.mods.filter(m => m.id !== id);
    if (this.data.mods.length !== initialLen) {
      this._saveData();
      return true;
    }
    return false;
  }

  /* ============= Коды подтверждения (Email 2FA / Reset) ============= */

  saveVerificationCode(email, code, type = 'login', expireMinutes = 10) {
    const cleanEmail = email.trim().toLowerCase();
    if (!this.data.verificationCodes) this.data.verificationCodes = {};

    this.data.verificationCodes[cleanEmail] = {
      code: code.toString().trim(),
      type: type,
      expireAt: Date.now() + expireMinutes * 60 * 1000
    };
    this._saveData();
  }

  getVerificationCode(email, type) {
    const cleanEmail = email.trim().toLowerCase();
    if (!this.data.verificationCodes) return null;
    const item = this.data.verificationCodes[cleanEmail];
    if (!item) return null;

    if (Date.now() > item.expireAt) {
      delete this.data.verificationCodes[cleanEmail];
      this._saveData();
      return null;
    }

    if (type && item.type !== type) return null;
    return item;
  }

  deleteVerificationCode(email) {
    const cleanEmail = email.trim().toLowerCase();
    if (this.data.verificationCodes && this.data.verificationCodes[cleanEmail]) {
      delete this.data.verificationCodes[cleanEmail];
      this._saveData();
    }
  }

  /* ================== Сессии авторизации ================== */

  createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    if (!this.data.sessions) this.data.sessions = {};

    this.data.sessions[token] = {
      userId,
      createdAt: new Date().toISOString()
    };
    this._saveData();
    return token;
  }

  getSession(token) {
    if (!token || !this.data.sessions) return null;
    return this.data.sessions[token] || null;
  }

  deleteSession(token) {
    if (token && this.data.sessions && this.data.sessions[token]) {
      delete this.data.sessions[token];
      this._saveData();
    }
  }

  /* ================== Друзья и Заявки ================== */

  getFriendsList(userId) {
    if (!this.data.friendships) this.data.friendships = [];
    if (!this.data.messages) this.data.messages = [];

    const accepted = this.data.friendships.filter(f => 
      (f.user1Id === userId || f.user2Id === userId) && f.status === 'accepted'
    );

    const friends = [];
    for (const f of accepted) {
      const friendId = (f.user1Id === userId) ? f.user2Id : f.user1Id;
      const u = this.findUserById(friendId);
      if (!u) continue;

      // Пользователь онлайн, если его активность была менее 60 секунд назад
      const isOnline = !!(u.lastSeenAt && (Date.now() - new Date(u.lastSeenAt).getTime() < 60000));

      // Количество непрочитанных сообщений от этого друга
      const unreadCount = this.data.messages.filter(m => 
        m.senderId === friendId && m.receiverId === userId && !m.read
      ).length;

      // Последнее сообщение в диалоге
      const conv = this.data.messages.filter(m => 
        (m.senderId === userId && m.receiverId === friendId) || 
        (m.senderId === friendId && m.receiverId === userId)
      );
      const lastMsg = conv.length > 0 ? conv[conv.length - 1] : null;

      friends.push({
        id: u.id,
        username: u.username,
        role: u.role || 'user',
        skinUrl: u.skinUrl || '/assets/skins/default.png',
        skinModel: u.skinModel || 'default',
        isOnline,
        lastSeenAt: u.lastSeenAt,
        unreadCount,
        friendshipId: f.id,
        friendsSince: f.acceptedAt || f.createdAt,
        lastMessage: lastMsg ? {
          text: lastMsg.text,
          createdAt: lastMsg.createdAt,
          isMine: lastMsg.senderId === userId
        } : null
      });
    }

    // Сортировка: сначала онлайн, затем по времени последнего сообщения, затем по нику
    friends.sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return a.username.localeCompare(b.username);
    });

    return friends;
  }

  getFriendRequests(userId) {
    if (!this.data.friendships) this.data.friendships = [];

    const incomingRaw = this.data.friendships.filter(f => f.receiverId === userId && f.status === 'pending');
    const outgoingRaw = this.data.friendships.filter(f => f.senderId === userId && f.status === 'pending');

    const incoming = incomingRaw.map(f => {
      const sender = this.findUserById(f.senderId);
      return {
        id: f.id,
        createdAt: f.createdAt,
        user: sender ? {
          id: sender.id,
          username: sender.username,
          skinUrl: sender.skinUrl || '/assets/skins/default.png',
          skinModel: sender.skinModel || 'default'
        } : null
      };
    }).filter(i => i.user !== null);

    const outgoing = outgoingRaw.map(f => {
      const receiver = this.findUserById(f.receiverId);
      return {
        id: f.id,
        createdAt: f.createdAt,
        user: receiver ? {
          id: receiver.id,
          username: receiver.username,
          skinUrl: receiver.skinUrl || '/assets/skins/default.png',
          skinModel: receiver.skinModel || 'default'
        } : null
      };
    }).filter(o => o.user !== null);

    return { incoming, outgoing };
  }

  sendFriendRequest(senderId, targetUsername) {
    if (!targetUsername || typeof targetUsername !== 'string') {
      throw new Error('Укажите ник игрока.');
    }

    const cleanNick = targetUsername.trim();
    const targetUser = this.findUserByUsername(cleanNick);
    if (!targetUser) {
      throw new Error(`Игрок с ником «${cleanNick}» не найден.`);
    }

    if (targetUser.id === senderId) {
      throw new Error('Вы не можете отправить заявку в друзья самому себе.');
    }

    if (!this.data.friendships) this.data.friendships = [];

    // Проверяем существующие связи
    const existing = this.data.friendships.find(f => 
      (f.user1Id === senderId && f.user2Id === targetUser.id) ||
      (f.user1Id === targetUser.id && f.user2Id === senderId)
    );

    if (existing) {
      if (existing.status === 'accepted') {
        throw new Error(`Вы уже являетесь друзьями с ${targetUser.username}.`);
      }
      if (existing.status === 'pending') {
        if (existing.senderId === senderId) {
          throw new Error(`Вы уже отправили заявку в друзья игроку ${targetUser.username}. Дождитесь ответа.`);
        } else {
          // Взаимная заявка — автоматически принимаем!
          existing.status = 'accepted';
          existing.acceptedAt = new Date().toISOString();
          this._saveData();
          return {
            status: 'accepted',
            message: `Игрок ${targetUser.username} также отправлял вам заявку. Теперь вы друзья!`,
            friend: targetUser
          };
        }
      }
    }

    const newRequest = {
      id: 'fr_' + crypto.randomUUID(),
      user1Id: senderId,
      user2Id: targetUser.id,
      senderId: senderId,
      receiverId: targetUser.id,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    this.data.friendships.push(newRequest);
    this._saveData();

    return {
      status: 'pending',
      message: `Заявка в друзья успешно отправлена игроку ${targetUser.username}!`,
      request: newRequest
    };
  }

  acceptFriendRequest(requestId, userId) {
    if (!this.data.friendships) return null;
    const req = this.data.friendships.find(f => f.id === requestId);
    if (!req) {
      throw new Error('Заявка в друзья не найдена.');
    }

    if (req.receiverId !== userId) {
      throw new Error('У вас нет прав для принятия этой заявки.');
    }

    if (req.status === 'accepted') {
      return { message: 'Заявка уже была принята ранее.' };
    }

    req.status = 'accepted';
    req.acceptedAt = new Date().toISOString();
    this._saveData();

    const sender = this.findUserById(req.senderId);
    return {
      message: `Заявка принята! Теперь вы и ${sender ? sender.username : 'игрок'} — друзья.`,
      friend: sender
    };
  }

  rejectFriendRequest(requestId, userId) {
    if (!this.data.friendships) return null;
    const idx = this.data.friendships.findIndex(f => 
      f.id === requestId && (f.receiverId === userId || f.senderId === userId)
    );

    if (idx === -1) {
      throw new Error('Заявка не найдена.');
    }

    this.data.friendships.splice(idx, 1);
    this._saveData();

    return { message: 'Заявка отклонена/отменена.' };
  }

  removeFriend(userId, friendId) {
    if (!this.data.friendships) return false;
    const initialLen = this.data.friendships.length;
    this.data.friendships = this.data.friendships.filter(f => 
      !((f.user1Id === userId && f.user2Id === friendId) || (f.user1Id === friendId && f.user2Id === userId))
    );

    const changed = this.data.friendships.length !== initialLen;
    if (changed) {
      this._saveData();
    }
    return changed;
  }

  isFriend(user1Id, user2Id) {
    if (!this.data.friendships) return false;
    return this.data.friendships.some(f => 
      ((f.user1Id === user1Id && f.user2Id === user2Id) || (f.user1Id === user2Id && f.user2Id === user1Id)) &&
      f.status === 'accepted'
    );
  }

  /* ================== Личные сообщения (Чат) ================== */

  sendMessage(senderId, receiverId, text) {
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error('Текст сообщения не может быть пустым.');
    }

    const cleanText = text.trim();
    if (cleanText.length > 2000) {
      throw new Error('Сообщение слишком длинное (максимум 2000 символов).');
    }

    const receiver = this.findUserById(receiverId);
    if (!receiver) {
      throw new Error('Получатель сообщения не найден.');
    }

    // Проверяем дружбу (только друзья могут переписываться)
    if (!this.isFriend(senderId, receiverId)) {
      throw new Error('Вы можете отправлять сообщения только тем, кто у вас в друзьях.');
    }

    if (!this.data.messages) this.data.messages = [];

    const msg = {
      id: 'msg_' + crypto.randomUUID(),
      senderId,
      receiverId,
      text: cleanText,
      read: false,
      createdAt: new Date().toISOString()
    };

    this.data.messages.push(msg);
    this._saveData();

    return msg;
  }

  getMessages(userId, friendId) {
    if (!this.data.messages) this.data.messages = [];

    let hasUnread = false;
    const conversation = [];

    for (const m of this.data.messages) {
      if ((m.senderId === userId && m.receiverId === friendId) ||
          (m.senderId === friendId && m.receiverId === userId)) {
        
        // Если это входящее сообщение от друга и оно не прочитано — помечаем как прочитанное!
        if (m.senderId === friendId && m.receiverId === userId && !m.read) {
          m.read = true;
          hasUnread = true;
        }

        conversation.push({
          id: m.id,
          senderId: m.senderId,
          receiverId: m.receiverId,
          text: m.text,
          createdAt: m.createdAt,
          isMine: m.senderId === userId,
          read: m.read
        });
      }
    }

    if (hasUnread) {
      this._saveData();
    }

    // Сортировка по времени создания (хронологическая)
    conversation.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return conversation;
  }

  getGlobalUnreadMessagesCount(userId) {
    if (!this.data.messages) return 0;
    return this.data.messages.filter(m => m.receiverId === userId && !m.read).length;
  }

  // --- Путеводитель по режимам (Navigator) ---

  getNavigatorModes() {
    if (!Array.isArray(this.data.navigatorModes)) {
      this.data.navigatorModes = [];
    }
    return this.data.navigatorModes;
  }

  addNavigatorMode(modeData) {
    if (!Array.isArray(this.data.navigatorModes)) {
      this.data.navigatorModes = [];
    }

    const id = 'mode-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    let serverIps = [];
    if (Array.isArray(modeData.serverIps)) {
      serverIps = modeData.serverIps.map(s => String(s).trim()).filter(Boolean);
    } else if (typeof modeData.serverIps === 'string') {
      serverIps = modeData.serverIps.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    }
    if (serverIps.length === 0) {
      serverIps = ['127.0.0.1:25565'];
    }

    const newMode = {
      id,
      name: String(modeData.name || 'Новый режим').trim(),
      badge: String(modeData.badge || 'NEW').trim().toUpperCase(),
      badgeColor: String(modeData.badgeColor || '#e67e22').trim(),
      description: String(modeData.description || '').trim(),
      serverIps,
      icon: modeData.icon || 'server',
      online: typeof modeData.online === 'number' ? modeData.online : 0,
      createdAt: new Date().toISOString()
    };

    this.data.navigatorModes.push(newMode);
    this._saveData();
    return newMode;
  }

  deleteNavigatorMode(id) {
    if (!Array.isArray(this.data.navigatorModes)) return false;
    const initialLen = this.data.navigatorModes.length;
    this.data.navigatorModes = this.data.navigatorModes.filter(m => m.id !== id);
    if (this.data.navigatorModes.length !== initialLen) {
      this._saveData();
      return true;
    }
    return false;
  }
}

const instance = new LocalDatabase();
instance.STAFF_ROLES = STAFF_ROLES;
module.exports = instance;
