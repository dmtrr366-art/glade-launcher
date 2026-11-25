#!/usr/bin/env python3
"""
Glade Core Mod Builder
Компилирует мод Glade Core для Fabric 1.21.1 и упаковывает в glade-core.jar
"""

import os
import subprocess
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOD_SRC = os.path.join(ROOT, 'mod-src')
BUILD_DIR = os.path.join(MOD_SRC, 'build')
CLASSES_DIR = os.path.join(BUILD_DIR, 'classes')

if os.path.exists(BUILD_DIR):
    shutil.rmtree(BUILD_DIR)
os.makedirs(CLASSES_DIR, exist_ok=True)

javac = os.path.expanduser('~/Library/Application Support/minecraft/runtime/java-runtime-delta/osx-arm64/java-runtime-delta/jre.bundle/Contents/Home/bin/javac')
jar_bin = os.path.expanduser('~/Library/Application Support/minecraft/runtime/java-runtime-delta/osx-arm64/java-runtime-delta/jre.bundle/Contents/Home/bin/jar')

inter_jar = os.path.expanduser('~/Library/Application Support/minecraft/.fabric/remappedJars/minecraft-1.21.1-0.17.2/client-intermediary.jar')
mc_libs = os.path.expanduser('~/Library/Application Support/minecraft/libraries')

all_jars = [inter_jar]
for root, dirs, files in os.walk(mc_libs):
    for f in files:
        if f.endswith('.jar'):
            all_jars.append(os.path.join(root, f))

cp = ':'.join(all_jars)

java_files = []
for root, dirs, files in os.walk(os.path.join(MOD_SRC, 'src', 'main', 'java')):
    for f in files:
        if f.endswith('.java'):
            java_files.append(os.path.join(root, f))

cmd = [javac, '-proc:none', '-cp', cp, '-d', CLASSES_DIR, *java_files]
res = subprocess.run(cmd, capture_output=True, text=True)
if res.returncode != 0:
    print('Compilation ERROR:')
    print(res.stderr)
    exit(1)

print('Compilation SUCCESSFUL!')

# Copy resources into CLASSES_DIR
res_dir = os.path.join(MOD_SRC, 'src', 'main', 'resources')
for root, dirs, files in os.walk(res_dir):
    for f in files:
        src = os.path.join(root, f)
        rel = os.path.relpath(src, res_dir)
        dst = os.path.join(CLASSES_DIR, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)

# Create JAR
out_jar = os.path.join(ROOT, 'server', 'mods', 'glade-core.jar')
os.makedirs(os.path.dirname(out_jar), exist_ok=True)

jar_cmd = [jar_bin, 'cf', out_jar, '-C', CLASSES_DIR, '.']
jar_res = subprocess.run(jar_cmd, capture_output=True, text=True)
if jar_res.returncode != 0:
    print('JAR ERROR:', jar_res.stderr)
    exit(1)

print('Mod JAR successfully created at:', out_jar)
print('File size:', os.path.getsize(out_jar), 'bytes')

def atomic_copy(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    tmp_dst = dst + '.tmp'
    shutil.copy2(src, tmp_dst)
    os.replace(tmp_dst, dst)

# Copy to destinations
mc_mods_dir = os.path.expanduser('~/Library/Application Support/minecraft/mods')
if os.path.exists(mc_mods_dir):
    # Remove old hoplitex-core.jar
    old_mc_mod = os.path.join(mc_mods_dir, 'hoplitex-core.jar')
    if os.path.exists(old_mc_mod):
        try: os.unlink(old_mc_mod)
        except Exception: pass
    
    mc_mods = os.path.join(mc_mods_dir, 'glade-core.jar')
    atomic_copy(out_jar, mc_mods)
    print('Installed to Minecraft mods:', mc_mods)

win_mods = os.path.join(ROOT + '-windows', 'server', 'mods', 'glade-core.jar')
atomic_copy(out_jar, win_mods)

dist_mods = os.path.join(ROOT, 'dist', 'bundle', 'server', 'mods', 'glade-core.jar')
atomic_copy(out_jar, dist_mods)

# Ensure hoplitex-core.jar is removed everywhere
for old_name in [
    os.path.join(ROOT, 'server', 'mods', 'hoplitex-core.jar'),
    os.path.join(ROOT, 'dist', 'bundle', 'server', 'mods', 'hoplitex-core.jar'),
    os.path.join(ROOT + '-windows', 'server', 'mods', 'hoplitex-core.jar')
]:
    if os.path.exists(old_name):
        try: os.unlink(old_name)
        except Exception: pass

# Also update /Applications/Glade Launcher.app app.asar if present
asar_path = '/Applications/Glade Launcher.app/Contents/Resources/app.asar'
if os.path.exists(asar_path):
    try:
        tmp_dir = '/tmp/glade-asar-unpack'
        if os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir)
        subprocess.run(['npx', 'asar', 'extract', asar_path, tmp_dir], check=True, stdout=subprocess.DEVNULL)
        target_in_asar = os.path.join(tmp_dir, 'server', 'mods', 'glade-core.jar')
        os.makedirs(os.path.dirname(target_in_asar), exist_ok=True)
        shutil.copy2(out_jar, target_in_asar)
        subprocess.run(['npx', 'asar', 'pack', tmp_dir, asar_path], check=True, stdout=subprocess.DEVNULL)
        shutil.rmtree(tmp_dir)
        print('Updated /Applications/Glade Launcher.app app.asar successfully!')
    except Exception as e:
        print('Notice: Could not update app.asar directly:', e)

print('All destinations updated successfully!')
