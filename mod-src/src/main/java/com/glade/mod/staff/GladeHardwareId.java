package com.glade.mod.staff;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

public class GladeHardwareId {
    private static String cachedHwid = null;

    /**
     * Получает уникальный аппаратный серийный номер ПК (HWID).
     * Формат: GLADE-HWID-XXXX-XXXX-XXXX-XXXX
     */
    public static synchronized String getHardwareSerial() {
        if (cachedHwid != null) {
            return cachedHwid;
        }

        String rawId = "";
        String os = System.getProperty("os.name", "").toLowerCase();

        try {
            if (os.contains("mac") || os.contains("darwin")) {
                // macOS: Чтение системного аппаратного UUID (IOPlatformUUID)
                Process p = Runtime.getRuntime().exec(new String[] { "ioreg", "-rd1", "-c", "IOPlatformExpertDevice" });
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        if (line.contains("IOPlatformUUID")) {
                            String[] parts = line.split("=");
                            if (parts.length > 1) {
                                rawId = parts[1].replace("\"", "").trim();
                                break;
                            }
                        }
                    }
                }
            } else if (os.contains("win")) {
                // Windows: Чтение системного UUID материнской платы / BIOS
                Process p = Runtime.getRuntime().exec(new String[] { "wmic", "csproduct", "get", "uuid" });
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        line = line.trim();
                        if (!line.isEmpty() && !line.equalsIgnoreCase("UUID")) {
                            rawId = line;
                            break;
                        }
                    }
                }
            } else {
                // Linux: Чтение /etc/machine-id
                Process p = Runtime.getRuntime().exec(new String[] { "cat", "/etc/machine-id" });
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
                    rawId = reader.readLine();
                }
            }
        } catch (Throwable t) {
            System.err.println("[Glade HWID] Native query error, using fallback: " + t.getMessage());
        }

        if (rawId == null || rawId.trim().isEmpty()) {
            rawId = System.getProperty("os.name") + "_" +
                    System.getProperty("os.arch") + "_" +
                    System.getProperty("user.name") + "_" +
                    Runtime.getRuntime().availableProcessors();
        }

        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(rawId.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02X", b));
            }
            String h = hex.toString();
            cachedHwid = "GLADE-HWID-" + h.substring(0, 4) + "-" + h.substring(4, 8) + "-" + h.substring(8, 12) + "-" + h.substring(12, 16);
        } catch (Exception e) {
            cachedHwid = "GLADE-HWID-0000-0000-0000-0000";
        }

        return cachedHwid;
    }
}
