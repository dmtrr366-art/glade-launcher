/**
 * Glade Launcher — Game Launch Routes
 */

const express = require('express');
const router = express.Router();
const launcherService = require('../launcher-service');

router.post('/launch', async (req, res) => {
  try {
    const { engine = 'java', username = 'Lors1k_', ram = 4 } = req.body || {};
    const result = await launcherService.launchGame({ engine, username, ram });
    res.json(result);
  } catch (err) {
    console.error('[API /api/launcher/launch] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Не удалось запустить игру'
    });
  }
});

router.get('/status', (req, res) => {
  try {
    const mcDir = launcherService.getMinecraftDir();
    const javaPath = launcherService.findJavaExecutable(mcDir);
    const ver = launcherService.findAvailableVersion(mcDir);
    res.json({
      success: true,
      mcDir,
      javaPath,
      version: ver || 'Не найдена'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/open-folder', async (req, res) => {
  try {
    const fs = require('fs');
    const paths = require('../paths');
    const { type = 'launcher' } = req.body || {};

    let targetPath;
    if (type === 'game' || type === 'minecraft') {
      targetPath = launcherService.getMinecraftDir();
    } else {
      targetPath = paths.USER_DATA;
    }

    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    // Try Electron shell if running within electron
    try {
      const electron = require('electron');
      if (electron && electron.shell && electron.shell.openPath) {
        await electron.shell.openPath(targetPath);
        return res.json({ success: true, path: targetPath });
      }
    } catch (e) {}

    // Fallback: OS command
    const { exec } = require('child_process');
    const cmd = process.platform === 'darwin' ? `open "${targetPath}"`
              : process.platform === 'win32' ? `explorer "${targetPath}"`
              : `xdg-open "${targetPath}"`;
    exec(cmd);
    res.json({ success: true, path: targetPath });
  } catch (err) {
    console.error('[API /api/launcher/open-folder] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/paths', (req, res) => {
  try {
    const paths = require('../paths');
    res.json({
      success: true,
      gameDir: launcherService.getMinecraftDir(),
      userDataDir: paths.USER_DATA
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
