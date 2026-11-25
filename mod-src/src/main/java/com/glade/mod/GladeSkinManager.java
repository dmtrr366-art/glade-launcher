package com.glade.mod;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import net.minecraft.class_1011;
import net.minecraft.class_1043;
import net.minecraft.class_2960;
import net.minecraft.class_310;
import net.minecraft.class_8685;

public class GladeSkinManager {
    private static final Map<String, class_8685> SKIN_CACHE = new ConcurrentHashMap<>();
    private static final Set<String> PENDING = ConcurrentHashMap.newKeySet();
    private static final ExecutorService EXECUTOR = Executors.newFixedThreadPool(2);

    /**
     * Получить или запросить кастомный скин игрока из лаунчера Glade
     */
    public static class_8685 getTextures(String playerName, class_8685 fallback) {
        if (playerName == null || playerName.trim().isEmpty()) {
            return fallback;
        }

        String name = playerName.trim();
        class_8685 cached = SKIN_CACHE.get(name.toLowerCase());
        if (cached != null) {
            return cached;
        }

        // Если скин еще не загружался, инициируем фоновую загрузку из лаунчера
        if (PENDING.add(name.toLowerCase())) {
            EXECUTOR.submit(() -> fetchSkin(name));
        }

        return fallback;
    }

    private static void fetchSkin(String playerName) {
        try {
            // Опрашиваем локальный сервер лаунчера Glade
            String[] urlCandidates = new String[] {
                "http://127.0.0.1:3000/api/skins/" + playerName,
                "http://localhost:3000/api/skins/" + playerName
            };

            byte[] skinBytes = null;
            for (String urlStr : urlCandidates) {
                try {
                    URL url = URI.create(urlStr).toURL();
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(1500);
                    conn.setReadTimeout(3000);
                    conn.setRequestMethod("GET");
                    if (conn.getResponseCode() == 200) {
                        try (InputStream in = conn.getInputStream()) {
                            skinBytes = in.readAllBytes();
                            break;
                        }
                    }
                } catch (Exception ignored) {}
            }

            if (skinBytes == null || skinBytes.length == 0) {
                return;
            }

            // Проверяем модель скина (slim / wide)
            boolean isSlim = false;
            try {
                URL modelUrl = URI.create("http://127.0.0.1:3000/api/skins/" + playerName + "/model").toURL();
                HttpURLConnection conn = (HttpURLConnection) modelUrl.openConnection();
                conn.setConnectTimeout(1000);
                conn.setReadTimeout(2000);
                if (conn.getResponseCode() == 200) {
                    try (InputStream in = conn.getInputStream()) {
                        String resp = new String(in.readAllBytes());
                        if (resp.contains("slim")) {
                            isSlim = true;
                        }
                    }
                }
            } catch (Exception ignored) {}

            final byte[] finalBytes = skinBytes;
            final boolean finalSlim = isSlim;

            // Регистрируем текстуру в главном потоке рендера Minecraft
            class_310 client = class_310.method_1551();
            if (client != null) {
                client.execute(() -> {
                    try {
                        class_1011 nativeImage = class_1011.method_4309(new ByteArrayInputStream(finalBytes));
                        class_1043 texture = new class_1043(nativeImage);
                        class_2960 skinId = class_2960.method_60655("glade", "skins/" + playerName.toLowerCase().replaceAll("[^a-z0-9_.-]", "_"));
                        client.method_1531().method_4616(skinId, texture);

                        class_8685.class_7920 model = finalSlim ? class_8685.class_7920.field_41123 : class_8685.class_7920.field_41122;
                        class_8685 textures = new class_8685(skinId, null, null, null, model, true);
                        SKIN_CACHE.put(playerName.toLowerCase(), textures);

                        System.out.println("[Glade Skin] Скин игрока " + playerName + " успешно применен (" + (finalSlim ? "slim" : "classic") + ")!");
                    } catch (Throwable t) {
                        System.err.println("[Glade Skin] Ошибка при регистрации текстуры скина: " + t.getMessage());
                    }
                });
            }
        } catch (Throwable t) {
            System.err.println("[Glade Skin] Ошибка загрузки скина для " + playerName + ": " + t.getMessage());
        }
    }
}
