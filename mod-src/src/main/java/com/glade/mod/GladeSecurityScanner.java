package com.glade.mod;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.lang.management.ManagementFactory;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import net.fabricmc.loader.api.FabricLoader;
import net.fabricmc.loader.api.ModContainer;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

public class GladeSecurityScanner {
    public static class BlacklistData {
        // Разрешенные исключения (whitelist)
        public Set<String> whitelistedMods = new HashSet<>(Arrays.asList(
            "fabricloader", "java", "minecraft", "glade-core", "hoplitex-core",
            "mixinextras", "fabric-api", "fabric-api-base",
            "flashback", "flashback-mod", "replaymod", "replay-mod", // Разрешено пользователем
            "bobby" // Разрешено пользователем
        ));

        // 1. Преимущество в игре
        // 2. Визуальные моды
        // 3. Миникарты
        // 4. Чит-клиенты и инжекты
        public List<String> blacklistedMods = new ArrayList<>(Arrays.asList(
            // Преимущество в игре
            "freecam", "free-cam", "simple-freecam", "tweakeroo",
            "autototem", "auto-totem", "totem-pop", "totempop",
            "autofish", "auto-fish", "fishing-bot",
            "itemscroller", "item-scroller",
            "mousetweaks", "mouse-tweaks",
            "jsmacros", "js-macros",
            "baritone", "baritone-api",
            "cheststealer", "chest-stealer", "autoloot", "auto-loot", "invcleaner",
            "grassbypass", "grass-bypass", "grass_bypass",
            "autocart", "auto-cart",
            "invmove", "inv-move", "inventorymove", "inventory-move",
            "autoattack", "auto-attack", "autoclicker", "auto-clicker",
            "autoaim", "auto-aim", "aimbot", "killaura", "kill-aura",
            "replantingcrops", "replanting-crops", "quickreplant", "replant",
            "autoharvest", "auto-harvest",
            "armorhotswap", "armor-hotswap", "armorswap", "armor-swap",
            "inventoryprofilesnext", "inventory-profiles-next",
            "slippery", "slipperymod", "slippery-mod",
            "quickturn", "quick-turn", "quickturnmod",
            "maceswap", "mace-swap",
            "bvcrystalhelper", "bv-crystal-helper",
            "bvmace", "bv-mace",
            "bvmacekithelper", "bv-mace-kit-helper",
            "bvwhoisthis", "bv-who-is-this",
            "bvwd", "bv-wd",
            "bvbnojumpkd", "bvb-no-jump-kd",
            "bvanchorhelper", "bv-anchor-helper",
            "bvantishield", "bv-anti-shield",
            "bvautoattack", "bv-auto-attack",
            "bvcarthelper", "bv-cart-helper",
            "inventoryessentials", "inventory-essentials",
            "clientsort", "client-sort",
            "seedcrackerx", "seedcracker", "seed-cracker",
            "accurateblockplacementreborn", "accurateblockplacement", "accurate-block-placement",
            "duchcartfix", "duch-cart-fix", "duckcartfix",
            // Моды на автоматизацию действий
            "automace", "auto-mace",
            "autoshieldbreaker", "auto-shield-breaker", "autoshield",
            "cartrefill", "cart-refill",
            "autoanchor", "auto-anchor",
            "doubleanchor", "double-anchor",
            "autotool", "auto-tool",
            "autostanslaim", "auto-stan-slaim", "autostunslam",

            // Визуальные моды
            "xray", "x-ray", "advanced-xray", "xray-fabric", "simplexray",
            "spawnerlocator", "spawner-locator",
            "chestlocator", "chest-locator",
            "chesttracker", "chest-tracker",
            "chestesp", "chest-esp",
            "goprone", "go-prone",
            "cleancut", "clean-cut",
            "perspectivemod", "perspective-mod", "perspective", "freelook", "free-look",
            "chunkanimator", "chunk-animator",
            "chunksfadein", "chunks-fade-in", "chunkfadein",
            "uiutils", "ui-utils", "ui_utils",
            "distanthorizons", "distant-horizons",
            // Запрещенные визуальные паки
            "fevervisuals", "fever-visuals",
            "luminarvisuals", "luminar-visuals",
            "warpvizuals", "warp-visuals", "warpvisuals",
            "siriusvizuals", "sirius-visuals", "siriusvisuals",
            "ascart", "as-cart",
            "kastrixvisuals", "kastrix-visuals",
            "adaptivevisuals", "adaptive-visuals",
            "vurstvisuals", "vurst-visuals",
            "onyxvisuals", "onyx-visuals",

            // Миникарты (запрещены любые)
            "journeymap", "journey-map",
            "xaerominimap", "xaero-minimap", "xaeros_minimap",
            "xaeroworldmap", "xaero-world-map", "xaeros_world_map",
            "voxelmap", "voxel-map", "mapwriter",
            "minimap", "worldmap",

            // Чит-клиенты
            "meteor-client", "meteor", "wurst", "wurst-client",
            "liquidbounce", "bleachhack", "aristois", "rusherhack", "future",
            "infiniteminds", "impact", "inertiamc", "coffee", "lambda",
            "thunderhack", "boze", "ares"
        ));

