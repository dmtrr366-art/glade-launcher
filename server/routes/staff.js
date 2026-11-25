/**
 * Staff & Punishment API Routes
 * Связка игрового мода наказаний с базой данных и ролями лаунчера Glade.
 */

const express = require('express');
const db = require('../db');

const router = express.Router();

/**
 * Проверка актуальной роли персонала в реальном времени.
 * Вызывается игровым модом перед открытием меню наказаний и при выдаче.
 */
router.get('/verify', (req, res) => {
  try {
    const username = (req.query.username || '').trim();
    if (!username) {
      return res.status(400).json({ error: 'Не указан никнейм игрока.' });
    }

    const user = db.findUserByUsername(username);
    if (!user || user.isBanned) {
      return res.json({
        success: true,
        isStaff: false,
        username,
        role: 'user',
        title: 'Игрок',
        level: 0
      });
    }

    const roleId = user.role || 'user';
    const roleInfo = db.STAFF_ROLES[roleId] || db.STAFF_ROLES['user'];

    if (!roleInfo.isStaff) {
      return res.json({
        success: true,
        isStaff: false,
        username: user.username,
        role: 'user',
        title: 'Игрок',
        level: 0
      });
    }

    // Лимиты наказаний по уровням
    // level: 1 (trainee), 2 (helper), 3 (senior_helper), 4 (moderator), 5 (senior_moderator), 6 (admin), 7 (head_admin)
    const canWarn = roleInfo.level >= 1;
    const canKick = roleInfo.level >= 1;
    const canMute = roleInfo.level >= 1;
    const canTempban = roleInfo.level >= 3;
    const canBan = roleInfo.level >= 6;
    const canUnpunish = roleInfo.level >= 4; // Снятие наказаний доступно только от Модератора (level 4+)

    let maxMuteMinutes = 720; // 12 часов
    if (roleInfo.level >= 2) maxMuteMinutes = 1440; // 24 часа
    if (roleInfo.level >= 3) maxMuteMinutes = 43200; // 30 дней
    if (roleInfo.level >= 6) maxMuteMinutes = -1; // Без ограничений

    let maxBanDays = 0;
    if (roleInfo.level === 3) maxBanDays = 3;
    else if (roleInfo.level === 4) maxBanDays = 14;
    else if (roleInfo.level === 5) maxBanDays = 30;
    else if (roleInfo.level >= 6) maxBanDays = -1; // Перманент

    // Проверка аппаратного серийного номера ПК (HWID)
    const clientHwid = (req.query.hwid || req.headers['x-glade-hwid'] || '').trim();
    let hwidStatus = 'PENDING';
    let canOpen = false;

    if (user.hwid && clientHwid && user.hwid.toLowerCase() === clientHwid.toLowerCase()) {
      hwidStatus = 'APPROVED';
      canOpen = true;
    } else if (user.hwid && clientHwid && user.hwid.toLowerCase() !== clientHwid.toLowerCase()) {
      hwidStatus = 'MISMATCH';
      canOpen = false;
    } else {
      if (clientHwid) {
        db.setPendingHwid(user.username, clientHwid);
      }
      hwidStatus = 'PENDING';
      canOpen = false;
    }

    res.json({
      success: true,
      isStaff: true,
      canOpen,
      hwidStatus,
      registeredHwid: user.hwid || null,
      pendingHwid: user.hwidPending || clientHwid || null,
      username: user.username,
      role: roleInfo.id,
      title: roleInfo.title,
      level: roleInfo.level,
      color: roleInfo.color,
      permissions: {
        canWarn,
        canKick,
        canMute,
        canTempban,
        canBan,
        canUnpunish,
        maxMuteMinutes,
        maxBanDays
      }
    });
  } catch (err) {
    console.error('[Staff Verify Error]', err);
    res.status(500).json({ error: 'Ошибка проверки прав персонала.' });
  }
});

/**
 * Подтверждение / привязка HWID администратора
 */
router.post('/approve-hwid', (req, res) => {
  try {
    const { userId, hwid } = req.body;
    if (!userId || !hwid) {
      return res.status(400).json({ error: 'Не указан userId или hwid.' });
    }
    const user = db.setUserHwid(userId, hwid);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден.' });
    res.json({
      success: true,
      message: `Компьютер администратора ${user.username} успешно привязан.`,
      hwid: user.hwid
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка привязки HWID.' });
  }
});

/**
 * Сброс привязки HWID администратора
 */
router.post('/reset-hwid', (req, res) => {
  try {
    const { userId } = req.body;
    const user = db.setUserHwid(userId, null);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден.' });
    res.json({
      success: true,
      message: `Привязка устройства для ${user.username} успешно сброшена.`
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сброса HWID.' });
  }
});

/**
 * Логирование выданного наказания в базу данных лаунчера
 */
router.post('/log-punish', (req, res) => {
  try {
    const { adminUsername, targetUsername, action, rule, stage, duration, reason } = req.body;

    if (!adminUsername || !targetUsername) {
      return res.status(400).json({ error: 'Отсутствуют обязательные поля (adminUsername, targetUsername).' });
    }

    // Проверяем, что администратор действительно имеет права в базе
    const adminUser = db.findUserByUsername(adminUsername);
    if (!adminUser || adminUser.isBanned) {
      return res.status(403).json({ error: 'У вас нет прав администратора.' });
    }

    const roleInfo = db.STAFF_ROLES[adminUser.role || 'user'];
    if (!roleInfo || !roleInfo.isStaff) {
      return res.status(403).json({ error: 'Ваша роль не позволяет выдавать наказания.' });
    }

    const isUnpunish = (action || '').toUpperCase().startsWith('UN') || (action || '').includes('СНЯТИЕ') || (action || '').includes('РАЗ');
    if (isUnpunish && roleInfo.level < 4) {
      return res.status(403).json({ error: 'Снимать наказания разрешено только со звания Модератор и выше.' });
    }

    const log = db.addPunishLog({
      adminUsername: adminUser.username,
      targetUsername: targetUsername.trim(),
      action: action || 'MUTE',
      rule: rule || 'Нарушение правил',
      stage: stage || 1,
      duration: duration || '30m',
      reason: reason || ''
    });

    console.log(`[Staff Action] [${roleInfo.title}] ${adminUser.username} -> ${targetUsername}: ${action} (${duration}) за "${rule}" [ст. ${stage}]`);

    res.json({
      success: true,
      message: 'Наказание успешно зафиксировано в журнале.',
      log
    });
  } catch (err) {
    console.error('[Staff Log Punish Error]', err);
    res.status(500).json({ error: 'Ошибка фиксации наказания.' });
  }
});

/**
 * Список всех ролей персонала и их прав
 */
router.get('/roles', (req, res) => {
  res.json({
    success: true,
    roles: db.STAFF_ROLES
  });
});

module.exports = router;
