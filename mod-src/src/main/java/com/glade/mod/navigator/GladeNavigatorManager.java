package com.glade.mod.navigator;

import com.glade.mod.staff.GladeHardwareId;
import com.glade.mod.staff.GladeStaffManager;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.class_310;
import net.minecraft.class_412;
import net.minecraft.class_437;
import net.minecraft.class_639;
import net.minecraft.class_642;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

/**
 * Менеджер режимов Путеводителя Glade
 */
public class GladeNavigatorManager {
    private static List<GladeNavigatorMode> cachedModes = new ArrayList<>();
    private static long lastFetchTime = 0;
    private static final long CACHE_TTL_MS = 5000;

    public static String getApiUrl() {
        return System.getProperty("glade.api.url", "http://127.0.0.1:3000");
    }

    /**
     * Загрузка списка режимов из сервера лаунчера
     */
    public static void fetchModesAsync(Consumer<List<GladeNavigatorMode>> callback) {
        long now = System.currentTimeMillis();
        if (!cachedModes.isEmpty() && (now - lastFetchTime) < CACHE_TTL_MS) {
            callback.accept(new ArrayList<>(cachedModes));
            return;
        }

        CompletableFuture.supplyAsync(() -> {
            List<GladeNavigatorMode> modes = new ArrayList<>();
            try {
                URL url = URI.create(getApiUrl() + "/api/navigator/modes").toURL();
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(2500);
                conn.setReadTimeout(2500);

                if (conn.getResponseCode() == 200) {
                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                        JsonObject root = JsonParser.parseReader(reader).getAsJsonObject();
                        if (root.has("modes") && root.get("modes").isJsonArray()) {
                            JsonArray arr = root.getAsJsonArray("modes");
                            for (JsonElement elem : arr) {
                                JsonObject obj = elem.getAsJsonObject();
                                GladeNavigatorMode m = new GladeNavigatorMode();
                                m.id = obj.has("id") ? obj.get("id").getAsString() : "";
                                m.name = obj.has("name") ? obj.get("name").getAsString() : "Режим";
                                m.badge = obj.has("badge") ? obj.get("badge").getAsString() : "NEW";
                                m.badgeColor = obj.has("badgeColor") ? obj.get("badgeColor").getAsString() : "#e67e22";
                                m.description = obj.has("description") ? obj.get("description").getAsString() : "";
                                m.icon = obj.has("icon") ? obj.get("icon").getAsString() : "server";
                                m.online = obj.has("online") ? obj.get("online").getAsInt() : 0;

                                if (obj.has("serverIps") && obj.get("serverIps").isJsonArray()) {
                                    for (JsonElement ipElem : obj.getAsJsonArray("serverIps")) {
                                        m.serverIps.add(ipElem.getAsString());
                                    }
                                }
                                if (m.serverIps.isEmpty()) {
                                    m.serverIps.add("127.0.0.1:25565");
                                }
                                modes.add(m);
                            }
                        }
                    }
                }
            } catch (Throwable t) {
                System.err.println("[Glade Navigator] API unreachable, using default modes: " + t.getMessage());
            }

            if (modes.isEmpty()) {
                modes = getDefaultModes();
            }

            cachedModes = new ArrayList<>(modes);
            lastFetchTime = System.currentTimeMillis();
            return modes;
        }).thenAccept(modes -> {
            class_310.method_1551().execute(() -> callback.accept(modes));
        });
    }

    /**
     * Добавление нового режима через API (только Главный Администратор)
     */
    public static CompletableFuture<Boolean> addModeAsync(String name, String badge, String badgeColor, String description, String icon, List<String> serverIps) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String username = GladeStaffManager.getPlayerUsername();
                String hwid = GladeHardwareId.getHardwareSerial();

                JsonObject reqObj = new JsonObject();
                reqObj.addProperty("username", username);
                reqObj.addProperty("name", name);
                reqObj.addProperty("badge", badge);
                reqObj.addProperty("badgeColor", badgeColor);
                reqObj.addProperty("description", description);
                reqObj.addProperty("icon", icon);

                JsonArray ipArr = new JsonArray();
                for (String ip : serverIps) {
                    ipArr.add(ip.trim());
                }
                reqObj.add("serverIps", ipArr);

                byte[] postData = reqObj.toString().getBytes(StandardCharsets.UTF_8);

                URL url = URI.create(getApiUrl() + "/api/navigator/modes").toURL();
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                conn.setRequestProperty("x-glade-hwid", hwid);
                conn.setDoOutput(true);
                conn.setConnectTimeout(3000);
                conn.setReadTimeout(3000);

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(postData);
                }

                if (conn.getResponseCode() == 200) {
                    cachedModes.clear(); // Сброс кэша
                    return true;
                }
            } catch (Throwable t) {
                System.err.println("[Glade Navigator] Error adding mode: " + t.getMessage());
            }
            return false;
        });
    }

    /**
     * Удаление режима через API (только Главный Администратор)
     */
    public static CompletableFuture<Boolean> deleteModeAsync(String modeId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String username = GladeStaffManager.getPlayerUsername();
                String hwid = GladeHardwareId.getHardwareSerial();

                String encodedUser = java.net.URLEncoder.encode(username, StandardCharsets.UTF_8);
                URL url = URI.create(getApiUrl() + "/api/navigator/modes/" + modeId + "?username=" + encodedUser).toURL();
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("DELETE");
                conn.setRequestProperty("x-glade-hwid", hwid);
                conn.setConnectTimeout(3000);
                conn.setReadTimeout(3000);

                int respCode = conn.getResponseCode();
                if (respCode == 200) {
                    cachedModes.removeIf(m -> m.id != null && m.id.equals(modeId));
                    lastFetchTime = 0; // Сброс кэша
                    return true;
                }
            } catch (Throwable t) {
                System.err.println("[Glade Navigator] Error deleting mode: " + t.getMessage());
            }
            cachedModes.removeIf(m -> m.id != null && m.id.equals(modeId));
            return true;
        });
    }

    /**
     * Подключение к выбранному режиму с автоматической балансировкой нагрузки
     */
    public static void connectToMode(class_437 parentScreen, class_310 client, GladeNavigatorMode mode) {
        if (client == null) return;

        System.out.println("[Glade Navigator] Подключение к режиму: " + mode.name + " (" + mode.serverIps.size() + " серверов)...");

        // Балансировка: асинхронно выбираем наименее загруженный сервер
        GladeServerPinger.pickBestServerAsync(mode.serverIps).thenAccept(bestIp -> {
            client.execute(() -> {
                try {
                    System.out.println("[Glade Navigator] Подключение к адресу: " + bestIp);

                    // Если игрок уже на каком-то сервере или в одиночной игре, выходим в главное меню перед подключением
                    if (client.field_1687 != null) {
                        client.field_1687.method_8525(); // disconnect
                    }

                    class_639 address = class_639.method_2950(bestIp);
                    class_642 info = new class_642(mode.name, bestIp, class_642.class_8678.field_45611);
                    class_412.method_36877(parentScreen, client, address, info, false, null);
                } catch (Throwable t) {
                    System.err.println("[Glade Navigator] Ошибка при подключении: " + t.getMessage());
                }
            });
        });
    }

    public static List<GladeNavigatorMode> getDefaultModes() {
        List<GladeNavigatorMode> list = new ArrayList<>();
        list.add(new GladeNavigatorMode("mode-test", "Тестовый Сервер", "ТЕСТ", "#2ecc71", "Локальный тестовый сервер Vanilla 1.21.1", "server", List.of("127.0.0.1:25565"), 1));
        list.add(new GladeNavigatorMode("mode-azerus", "Azerus", "ИВЕНТ", "#e74c3c", "Эпические приключения", "book", List.of("127.0.0.1:25565"), 165));
        list.add(new GladeNavigatorMode("mode-gtm", "GTM - ГТА", "ОБНОВА", "#3498db", "ГТА в Minecraft", "gun", List.of("127.0.0.1:25565"), 67));
        list.add(new GladeNavigatorMode("mode-stevechaos", "Custom SteveChaos", "ТОП", "#e67e22", "Битва тактик и классов", "sword", List.of("127.0.0.1:25565"), 855));
        list.add(new GladeNavigatorMode("mode-swordmasters", "Мастера Мечей", "ХИТ", "#9b59b6", "Дуэли на клинках", "blade", List.of("127.0.0.1:25565"), 433));
        list.add(new GladeNavigatorMode("mode-arcades", "Аркады", "ИГРЫ", "#1abc9c", "Мини-игры и паркур", "gamepad", List.of("127.0.0.1:25565"), 316));
        list.add(new GladeNavigatorMode("mode-castlefight", "CastleFight", "PVP", "#c0392b", "Осада замков и тактика", "castle", List.of("127.0.0.1:25565"), 157));
        return list;
    }
}
