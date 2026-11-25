package com.glade.mod;

import java.awt.image.BufferedImage;
import java.io.InputStream;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.imageio.ImageIO;
import net.minecraft.class_1011;
import net.minecraft.class_1043;
import net.minecraft.class_2960;
import net.minecraft.class_310;

public class GladeAnimationManager {
    public static final int TOTAL_FRAMES = 100;
    public static final long FRAME_DURATION_MS = 100L; // 10 fps (10.0s loop)

    private static final class_2960[] FRAME_IDS = new class_2960[TOTAL_FRAMES];
    private static final boolean[] FRAME_LOADED = new boolean[TOTAL_FRAMES];
    private static final AtomicBoolean LOADER_STARTED = new AtomicBoolean(false);
    private static volatile boolean firstFrameReady = false;

    // UI Textures
    public static final class_2960 LOGO = class_2960.method_60655("glade", "textures/gui/glade_logo.png");
    public static final class_2960 BTN_PLAY = class_2960.method_60655("glade", "textures/gui/btn_play.png");
    public static final class_2960 BTN_PLAY_HOVER = class_2960.method_60655("glade", "textures/gui/btn_play_hover.png");
    public static final class_2960 BTN_SETTINGS = class_2960.method_60655("glade", "textures/gui/btn_settings.png");
    public static final class_2960 BTN_SETTINGS_HOVER = class_2960.method_60655("glade", "textures/gui/btn_settings_hover.png");
    public static final class_2960 BTN_QUIT = class_2960.method_60655("glade", "textures/gui/btn_quit.png");
    public static final class_2960 BTN_QUIT_HOVER = class_2960.method_60655("glade", "textures/gui/btn_quit_hover.png");

    private static boolean uiTexturesLoaded = false;

    static {
        for (int i = 0; i < TOTAL_FRAMES; i++) {
            FRAME_IDS[i] = class_2960.method_60655("glade", String.format("textures/gui/frames/frame_%03d.jpg", i));
        }
    }

    public static void init(class_310 client) {
        if (client == null) return;
        ensureUiTextures(client);
        ensureFirstFrame(client);
        startBackgroundLoader(client);
    }

    private static synchronized void ensureUiTextures(class_310 client) {
        if (uiTexturesLoaded) return;
        registerPngTexture(client, LOGO, "/assets/glade/textures/gui/glade_logo.png");
        registerPngTexture(client, BTN_PLAY, "/assets/glade/textures/gui/btn_play.png");
        registerPngTexture(client, BTN_PLAY_HOVER, "/assets/glade/textures/gui/btn_play_hover.png");
        registerPngTexture(client, BTN_SETTINGS, "/assets/glade/textures/gui/btn_settings.png");
        registerPngTexture(client, BTN_SETTINGS_HOVER, "/assets/glade/textures/gui/btn_settings_hover.png");
        registerPngTexture(client, BTN_QUIT, "/assets/glade/textures/gui/btn_quit.png");
        registerPngTexture(client, BTN_QUIT_HOVER, "/assets/glade/textures/gui/btn_quit_hover.png");
        uiTexturesLoaded = true;
    }

    private static void registerPngTexture(class_310 client, class_2960 id, String path) {
        try (InputStream in = GladeAnimationManager.class.getResourceAsStream(path)) {
            if (in != null) {
                class_1011 img = class_1011.method_4309(in);
                class_1043 tex = new class_1043(img);
                client.method_1531().method_4616(id, tex);
            }
        } catch (Throwable t) {
            System.err.println("[Glade] Failed to register texture " + path + ": " + t.getMessage());
        }
    }

    private static synchronized void ensureFirstFrame(class_310 client) {
        if (firstFrameReady) return;
        class_1011 img = decodeJpegFrame(0);
        if (img != null) {
            class_1043 tex = new class_1043(img);
            client.method_1531().method_4616(FRAME_IDS[0], tex);
            FRAME_LOADED[0] = true;
            firstFrameReady = true;
        }
    }

    private static void startBackgroundLoader(class_310 client) {
        if (!LOADER_STARTED.compareAndSet(false, true)) return;

        Thread loaderThread = new Thread(() -> {
            for (int i = 1; i < TOTAL_FRAMES; i++) {
                final int frameIndex = i;
                class_1011 img = decodeJpegFrame(frameIndex);
                if (img != null) {
                    client.execute(() -> {
                        try {
                            class_1043 tex = new class_1043(img);
                            client.method_1531().method_4616(FRAME_IDS[frameIndex], tex);
                            FRAME_LOADED[frameIndex] = true;
                        } catch (Throwable t) {
                            // ignore
                        }
                    });
                }
                try {
                    Thread.sleep(12);
                } catch (InterruptedException ignored) {}
            }
        }, "Glade-Live-Background-Loader");

        loaderThread.setDaemon(true);
        loaderThread.setPriority(Thread.MIN_PRIORITY);
        loaderThread.start();
    }

    private static class_1011 decodeJpegFrame(int index) {
        String path = String.format("/assets/glade/textures/gui/frames/frame_%03d.jpg", index);
        try (InputStream in = GladeAnimationManager.class.getResourceAsStream(path)) {
            if (in == null) return null;
            BufferedImage bImg = ImageIO.read(in);
            if (bImg == null) return null;
            int w = bImg.getWidth();
            int h = bImg.getHeight();
            class_1011 nativeImg = new class_1011(w, h, false);
            int[] rgb = bImg.getRGB(0, 0, w, h, null, 0, w);
            for (int y = 0; y < h; y++) {
                int rowOffset = y * w;
                for (int x = 0; x < w; x++) {
                    int argb = rgb[rowOffset + x];
                    int a = (argb >> 24) & 0xFF;
                    int r = (argb >> 16) & 0xFF;
                    int g = (argb >> 8) & 0xFF;
                    int b = argb & 0xFF;
                    int nativeColor = (a << 24) | (b << 16) | (g << 8) | r;
                    nativeImg.method_4305(x, y, nativeColor);
                }
            }
            return nativeImg;
        } catch (Throwable t) {
            return null;
        }
    }

    public static class_2960 getCurrentTexture() {
        int target = (int) ((System.currentTimeMillis() / FRAME_DURATION_MS) % TOTAL_FRAMES);
        if (FRAME_LOADED[target]) {
            return FRAME_IDS[target];
        }
        for (int i = target; i >= 0; i--) {
            if (FRAME_LOADED[i]) return FRAME_IDS[i];
        }
        return FRAME_IDS[0];
    }
}
