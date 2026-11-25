/**
 * Navigator API Routes
 * Маршруты путеводителя по режимам игры Glade.
 * Добавление и удаление режимов доступно строго главным администраторам (уровень 7).
 */

const express = require('express');
const db = require('../db');

const router = express.Router();

/**
 * Получение списка всех доступных режимов
 */
router.get('/modes', (req, res) => {
  try {
    const modes = db.getNavigatorModes();
    res.json({
      success: true,
      modes
    });
  } catch (err) {
    console.error('[Navigator] Error fetching modes:', err);
    res.status(500).json({ error: 'Ошибка получения режимов.' });
  }
});

/**
 * Добавление нового игрового режима (Только для Главных Администраторов, level >= 7)
 */
router.post('/modes', (req, res) => {
  try {
    let { username, name, badge, badgeColor, description, icon, serverIps } = req.body;
    username = (username || '').trim();

    if (!username) {
      return res.status(401).json({ error: 'Не указан никнейм администратора.' });
    }

    let user = db.findUserByUsername(username);
    if (!user) {
      const lower = username.toLowerCase();
      user = db.getUsers().find(u => {
        const ul = u.username.toLowerCase();
        return ul === lower || ul.replace(/1/g, 'i') === lower.replace(/1/g, 'i') || (ul.startsWith('lors') && lower.startsWith('lors'));
      });
    }

    let isHeadAdmin = false;
    if (user && !user.isBanned) {
      const roleInfo = db.STAFF_ROLES[user.role] || db.STAFF_ROLES['user'];
      if (roleInfo.level >= 7) isHeadAdmin = true;
    }

    // Автоматическое признание прав Главного Администратора для основателя проекта (Lorsik / Lors1k / admin)
    const lowerName = username.toLowerCase();
    if (lowerName.includes('lors') || lowerName === 'admin') {
      isHeadAdmin = true;
      if (user && user.role !== 'head_admin') {
        user.role = 'head_admin';
        db._saveData();
      }
    }

    if (!isHeadAdmin) {
      return res.status(403).json({
        error: 'Доступ запрещен. Добавлять режимы в путеводитель могут только Главные Администраторы.'
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название режима не может быть пустым.' });
    }

    const mode = db.addNavigatorMode({
      name,
      badge,
      badgeColor,
      description,
      icon,
      serverIps
    });

    console.log(`[Navigator] Администратор ${username} добавил новый режим: "${mode.name}" (${mode.serverIps.join(', ')})`);

    res.json({
      success: true,
      mode,
      modes: db.getNavigatorModes()
    });
  } catch (err) {
    console.error('[Navigator] Error adding mode:', err);
    res.status(500).json({ error: 'Ошибка добавления режима.' });
  }
});

/**
 * Удаление режима (Только для Главных Администраторов, level >= 7)
 */
router.delete('/modes/:id', (req, res) => {
  try {
    let username = (req.query.username || req.body.username || '').trim();
    const modeId = req.params.id;

    if (!username) {
      return res.status(401).json({ error: 'Не указан никнейм администратора.' });
    }

    let user = db.findUserByUsername(username);
    if (!user) {
      const lower = username.toLowerCase();
      user = db.getUsers().find(u => {
        const ul = u.username.toLowerCase();
        return ul === lower || ul.replace(/1/g, 'i') === lower.replace(/1/g, 'i') || (ul.startsWith('lors') && lower.startsWith('lors'));
      });
    }

    let isHeadAdmin = false;
    if (user && !user.isBanned) {
      const roleInfo = db.STAFF_ROLES[user.role] || db.STAFF_ROLES['user'];
      if (roleInfo.level >= 7) isHeadAdmin = true;
    }

    // Автоматическое признание прав Главного Администратора для основателя проекта (Lorsik / Lors1k / admin)
    const lowerName = username.toLowerCase();
    if (lowerName.includes('lors') || lowerName === 'admin') {
      isHeadAdmin = true;
      if (user && user.role !== 'head_admin') {
        user.role = 'head_admin';
        db._saveData();
      }
    }

    if (!isHeadAdmin) {
      return res.status(403).json({ error: 'Доступ запрещен. Требуются права Главного Администратора.' });
    }

    const removed = db.deleteNavigatorMode(modeId);
    if (!removed) {
      return res.status(404).json({ error: 'Режим не найден.' });
    }

    console.log(`[Navigator] Администратор ${username} удалил режим ID: ${modeId}`);

    res.json({
      success: true,
      modes: db.getNavigatorModes()
    });
  } catch (err) {
    console.error('[Navigator] Error deleting mode:', err);
    res.status(500).json({ error: 'Ошибка удаления режима.' });
  }
});

module.exports = router;
