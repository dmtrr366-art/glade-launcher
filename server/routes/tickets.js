/**
 * Glade Launcher — Support Tickets API Routes
 * Обработка тикетов поддержки игроков.
 * Доступ к администрированию открыт строго от звания Администратор (level 6) до Гл. Администратора (level 7).
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const paths = require('../paths');

const router = express.Router();

// Настройка хранилища multer для файлов тикетов (скриншоты, видео, логи и т.д.)
const ticketStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(paths.TICKETS_DIR)) {
      fs.mkdirSync(paths.TICKETS_DIR, { recursive: true });
    }
    cb(null, paths.TICKETS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-\u0400-\u04FF]/g, '_').substring(0, 30);
    const uniqueSuffix = Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    cb(null, `ticket_${uniqueSuffix}_${cleanName}${ext}`);
  }
});

const uploadTicketFiles = multer({
  storage: ticketStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // до 100 МБ на файл (для видео и скриншотов)
    files: 10 // до 10 файлов
  }
});

/**
 * Вспомогательная функция извлечения администратора из запроса
 */
function getAdminFromRequest(req) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  let user = null;
  if (token) {
    user = db.findUserByToken(token);
  }

  if (!user && req.headers['x-user-id']) {
    user = db.findUserById(req.headers['x-user-id']);
  }

  if (!user && req.headers['x-username']) {
    user = db.findUserByUsername(req.headers['x-username']);
  }

  return user;
}

/**
 * POST /api/tickets
 * Создание тикета игроком с поддержкой загрузки файлов (скриншоты, видео, логи)
 */
router.post('/', uploadTicketFiles.array('files', 10), (req, res) => {
  try {
    const { username, subject, proofs, userId } = req.body || {};

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Пожалуйста, укажите ваше имя (ник).' });
    }
    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Пожалуйста, опишите суть проблемы или нарушения.' });
    }

    const attachments = (req.files || []).map(f => ({
      filename: f.filename,
      originalname: f.originalname,
      size: f.size,
      mimetype: f.mimetype,
      url: `/uploads/tickets/${f.filename}`
    }));

    const proofsText = (proofs || '').trim();

    if (!proofsText && attachments.length === 0) {
      return res.status(400).json({ error: 'Пожалуйста, приложите доказательства (файлы скриншотов/видео или текстовое описание/ссылки).' });
    }

    const ticket = db.createTicket({
      username: username.trim(),
      subject: subject.trim(),
      proofs: proofsText || (attachments.length > 0 ? `Прикреплено файлов: ${attachments.length}` : ''),
      attachments,
      userId: userId || null
    });

    console.log(`[Tickets API] Новый тикет #${ticket.id} от игрока ${ticket.username} (файлов: ${attachments.length}): "${ticket.subject.substring(0, 40)}..."`);

    res.json({
      success: true,
      message: 'Тикет успешно создан. Администрация рассмотрит обращение.',
      ticket
    });
  } catch (err) {
    console.error('[Tickets API Error]', err);
    res.status(500).json({ error: 'Ошибка при создании тикета.' });
  }
});

/**
 * GET /api/tickets/my
 * Получение списка обращений конкретного игрока
 */
router.get('/my', (req, res) => {
  try {
    const username = (req.query.username || '').trim();
    if (!username) {
      return res.status(400).json({ error: 'Не указан ник игрока.' });
    }

    const tickets = db.getTickets({ username });
    res.json({
      success: true,
      tickets
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения обращений.' });
  }
});

/**
 * GET /api/tickets
 * Список всех тикетов для панели администратора
 * Доступно ТОЛЬКО: Администратор (level 6) и Гл. Администратор (level 7)
 */
router.get('/', (req, res) => {
  try {
    const admin = getAdminFromRequest(req);
    if (!admin) {
      return res.status(401).json({ error: 'Требуется авторизация администратора.' });
    }

    const roleInfo = db.STAFF_ROLES[admin.role || 'user'] || db.STAFF_ROLES['user'];
    // Просмотр тикетов разрешен составу администрации (стажер и выше)
    if (roleInfo.level < 1) {
      return res.status(403).json({
        error: 'Доступ к тикетам открыт только администрации проекта.'
      });
    }

    const status = req.query.status || null;
    const tickets = db.getTickets(status ? { status } : {});

    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'OPEN').length,
      inProgress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
      closed: tickets.filter(t => t.status === 'CLOSED').length
    };

    res.json({
      success: true,
      tickets,
      stats
    });
  } catch (err) {
    console.error('[Tickets API List Error]', err);
    res.status(500).json({ error: 'Ошибка загрузки списка тикетов.' });
  }
});

/**
 * POST /api/tickets/:id/reply
 * Ответ администратора или взятие в работу
 */
