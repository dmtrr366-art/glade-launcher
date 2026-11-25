package com.glade.mod.navigator;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

/**
 * Кроссплатформенный нативный выбор файлов без блокировки OpenGL потока Minecraft.
 * На macOS активирует системный Finder Open Panel поверх игры.
 * На Windows использует OpenFileDialog.
 */
public class GladeFileChooser {

    public static void chooseImageFileAsync(Consumer<String> callback) {
        CompletableFuture.supplyAsync(() -> {
            String os = System.getProperty("os.name", "").toLowerCase();
            String selectedPath = "";

            try {
                if (os.contains("mac") || os.contains("darwin")) {
                    String[] script = {
                        "osascript",
                        "-e", "tell application \"System Events\"",
                        "-e", "activate",
                        "-e", "try",
                        "-e", "set theFile to choose file with prompt \"Выберите изображение для режима Glade\"",
                        "-e", "return POSIX path of theFile",
                        "-e", "on error",
                        "-e", "return \"\"",
                        "-e", "end try",
                        "-e", "end tell"
                    };

                    ProcessBuilder pb = new ProcessBuilder(script);
                    Process process = pb.start();

                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                        String line = reader.readLine();
                        if (line != null && !line.trim().isEmpty()) {
                            selectedPath = line.trim();
                        }
                    }
                    process.waitFor();

                } else if (os.contains("win")) {
                    String psCmd = "[System.Reflection.Assembly]::LoadWithPartialName('System.windows.forms') | Out-Null; " +
                        "$f = New-Object System.Windows.Forms.OpenFileDialog; " +
                        "$f.Filter = 'Изображения (*.png;*.jpg;*.jpeg)|*.png;*.jpg;*.jpeg'; " +
                        "$f.Title = 'Выберите изображение для режима Glade'; " +
                        "if($f.ShowDialog() -eq 'OK'){ Write-Output $f.FileName } else { Write-Output '' }";

                    ProcessBuilder pb = new ProcessBuilder("powershell", "-NoProfile", "-Command", psCmd);
                    Process process = pb.start();

                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                        String line = reader.readLine();
                        if (line != null && !line.trim().isEmpty()) {
                            selectedPath = line.trim();
                        }
                    }
                    process.waitFor();
                }
            } catch (Throwable t) {
                System.err.println("[Glade] Ошибка открытия системного диалога: " + t.getMessage());
            }

            return selectedPath;
        }).thenAccept(path -> {
            callback.accept(path != null ? path : "");
        });
    }
}
