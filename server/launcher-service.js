/**
 * Glade Launcher — Game Launch Service
 * Запуск Minecraft Java Edition (1.21.1) с ядром Glade Core.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');

function getMinecraftDir() {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/minecraft');
  } else if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData/Roaming'), '.minecraft');
  } else {
    return path.join(os.homedir(), '.minecraft');
  }
}

function findJavaExecutable(mcDir) {
  // 1. Поиск встроенной Java 21 / 25 в папке runtime
  if (process.platform === 'darwin') {
    const runtimes = [
      'runtime/java-runtime-delta/osx-arm64/java-runtime-delta/jre.bundle/Contents/Home/bin/java',
      'runtime/java-runtime-epsilon/osx-arm64/java-runtime-epsilon/jre.bundle/Contents/Home/bin/java',
      'runtime/java-runtime-gamma/osx-arm64/java-runtime-gamma/jre.bundle/Contents/Home/bin/java',
      'runtime/java-runtime-delta/osx-x64/java-runtime-delta/jre.bundle/Contents/Home/bin/java'
    ];
    for (const r of runtimes) {
      const full = path.join(mcDir, r);
      if (fs.existsSync(full)) return full;
    }
  } else if (process.platform === 'win32') {
    const runtimes = [
      'runtime/java-runtime-delta/windows-x64/java-runtime-delta/bin/javaw.exe',
      'runtime/java-runtime-delta/windows-x64/java-runtime-delta/bin/java.exe',
      'runtime/java-runtime-epsilon/windows-x64/java-runtime-epsilon/bin/javaw.exe',
      'runtime/java-runtime-gamma/windows-x64/java-runtime-gamma/bin/javaw.exe'
    ];
    for (const r of runtimes) {
      const full = path.join(mcDir, r);
      if (fs.existsSync(full)) return full;
    }
  }

  // 2. Системная Java
  try {
    const cmd = process.platform === 'win32' ? 'where javaw' : 'which java';
    const out = execSync(cmd).toString().trim().split('\n')[0];
    if (out && fs.existsSync(out)) return out;
  } catch (e) {}

  return 'java';
}

/**
 * Создаёт или гарантирует наличие версии 1.21.11 в папке versions
 */
function ensureVersion12111(mcDir) {
  const versionsDir = path.join(mcDir, 'versions');
  if (!fs.existsSync(versionsDir)) return null;

  const targetDir = path.join(versionsDir, '1.21.11');
  const targetJson = path.join(targetDir, '1.21.11.json');
  const targetJar = path.join(targetDir, '1.21.11.jar');

  if (fs.existsSync(targetJson) && fs.existsSync(targetJar)) {
    return '1.21.11';
  }

  // Ищем существующую версию 1.21 в качестве основы
  const entries = fs.readdirSync(versionsDir);
  const base = entries.find(e => {
    const j = path.join(versionsDir, e, `${e}.json`);
    const jar = path.join(versionsDir, e, `${e}.jar`);
    return (e.includes('1.21.1') || e.includes('1.21.4') || e.includes('1.21')) &&
      fs.existsSync(j) && fs.existsSync(jar);
  });

  if (!base) return null;

  try {
    fs.mkdirSync(targetDir, { recursive: true });
    const json = JSON.parse(fs.readFileSync(path.join(versionsDir, base, `${base}.json`), 'utf8'));
    json.id = '1.21.11';
    fs.writeFileSync(targetJson, JSON.stringify(json, null, 2));

    const srcJar = path.join(versionsDir, base, `${base}.jar`);
    try {
      fs.linkSync(srcJar, targetJar);
    } catch (e) {
      fs.copyFileSync(srcJar, targetJar);
    }

    // Копируем папку с нативными библиотеками (LWJGL dylib / dll)
    const srcNatives = path.join(versionsDir, base, 'natives');
    const dstNatives = path.join(targetDir, 'natives');
    if (fs.existsSync(srcNatives) && !fs.existsSync(dstNatives)) {
      try {
        fs.cpSync(srcNatives, dstNatives, { recursive: true });
      } catch (e) {}
    }

    console.log(`[LauncherService] Успешно сконфигурирована версия 1.21.11 на основе ${base}`);
    return '1.21.11';
  } catch (err) {
    console.error('[LauncherService] Ошибка при создании версии 1.21.11:', err);
    return base;
  }
}