router.post('/:id/reply', (req, res) => {
  try {
    const admin = getAdminFromRequest(req);
    if (!admin) {
      return res.status(401).json({ error: 'Требуется авторизация администратора.' });
    }

    const roleInfo = db.STAFF_ROLES[admin.role || 'user'] || db.STAFF_ROLES['user'];
    // Просмотр тикетов разрешен составу администрации (стажер и выше)
    if (roleInfo.level < 1) {
      return res.status(403).json({
        error: 'Доступ к тикетам открыт только администрации проекта.'
      });
    }

    const { id } = req.params;
    const { reply, status = 'IN_PROGRESS' } = req.body || {};

    const ticket = db.replyTicket(id, {
      adminUsername: admin.username,
      reply,
      status
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Тикет не найден или был удален.' });
    }

    console.log(`[Tickets API] Администратор [${roleInfo.title}] ${admin.username} ответил на тикет #${id} (Статус: ${status})`);

    res.json({
      success: true,
      message: 'Ответ на тикет успешно сохранен.',
      ticket
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сохранения ответа на тикет.' });
  }
});

/**
 * POST /api/tickets/:id/close
 * Закрытие тикета администратором с вердиктом
 * После закрытия тикет автоматически удалится через 24 часа
 */
router.post('/:id/close', (req, res) => {
  try {
    const admin = getAdminFromRequest(req);
    if (!admin) {
      return res.status(401).json({ error: 'Требуется авторизация администратора.' });
    }

    const roleInfo = db.STAFF_ROLES[admin.role || 'user'] || db.STAFF_ROLES['user'];
    if (roleInfo.level < 6) {
      return res.status(403).json({
        error: 'Закрывать тикеты разрешено только со звания Администратор до Главного Администратора.'
      });
    }

    const { id } = req.params;
    const { reply = '' } = req.body || {};

    const ticket = db.closeTicket(id, {
      adminUsername: admin.username,
      reply
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Тикет не найден или был удален.' });
    }

    console.log(`[Tickets API] Администратор [${roleInfo.title}] ${admin.username} ЗАКРЫЛ тикет #${id}. Будет удален через 24ч.`);

    res.json({
      success: true,
      message: 'Тикет закрыт. Он будет автоматически удален из системы через 24 часа.',
      ticket
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка закрытия тикета.' });
  }
});

/**
 * POST /api/tickets/:id/message
 * Отправка сообщения в диалог/чат тикета (от игрока или администратора)
 */
router.post('/:id/message', uploadTicketFiles.array('files', 5), (req, res) => {
  try {
    const ticketId = req.params.id;
    const ticket = db.getTicketById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Тикет не найден или был удален.' });
    }

    if (ticket.status === 'CLOSED') {
      return res.status(400).json({ error: 'Тикет закрыт. Отправка сообщений в завершенный тикет невозможна.' });
    }

    const { text, sender } = req.body || {};
    const admin = getAdminFromRequest(req);

    let senderRole = 'player';
    let senderName = (sender || '').trim();

    if (admin) {
      const roleInfo = db.STAFF_ROLES[admin.role || 'user'] || db.STAFF_ROLES['user'];
      if (roleInfo.level >= 6) {
        senderRole = 'admin';
        senderName = admin.username;
      }
    }

    if (!senderName) {
      senderName = ticket.username;
    }

    const attachments = (req.files || []).map(f => ({
      filename: f.filename,
      originalname: f.originalname,
      size: f.size,
      mimetype: f.mimetype,
      url: `/uploads/tickets/${f.filename}`
    }));

    const messageText = (text || '').trim();
    if (!messageText && attachments.length === 0) {
      return res.status(400).json({ error: 'Введите текст сообщения или прикрепите файл.' });
    }

    const result = db.addTicketMessage(ticketId, {
      sender: senderName,
      senderRole,
      text: messageText,
      attachments
    });

    console.log(`[Ticket Chat] Сообщение в #${ticketId} от [${senderRole}] ${senderName}`);

    res.json({
      success: true,
      ticket: result.ticket,
      message: result.message
    });
  } catch (err) {
    console.error('[Ticket Chat Error]', err);
    res.status(500).json({ error: 'Ошибка отправки сообщения в чат тикета.' });
  }
});

/**
 * DELETE /api/tickets/:id
 * Принудительное удаление тикета
 */
router.delete('/:id', (req, res) => {
  try {
    const admin = getAdminFromRequest(req);
    if (!admin) {
      return res.status(401).json({ error: 'Требуется авторизация администратора.' });
    }

    const roleInfo = db.STAFF_ROLES[admin.role || 'user'] || db.STAFF_ROLES['user'];
    if (roleInfo.level < 6) {
      return res.status(403).json({
        error: 'Удалять тикеты разрешено только со звания Администратор до Главного Администратора.'
      });
    }

    const { id } = req.params;
    const deleted = db.deleteTicket(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Тикет не найден.' });
    }

    console.log(`[Tickets API] Администратор ${admin.username} удалил тикет #${id}`);

    res.json({
      success: true,
      message: 'Тикет успешно удален.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления тикета.' });
  }
});

module.exports = router;
