/**
 * Glade Launcher — Universal Production Builder
 * Выполняет сборку проекта в автономное приложение и дистрибутив.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const BUNDLE_DIR = path.join(DIST_DIR, 'bundle');

console.log('\n==================================================');
console.log('🔨 Сборщик приложения Glade Launcher');
console.log('==================================================\n');

// 1. Очистка и создание папки dist/bundle
function prepareDirectories() {
  console.log('📁 1. Подготовка директорий dist/...');
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  if (fs.existsSync(BUNDLE_DIR)) {
    fs.rmSync(BUNDLE_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(BUNDLE_DIR, { recursive: true });

  const uploadsDist = path.join(DIST_DIR, 'uploads', 'mods');
  if (!fs.existsSync(uploadsDist)) {
    fs.mkdirSync(uploadsDist, { recursive: true });
  }

  const ticketsDist = path.join(DIST_DIR, 'uploads', 'tickets');
  if (!fs.existsSync(ticketsDist)) {
    fs.mkdirSync(ticketsDist, { recursive: true });
  }
}

// 2. Копирование файлов
function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function copyProjectFiles() {
  console.log('📦 2. Сборка и копирование ресурсов лаунчера...');

  // HTML страницы
  const htmlFiles = [
    'index.html',
    'mods.html',
    'friends.html',
    'settings.html',
    'profile.html',
    'appearance.html',
    'auth.html',
    'admin.html',
    'support.html'
  ];
  htmlFiles.forEach(file => {
    const src = path.join(ROOT_DIR, file);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(BUNDLE_DIR, file));
  });

  // Папки
  const dirs = ['css', 'js', 'server', 'electron', 'data', 'build', 'assets', 'uploads'];
  dirs.forEach(dir => {
    copyRecursive(path.join(ROOT_DIR, dir), path.join(BUNDLE_DIR, dir));
  });

  // Иконки и манифест
  const iconFiles = [
    'favicon.svg',
    'favicon.ico',
    'favicon-32x32.png',
    'favicon-64x64.png',
    'apple-touch-icon.png',
    'app-icon.png',
    'app-icon.jpg',
    'app-icon.icns',
    'package.json'
  ];
  iconFiles.forEach(file => {
    const src = path.join(ROOT_DIR, file);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(BUNDLE_DIR, file));
  });

  // Скрипты запуска для Windows и Linux/macOS
  fs.writeFileSync(
    path.join(BUNDLE_DIR, 'start.sh'),
    '#!/usr/bin/env bash\ncd "$(dirname "$0")"\nnode server/server.js\n',
    { mode: 0o755 }
  );

  fs.writeFileSync(
    path.join(BUNDLE_DIR, 'start.bat'),
    '@echo off\r\ncd /d "%~dp0"\r\nnode server\\server.js\r\npause\r\n'
  );

  console.log('   ✅ Web/Server бандл успешно собран в dist/bundle/');
}

// 3. Запуск сборщика десктопного приложения Electron
function buildDesktopApp() {
  console.log('\n💻 3. Сборка нативного десктопного приложения (Electron)...');

  try {
    // Проверяем наличие electron-builder
    const builderBin = path.join(ROOT_DIR, 'node_modules', '.bin', 'electron-builder');
    if (!fs.existsSync(builderBin)) {
      console.log('   ⚠️ electron-builder не найден в node_modules, сборка завершена в dist/bundle/');
      return;
    }

    console.log('   🚀 Запуск компиляции нативного исполняемого пакета и DMG образа...');
    // Собираем приложение и образ диска DMG
    execSync('npx electron-builder', {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    console.log('\n   🎉 Нативное десктопное приложение и DMG успешно собраны в dist/!');
  } catch (err) {
    console.error('   ⚠️ Ошибка при создании нативного бинарного файла:', err.message);
    console.log('   (Автономный пакет готов в dist/bundle/)');
  }
}

function printSummary() {
  console.log('\n==================================================');
  console.log('✅ СБОРКА УСПЕШНО ЗАВЕРШЕНА!');
  console.log('==================================================');
  console.log('📂 Результаты сборки находятся в папке dist/:');
  console.log('   • dist/*.dmg         - Установочный DMG образ приложения для macOS');
  console.log('   • dist/mac-arm64/    - Нативное распакованное приложение .app');
  console.log('   • dist/bundle/       - Готовый автономный дистрибутив (Web + Server)');
  console.log('\n👉 Для запуска десктопной версии: npm run app');
  console.log('👉 Для запуска веб-сервера:        npm start');
  console.log('==================================================\n');
}

try {
  prepareDirectories();
  copyProjectFiles();
  buildDesktopApp();
  printSummary();
} catch (error) {
  console.error('\n❌ Ошибка во время сборки:', error);
  process.exit(1);
}