function findAvailableVersion(mcDir) {
  const versionsDir = path.join(mcDir, 'versions');
  if (!fs.existsSync(versionsDir)) return null;

  const entries = fs.readdirSync(versionsDir);
  const sorted = entries.filter(e => {
    const jsonPath = path.join(versionsDir, e, `${e}.json`);
    const jarPath = path.join(versionsDir, e, `${e}.jar`);
    return fs.existsSync(jsonPath) && fs.existsSync(jarPath);
  });

  // Отдаем приоритет Fabric клиенту для поддержки модов Glade Core
  const fabricVer = sorted.find(v => v.toLowerCase().includes('fabric 1.21.1')) ||
                    sorted.find(v => v.toLowerCase().includes('fabric 1.21')) ||
                    sorted.find(v => v.toLowerCase().includes('fabric'));
  if (fabricVer) return fabricVer;

  const ver12111 = ensureVersion12111(mcDir);
  if (ver12111) return ver12111;

  const preferred = sorted.find(v => v.includes('1.21')) || sorted[0];
  return preferred || null;
}

function launchGame(options = {}) {
  return new Promise((resolve, reject) => {
    const mcDir = getMinecraftDir();
    const engine = options.engine || 'java';
    const username = options.username || 'Lors1k_';
    const ram = parseInt(options.ram, 10) || 4;

    console.log(`[LauncherService] Запуск Minecraft Java Edition: Игрок=${username}, RAM=${ram}GB`);

    // ==========================================
    // АВТОУСТАНОВКА МОДА GLADE CORE
    // ==========================================
    const modsDir = path.join(mcDir, 'mods');
    if (!fs.existsSync(modsDir)) {
      try { fs.mkdirSync(modsDir, { recursive: true }); } catch (e) {}
    }
    // Удаляем старый hoplitex-core.jar во избежание дублирования mixin
    const oldMod = path.join(modsDir, 'hoplitex-core.jar');
    if (fs.existsSync(oldMod)) {
      try { fs.unlinkSync(oldMod); } catch (e) {}
    }
    const devMod = path.join(os.homedir(), 'Desktop/launcher/server/mods/glade-core.jar');
    const sourceMod = (fs.existsSync(devMod)) ? devMod : path.join(__dirname, 'mods', 'glade-core.jar');
    const targetMod = path.join(modsDir, 'glade-core.jar');
    if (fs.existsSync(sourceMod)) {
      try {
        fs.copyFileSync(sourceMod, targetMod);
        console.log('[LauncherService] Мод glade-core.jar успешно автоустановлен в ' + targetMod);
      } catch (err) {
        console.error('[LauncherService] Ошибка автоустановки мода:', err);
      }
    }

    // ==========================================
    // ПРОВЕРКА НА ЗАПРЕЩЕННЫЕ МОДЫ ПЕРЕД ЗАПУСКОМ
    // ==========================================
    const FORBIDDEN_MOD_PATTERNS = [
      // Преимущество в игре
      'freecam', 'autototem', 'autofish', 'itemscroller', 'mousetweaks',
      'jsmacros', 'baritone', 'cheststealer', 'grassbypass', 'grass_bypass',
      'autocart', 'invmove', 'autoattack', 'autoaim', 'replantingcrops',
      'quickreplant', 'autoharvest', 'armorhotswap', 'inventoryprofilesnext',
      'slippery', 'quickturn', 'maceswap', 'bvcrystalhelper', 'bvmace',
      'bvwhoisthis', 'bvwd', 'bvbnojumpkd', 'bvanchorhelper', 'bvantishield',
      'bvautoattack', 'bvcarthelper', 'inventoryessentials', 'clientsort',
      'seedcracker', 'accurateblockplacement', 'duchcartfix', 'duckcartfix',
      'automace', 'autoshieldbreaker', 'cartrefill', 'autoanchor',
      'doubleanchor', 'autotool', 'autostanslaim',
      // Визуальные моды
      'xray', 'x-ray', 'spawnerlocator', 'chestlocator', 'chesttracker',
      'chestesp', 'goprone', 'cleancut', 'perspectivemod', 'freelook',
      'chunkanimator', 'chunksfadein', 'uiutils', 'ui_utils', 'distanthorizons',
      'fevervisuals', 'luminarvisuals', 'warpvizuals', 'warpvisuals',
      'siriusvizuals', 'siriusvisuals', 'ascart', 'kastrixvisuals',
      'adaptivevisuals', 'vurstvisuals', 'onyxvisuals',
      // Миникарты
      'journeymap', 'xaerominimap', 'xaeroworldmap', 'xaero-minimap',
      'xaero-world-map', 'voxelmap', 'mapwriter',
      // Чит-клиенты
      'meteor', 'wurst', 'liquidbounce', 'bleachhack', 'aristois',
      'rusherhack', 'future', 'infiniteminds', 'impact', 'inertiamc',
      'coffee', 'lambda', 'thunderhack', 'boze', 'ares'
    ];

    const ALLOWED_EXCEPTIONS = ['flashback', 'replay', 'bobby', 'glade-core', 'hoplitex-core'];

    if (fs.existsSync(modsDir)) {
      try {
        const installedFiles = fs.readdirSync(modsDir);
        for (const file of installedFiles) {
          if (!file.endsWith('.jar')) continue;
          const lower = file.toLowerCase();

          // Пропускаем разрешенные исключения
          if (ALLOWED_EXCEPTIONS.some(ex => lower.includes(ex))) continue;

          for (const pattern of FORBIDDEN_MOD_PATTERNS) {
            if (lower.includes(pattern)) {
              console.error(`[LauncherService] Обнаружен запрещенный мод: ${file}`);
              return reject(new Error(`Обнаружен запрещенный мод: "${file}". Удалите его из папки mods для запуска игры.`));
            }
          }
        }
      } catch (e) {}
    }
    const configDir = path.join(mcDir, 'config');
    if (!fs.existsSync(configDir)) {
      try { fs.mkdirSync(configDir, { recursive: true }); } catch (e) {}
    }
    const cfgPath = path.join(configDir, 'glade.json');
    if (!fs.existsSync(cfgPath)) {
      try {
        fs.writeFileSync(cfgPath, JSON.stringify({
          serverAddress: 'play.hoplitex.ru:25565',
          serverName: 'Glade'
        }, null, 2));
      } catch (e) {}
    }

    // ==========================================
    // КЛАССИЧЕСКИЙ ЗАПУСК JAVA EDITION
    // ==========================================
    const verName = findAvailableVersion(mcDir);
    if (!verName) {
      return reject(new Error(`Не найдена установленная версия Minecraft в ${path.join(mcDir, 'versions')}`));
    }

    const javaPath = findJavaExecutable(mcDir);
    const verDir = path.join(mcDir, 'versions', verName);
    const verJsonPath = path.join(verDir, `${verName}.json`);
    const clientJarPath = path.join(verDir, `${verName}.jar`);
    let nativesDir = path.join(verDir, 'natives');

    // Гарантируем корректный путь к нативным библиотекам LWJGL
    if (!fs.existsSync(nativesDir) || (process.platform === 'darwin' && !fs.existsSync(path.join(nativesDir, 'liblwjgl.dylib')))) {
      const candidates = [
        path.join(mcDir, 'versions', 'Fabric 1.21.1', 'natives'),
        path.join(mcDir, 'versions', 'Fabric 1.21.4', 'natives'),
        path.join(mcDir, 'versions', 'ForgeOptiFine 1.21.1', 'natives')
      ];
      const found = candidates.find(c => fs.existsSync(c));
      if (found) nativesDir = found;
    }

    const verJson = JSON.parse(fs.readFileSync(verJsonPath, 'utf8'));

    // Собираем библиотеки для Classpath
    const libraries = [];
    const currentOs = process.platform === 'darwin' ? 'osx' : (process.platform === 'win32' ? 'windows' : 'linux');

    if (Array.isArray(verJson.libraries)) {
      verJson.libraries.forEach(lib => {
        // Проверяем правила совместимости с ОС
        if (lib.rules) {
          let allow = false;
          for (const r of lib.rules) {
            if (r.action === 'allow') {
              if (!r.os || r.os.name === currentOs) allow = true;
            } else if (r.action === 'disallow') {
              if (r.os && r.os.name === currentOs) allow = false;
            }
          }
          if (!allow) return;
        }

        if (lib.downloads && lib.downloads.artifact && lib.downloads.artifact.path) {
          const p = path.join(mcDir, 'libraries', lib.downloads.artifact.path);
          if (fs.existsSync(p)) libraries.push(p);
        } else if (lib.name) {
          const parts = lib.name.split(':');
          const groupPath = parts[0].replace(/\./g, path.sep);
          const name = parts[1];
          const version = parts[2];
          const jarPath = path.join(mcDir, 'libraries', groupPath, name, version, `${name}-${version}.jar`);
          if (fs.existsSync(jarPath)) libraries.push(jarPath);
        }
      });
    }
    libraries.push(clientJarPath);

    const classpath = libraries.join(path.delimiter);

    // Аргументы JVM
    const launcherToken = crypto.randomBytes(16).toString('hex');
    const apiUrl = `http://127.0.0.1:${process.env.PORT || 3000}`;
    const jvmArgs = [
      `-Xmx${ram}G`,
      '-Xms1G',
      `-Djava.library.path=${nativesDir}`,
      `-Djna.boot.library.path=${nativesDir}`,
      `-Dorg.lwjgl.librarypath=${nativesDir}`,
      `-Dorg.lwjgl.system.SharedLibraryExtractPath=${nativesDir}`,
      '-Dminecraft.launcher.brand=Glade',
      '-Dminecraft.launcher.version=1.0',
      `-Dglade.launcher.token=${launcherToken}`,
      `-Dglade.player.name=${username}`,
      `-Dglade.api.url=${apiUrl}`
    ];

    if (process.platform === 'darwin') {
      jvmArgs.unshift('-XstartOnFirstThread', '-Xdock:name=Glade');
    }

    jvmArgs.push('-cp', classpath);
    jvmArgs.push(verJson.mainClass || 'net.minecraft.client.main.Main');

    // Аргументы игры
    const assetsDir = path.join(mcDir, 'assets');
    const assetIndexId = (verJson.assetIndex && verJson.assetIndex.id) || verJson.assets || '29';

    const gameArgs = [
      '--username', username,
      '--version', '1.0',
      '--gameDir', mcDir,
      '--assetsDir', assetsDir,
      '--assetIndex', assetIndexId,
      '--uuid', '596e8cd208e44f3789d86c4e333b2257',
      '--accessToken', '0',
      '--userType', 'msa'
    ];

    const fullArgs = [...jvmArgs, ...gameArgs];

    console.log(`[LauncherService] Запуск процесса Java: ${javaPath}`);
    console.log(`[LauncherService] Версия: ${verName}, MainClass: ${verJson.mainClass}`);

    try {
      // Лог-файл для клиента игры
      const logsDir = path.join(mcDir, 'logs');
      if (!fs.existsSync(logsDir)) {
        try { fs.mkdirSync(logsDir, { recursive: true }); } catch (e) {}
      }
      const logOut = fs.openSync(path.join(logsDir, 'glade-game.log'), 'a');

      const child = spawn(javaPath, fullArgs, {
        cwd: mcDir,
        detached: true,
        stdio: ['ignore', logOut, logOut]
      });

      child.unref();

      resolve({
        success: true,
        engine: 'java',
        pid: child.pid,
        version: 'Version 1.0',
        message: 'Игра успешно запущена!'
      });
    } catch (err) {
      console.error('[LauncherService] Ошибка при spawn процесса:', err);
      reject(err);
    }
  });
}

module.exports = {
  getMinecraftDir,
  findJavaExecutable,
  findAvailableVersion,
  ensureVersion12111,
  launchGame
};
