package com.glade.mod.navigator;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Утилита пинга серверов Minecraft (Server List Ping Protocol)
 * и балансировки нагрузки между серверами одного игрового режима.
 */
public class GladeServerPinger {

    public static class PingResult {
        public final String address;
        public final String host;
        public final int port;
        public final boolean reachable;
        public final int onlinePlayers;
        public final int maxPlayers;
        public final long pingMs;

        public PingResult(String address, String host, int port, boolean reachable, int onlinePlayers, int maxPlayers, long pingMs) {
            this.address = address;
            this.host = host;
            this.port = port;
            this.reachable = reachable;
            this.onlinePlayers = onlinePlayers;
            this.maxPlayers = maxPlayers;
            this.pingMs = pingMs;
        }

        public static PingResult unreachable(String address, String host, int port) {
            return new PingResult(address, host, port, false, 999999, 0, 99999);
        }
    }

    /**
     * Пинг одного сервера по адресу host:port
     */
    public static PingResult ping(String address) {
        String host = address;
        int port = 25565;

        if (address.contains(":")) {
            String[] parts = address.split(":", 2);
            host = parts[0].trim();
            try {
                port = Integer.parseInt(parts[1].trim());
            } catch (Exception ignored) {}
        }

        long start = System.currentTimeMillis();
        try (Socket socket = new Socket()) {
            socket.setSoTimeout(1500);
            socket.connect(new InetSocketAddress(host, port), 1500);
            long pingMs = System.currentTimeMillis() - start;

            OutputStream out = socket.getOutputStream();
            InputStream in = socket.getInputStream();
            DataOutputStream dos = new DataOutputStream(out);
            DataInputStream dis = new DataInputStream(in);

            // 1. Handshake Packet (ID 0x00)
            ByteArrayOutputStream handshakeBytes = new ByteArrayOutputStream();
            DataOutputStream handshakeDos = new DataOutputStream(handshakeBytes);
            writeVarInt(handshakeDos, 0x00); // Packet ID
            writeVarInt(handshakeDos, 767);  // Protocol version (1.21.1)
            writeString(handshakeDos, host); // Host string
            handshakeDos.writeShort(port);   // Port
            writeVarInt(handshakeDos, 1);    // Next state: status (1)

            byte[] handshakeData = handshakeBytes.toByteArray();
            writeVarInt(dos, handshakeData.length);
            dos.write(handshakeData);

            // 2. Status Request Packet (ID 0x00, empty body)
            writeVarInt(dos, 1);
            dos.writeByte(0x00);
            dos.flush();

            // 3. Response
            readVarInt(dis); // Packet length
            int id = readVarInt(dis); // Packet ID (0x00)
            if (id != 0x00) {
                return new PingResult(address, host, port, true, 0, 100, pingMs);
            }

            int stringLen = readVarInt(dis);
            byte[] stringBytes = new byte[stringLen];
            dis.readFully(stringBytes);
            String jsonStr = new String(stringBytes, StandardCharsets.UTF_8);

            int online = 0;
            int max = 100;
            try {
                JsonObject obj = JsonParser.parseString(jsonStr).getAsJsonObject();
                if (obj.has("players")) {
                    JsonObject playersObj = obj.getAsJsonObject("players");
                    if (playersObj.has("online")) online = playersObj.get("online").getAsInt();
                    if (playersObj.has("max")) max = playersObj.get("max").getAsInt();
                }
            } catch (Exception ignored) {}

            return new PingResult(address, host, port, true, online, max, pingMs);
        } catch (Throwable t) {
            return PingResult.unreachable(address, host, port);
        }
    }

    /**
     * Выбор самого незагруженного сервера из списка адресов.
     * Сначала фильтрует доступные серверы, затем выбирает с наименьшим онлайном,
     * а при равном онлайне — с наименьшим пингом (задержкой).
     */
    public static CompletableFuture<String> pickBestServerAsync(List<String> serverIps) {
        if (serverIps == null || serverIps.isEmpty()) {
            return CompletableFuture.completedFuture("127.0.0.1:25565");
        }
        if (serverIps.size() == 1) {
            return CompletableFuture.completedFuture(serverIps.get(0));
        }

        return CompletableFuture.supplyAsync(() -> {
            List<CompletableFuture<PingResult>> futures = new ArrayList<>();
            for (String ip : serverIps) {
                futures.add(CompletableFuture.supplyAsync(() -> ping(ip)));
            }

            List<PingResult> results = new ArrayList<>();
            for (CompletableFuture<PingResult> f : futures) {
                try {
                    results.add(f.get(2000, TimeUnit.MILLISECONDS));
                } catch (Exception e) {
                    // Игнорируем таймауты
                }
            }

            if (results.isEmpty()) {
                return serverIps.get(0);
            }

            // Сортировка:
            // 1. Доступные серверы вперед
            // 2. Наименьшее количество игроков
            // 3. Наименьший пинг
            results.sort(Comparator
                .comparing((PingResult r) -> !r.reachable)
                .thenComparingInt(r -> r.onlinePlayers)
                .thenComparingLong(r -> r.pingMs)
            );

            PingResult best = results.get(0);
            System.out.println("[Glade Navigator] Выбран оптимальный сервер: " + best.address +
                " (доступен: " + best.reachable + ", онлайн: " + best.onlinePlayers + ", пинг: " + best.pingMs + "ms)");
            return best.address;
        });
    }

    private static void writeVarInt(DataOutputStream out, int value) throws Exception {
        while ((value & 0xFFFFFF80) != 0L) {
            out.writeByte((value & 0x7F) | 0x80);
            value >>>= 7;
        }
        out.writeByte(value & 0x7F);
    }

    private static int readVarInt(DataInputStream in) throws Exception {
        int i = 0;
        int max = 0;
        byte b;
        do {
            b = in.readByte();
            i |= (b & 0x7F) << (max++ * 7);
            if (max > 5) throw new RuntimeException("VarInt too big");
        } while ((b & 0x80) == 0x80);
        return i;
    }

    private static void writeString(DataOutputStream out, String str) throws Exception {
        byte[] bytes = str.getBytes(StandardCharsets.UTF_8);
        writeVarInt(out, bytes.length);
        out.write(bytes);
    }
}
