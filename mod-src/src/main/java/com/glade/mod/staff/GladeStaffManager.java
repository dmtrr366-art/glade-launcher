package com.glade.mod.staff;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.class_2561;
import net.minecraft.class_310;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

/**
 * Менеджер персонала Glade с аппаратной привязкой HWID.
 * Защищает доступ: работает только на разрешенном главными администраторами ПК.
 */
public class GladeStaffManager {
    public static class StaffData {
        public boolean isStaff = false;
        public boolean canOpen = false;
        public String hwidStatus = "PENDING"; // APPROVED, PENDING, MISMATCH
        public String registeredHwid = null;
        public String pendingHwid = null;
        public String clientHwid = "";
        public String username = "";
        public String role = "user";
        public String title = "Игрок";
        public int level = 0; // 0=user, 1=trainee, 2=helper, 3=sr_helper, 4=mod, 5=sr_mod, 6=admin, 7=head_admin
        public String color = "#a09488";
        public boolean canWarn = false;
        public boolean canKick = false;
        public boolean canMute = false;
        public boolean canTempban = false;
        public boolean canBan = false;
        public boolean canUnpunish = false;
        public int maxMuteMinutes = 0;
        public int maxBanDays = 0;
    }

    private static StaffData cachedStaff = null;
    private static long lastCacheTime = 0;
    private static final long CACHE_TTL_MS = 10000; // 10 секунд кэш

    public static String getApiUrl() {
        return System.getProperty("glade.api.url", "http://127.0.0.1:3000");
    }

    public static String getPlayerUsername() {
        String sysName = System.getProperty("glade.player.name");
        if (sysName != null && !sysName.trim().isEmpty()) {
            return sysName.trim();
        }
        class_310 mc = class_310.method_1551();
        if (mc != null && mc.method_1548() != null) {
            return mc.method_1548().method_1676();
        }
        return "Lorsik";
    }

    public static void checkStaff(Consumer<StaffData> callback) {
        long now = System.currentTimeMillis();
        if (cachedStaff != null && (now - lastCacheTime) < CACHE_TTL_MS) {
            callback.accept(cachedStaff);
            return;
        }

        CompletableFuture.supplyAsync(() -> {
            String username = getPlayerUsername();
            String myHwid = GladeHardwareId.getHardwareSerial();
            StaffData data = new StaffData();
            data.username = username;
            data.clientHwid = myHwid;

            try {
                String encodedUser = URLEncoder.encode(username, StandardCharsets.UTF_8);
                String encodedHwid = URLEncoder.encode(myHwid, StandardCharsets.UTF_8);
                String apiUrl = getApiUrl() + "/api/staff/verify?username=" + encodedUser + "&hwid=" + encodedHwid;

                URL url = URI.create(apiUrl).toURL();
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("x-glade-hwid", myHwid);
                conn.setConnectTimeout(3000);
                conn.setReadTimeout(3000);

                if (conn.getResponseCode() == 200) {
                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                        JsonObject json = JsonParser.parseReader(reader).getAsJsonObject();
                        if (json.has("isStaff") && json.get("isStaff").getAsBoolean()) {
                            data.isStaff = true;
                            data.role = json.get("role").getAsString();
                            data.title = json.get("title").getAsString();
                            data.level = json.get("level").getAsInt();
                            if (json.has("canOpen")) data.canOpen = json.get("canOpen").getAsBoolean();
                            if (json.has("hwidStatus")) data.hwidStatus = json.get("hwidStatus").getAsString();
                            if (json.has("registeredHwid") && !json.get("registeredHwid").isJsonNull()) {
                                data.registeredHwid = json.get("registeredHwid").getAsString();
                            }
                            if (json.has("color")) data.color = json.get("color").getAsString();

                            if (json.has("permissions")) {
                                JsonObject p = json.getAsJsonObject("permissions");
                                data.canWarn = p.has("canWarn") && p.get("canWarn").getAsBoolean();
                                data.canKick = p.has("canKick") && p.get("canKick").getAsBoolean();
                                data.canMute = p.has("canMute") && p.get("canMute").getAsBoolean();
                                data.canTempban = p.has("canTempban") && p.get("canTempban").getAsBoolean();
                                data.canBan = p.has("canBan") && p.get("canBan").getAsBoolean();
                                data.canUnpunish = (data.level >= 4) || (p.has("canUnpunish") && p.get("canUnpunish").getAsBoolean());
                                if (p.has("maxMuteMinutes")) data.maxMuteMinutes = p.get("maxMuteMinutes").getAsInt();
                                if (p.has("maxBanDays")) data.maxBanDays = p.get("maxBanDays").getAsInt();
                            }
                        }
                    }
                }
            } catch (Exception e) {
                System.err.println("[Glade Staff] Ошибка верификации роли и HWID: " + e.getMessage());
            }
            return data;
        }).thenAccept(data -> {
            cachedStaff = data;
            lastCacheTime = System.currentTimeMillis();

            class_310 mc = class_310.method_1551();
            if (mc != null) {
                mc.execute(() -> callback.accept(data));
            } else {
                callback.accept(data);
            }
        });
    }

    public static void openStaffOrHwidScreen(class_310 mc) {
        checkStaff(staff -> {
            if (staff == null || !staff.isStaff) {
                if (mc.field_1724 != null) {
                    mc.field_1724.method_43496(class_2561.method_30163("§c[Glade] У вас нет доступа к панели модерации. Назначьте роль персонала в лаунчере."));
                }
                return;
            }

            if (staff.canOpen) {
                // Компьютер привязан и одобрен главным администратором
                mc.method_1507(new GladePunishScreen(staff));
            } else {
                // Компьютер еще не привязан — показываем окно с серийным номером ПК и кнопкой копирования
                mc.method_1507(new GladeHwidScreen(staff));
            }
        });
    }

    public static void logPunishment(String target, String action, String rule, int stage, String duration, String reason) {
        CompletableFuture.runAsync(() -> {
            String admin = getPlayerUsername();
            String apiUrl = getApiUrl() + "/api/staff/log-punish";
            try {
                URL url = URI.create(apiUrl).toURL();
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; utf-8");
                conn.setDoOutput(true);
                conn.setConnectTimeout(3000);
                conn.setReadTimeout(3000);

                JsonObject json = new JsonObject();
                json.addProperty("adminUsername", admin);
                json.addProperty("targetUsername", target);
                json.addProperty("action", action);
                json.addProperty("rule", rule);
                json.addProperty("stage", stage);
                json.addProperty("duration", duration);
                json.addProperty("reason", reason);

                byte[] input = json.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(input, 0, input.length);
                }

                conn.getResponseCode();
            } catch (Exception e) {
                System.err.println("[Glade Staff] Ошибка отправки лога: " + e.getMessage());
            }
        });
    }

    public static void invalidateCache() {
        cachedStaff = null;
        lastCacheTime = 0;
    }
}