        public List<String> blacklistedClasses = new ArrayList<>(Arrays.asList(
            // Чит-модули
            "baritone.api.BaritoneAPI",
            "baritone.Baritone",
            "meteordevelopment.meteorclient.MeteorClient",
            "net.wurstclient.WurstClient",
            "net.ccbluex.liquidbounce.LiquidBounce",
            "bleach.hack.BleachHack",
            "me.deftware.client.framework.Framework",
            "com.rusherhack.client.RusherHack",
            // Миникарты
            "xaero.common.minimap.MinimapProcessor",
            "xaero.map.WorldMap",
            "journeymap.client.JourneymapClient",
            "com.mamiyaotaru.voxelmap.VoxelMap",
            // Скрипты и макросы
            "xyz.wagyourtail.jsmacros.client.JsMacros",
            // Автоматизация и утилиты
            "fi.dy.masa.itemscroller.ItemScroller",
            "yalter.mousetweaks.MouseTweaks"
        ));
    }

    private static String violation = null;

    public static String getViolation() {
        return violation;
    }

    public static boolean scan() {
        violation = null;
        BlacklistData blacklist = loadBlacklist();

        // 1. Проверка активных модов FabricLoader
        try {
            for (ModContainer mod : FabricLoader.getInstance().getAllMods()) {
                String modId = mod.getMetadata().getId().toLowerCase();
                String modName = mod.getMetadata().getName().toLowerCase();

                // Пропускаем белый список
                if (blacklist.whitelistedMods.contains(modId) || blacklist.whitelistedMods.contains(modName)) {
                    continue;
                }

                // Исключение для FlashBack / Replay
                if (modId.contains("flashback") || modId.contains("replay") || modName.contains("flashback") || modName.contains("replay")) {
                    continue;
                }
                // Исключение для Bobby
                if (modId.equals("bobby") || modName.equals("bobby")) {
                    continue;
                }

                for (String blocked : blacklist.blacklistedMods) {
                    String b = blocked.toLowerCase();
                    if (modId.equals(b) || modId.contains(b) || modName.contains(b)) {
                        violation = "Запрещенный мод: " + mod.getMetadata().getName() + " (" + modId + ")";
                        System.err.println("[Glade AntiCheat] " + violation);
                        return false;
                    }
                }
            }
        } catch (Throwable t) {
            System.err.println("[Glade AntiCheat] Error scanning mod list: " + t.getMessage());
        }

        // 2. Проверка инжектов классов в JVM
        for (String className : blacklist.blacklistedClasses) {
            try {
                Class.forName(className, false, GladeSecurityScanner.class.getClassLoader());
                violation = "Обнаружен инжект запрещенного модуля: " + className;
                System.err.println("[Glade AntiCheat] " + violation);
                return false;
            } catch (ClassNotFoundException ignored) {
            } catch (Throwable t) {
                violation = "Обнаружен запрещенный класс: " + className;
                System.err.println("[Glade AntiCheat] " + violation);
                return false;
            }
        }

        // 3. Проверка папки mods/ на диске
        try {
            File gameDir = FabricLoader.getInstance().getGameDir().toFile();
            File modsDir = new File(gameDir, "mods");
            if (modsDir.exists() && modsDir.isDirectory()) {
                File[] files = modsDir.listFiles();
                if (files != null) {
                    for (File f : files) {
                        if (!f.getName().endsWith(".jar")) continue;
                        String fname = f.getName().toLowerCase();

                        // Пропускаем белый список
                        if (fname.contains("glade-core") || fname.contains("hoplitex-core") || fname.contains("bobby") || fname.contains("flashback") || fname.contains("replay")) {
                            continue;
                        }

                        for (String blocked : blacklist.blacklistedMods) {
                            String b = blocked.toLowerCase();
                            if (fname.contains(b)) {
                                violation = "Запрещенный файл в папке mods: " + f.getName();
                                System.err.println("[Glade AntiCheat] " + violation);
                                return false;
                            }
                        }
                    }
                }
            }

            // 4. Проверка папки resourcepacks/ на запрещенные XRay и визуальные паки
            File rpDir = new File(gameDir, "resourcepacks");
            if (rpDir.exists() && rpDir.isDirectory()) {
                File[] rpFiles = rpDir.listFiles();
                if (rpFiles != null) {
                    for (File rp : rpFiles) {
                        String rpName = rp.getName().toLowerCase();
                        for (String blocked : blacklist.blacklistedMods) {
                            String b = blocked.toLowerCase();
                            if (b.contains("visual") || b.contains("xray") || b.equals("ascart")) {
                                if (rpName.contains(b)) {
                                    violation = "Запрещенный ресурспак: " + rp.getName();
                                    System.err.println("[Glade AntiCheat] " + violation);
                                    return false;
                                }
                            }
                        }
                    }
                }
            }
        } catch (Throwable t) {
            System.err.println("[Glade AntiCheat] Error scanning directories: " + t.getMessage());
        }

        // 5. Проверка аргументов JVM на внедренные Java-агенты
        try {
            List<String> jvmArgs = ManagementFactory.getRuntimeMXBean().getInputArguments();
            for (String arg : jvmArgs) {
                if (arg.startsWith("-javaagent:")) {
                    String lower = arg.toLowerCase();
                    for (String blocked : blacklist.blacklistedMods) {
                        if (lower.contains(blocked.toLowerCase())) {
                            violation = "Обнаружен запрещенный Java-агент: " + arg;
                            System.err.println("[Glade AntiCheat] " + violation);
                            return false;
                        }
                    }
                }
            }
        } catch (Throwable ignored) {}

        return true;
    }

    private static BlacklistData loadBlacklist() {
        File configFile = new File("config/glade-blacklist.json");
        if (!configFile.exists()) {
            File legacy = new File("config/hoplitex-blacklist.json");
            if (legacy.exists()) configFile = legacy;
        }
        Gson gson = new GsonBuilder().setPrettyPrinting().create();
        try {
            if (configFile.exists()) {
                try (FileReader reader = new FileReader(configFile)) {
                    BlacklistData data = gson.fromJson(reader, BlacklistData.class);
                    if (data != null) return data;
                }
            } else {
                File target = new File("config/glade-blacklist.json");
                if (target.getParentFile() != null) {
                    target.getParentFile().mkdirs();
                }
                BlacklistData data = new BlacklistData();
                try (FileWriter writer = new FileWriter(target)) {
                    gson.toJson(data, writer);
                }
                return data;
            }
        } catch (Exception e) {
            System.err.println("[Glade AntiCheat] Error loading blacklist: " + e.getMessage());
        }
        return new BlacklistData();
    }
}
