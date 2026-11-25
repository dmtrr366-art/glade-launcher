/**
 * Friends & Direct Messaging API Routes
 * Система друзей, заявок и личных сообщений (чатов) игроков.
 */

const express = require('express');
const db = require('../db');
const authRoutes = require('./auth');

const router = express.Router();

// Все эндпоинты друзей требуют авторизации
router.use(authRoutes.requireAuth);

/**
 * GET /api/friends
 * Получить список друзей, входящие и исходящие заявки, а также счётчик непрочитанных
 */
router.get('/', (req, res) => {
  try {
    const userId = req.user.id;
    const friends = db.getFriendsList(userId);
    const requests = db.getFriendRequests(userId);
    const totalUnread = db.getGlobalUnreadMessagesCount(userId);

    res.json({
      friends,
      requests,
      totalUnread
    });
  } catch (err) {
    console.error('[Friends API Error]', err);
    res.status(500).json({ error: 'Ошибка при получении списка друзей.' });
  }
});

/**
 * POST /api/friends/request
 * Отправить заявку в друзья по нику игрока
 * Body: { username: string }
 */
router.post('/request', (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Укажите ник игрока.' });
    }

    const result = db.sendFriendRequest(req.user.id, username);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Ошибка отправки заявки.' });
  }
});

/**
 * POST /api/friends/accept
 * Принять входящую заявку в друзья
 * Body: { requestId: string }
 */
router.post('/accept', (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: 'Идентификатор заявки обязателен.' });
    }

    const result = db.acceptFriendRequest(requestId, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Ошибка принятия заявки.' });
  }
});

/**
 * POST /api/friends/reject
 * Отклонить или отозвать заявку в друзья
 * Body: { requestId: string }
 */
router.post('/reject', (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: 'Идентификатор заявки обязателен.' });
    }

    const result = db.rejectFriendRequest(requestId, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Ошибка отклонения заявки.' });
  }
});

/**
 * DELETE /api/friends/:friendId
 * Удалить игрока из списка друзей
 */
router.delete('/:friendId', (req, res) => {
  try {
    const friendId = req.params.friendId;
    const removed = db.removeFriend(req.user.id, friendId);
    if (!removed) {
      return res.status(404).json({ error: 'Пользователь не найден в списке друзей.' });
    }
    res.json({ message: 'Игрок удален из друзей.' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка при удалении из друзей.' });
  }
});

/**
 * GET /api/friends/messages/:friendId
 * Получить историю переписки с другом (и пометить прочитанными)
 */
router.get('/messages/:friendId', (req, res) => {
  try {
    const friendId = req.params.friendId;
    const friend = db.findUserById(friendId);
    if (!friend) {
      return res.status(404).json({ error: 'Собеседник не найден.' });
    }

    const isOnline = !!(friend.lastSeenAt && (Date.now() - new Date(friend.lastSeenAt).getTime() < 60000));
    const messages = db.getMessages(req.user.id, friendId);

    res.json({
      friend: {
        id: friend.id,
        username: friend.username,
        skinUrl: friend.skinUrl || '/assets/skins/default.png',
        skinModel: friend.skinModel || 'default',
        isOnline,
        lastSeenAt: friend.lastSeenAt
      },
      messages
    });
  } catch (err) {
    console.error('[Messages API Error]', err);
    res.status(500).json({ error: 'Ошибка при загрузке сообщений.' });
  }
});

/**
 * POST /api/friends/messages
 * Отправить личное сообщение другу
 * Body: { friendId: string, text: string }
 */
router.post('/messages', (req, res) => {
  try {
    const { friendId, text } = req.body;
    if (!friendId) {
      return res.status(400).json({ error: 'Не указан получатель сообщения.' });
    }

    const message = db.sendMessage(req.user.id, friendId, text);
    res.json({
      success: true,
      message
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Ошибка отправки сообщения.' });
  }
});

/**
 * GET /api/friends/unread-count
 * Быстрый эндпоинт для бейджа непрочитанных сообщений
 */
router.get('/unread-count', (req, res) => {
  try {
    const totalUnread = db.getGlobalUnreadMessagesCount(req.user.id);
    const requests = db.getFriendRequests(req.user.id);
    res.json({
      unreadMessages: totalUnread,
      incomingRequests: requests.incoming.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка проверки непрочитанных.' });
  }
});

module.exports = router;
