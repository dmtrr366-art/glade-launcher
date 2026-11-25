package com.glade.mod;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

public class GladeConfig {
    public static class ConfigData {
        public String serverAddress = "127.0.0.1:25565";
        public String serverName = "Glade Local";
    }

    private static ConfigData instance = null;

    public static ConfigData get() {
        if (instance == null) {
            load();
        }
        return instance;
    }

    public static void load() {
        File file = new File("config/glade.json");
        if (!file.exists()) {
            File legacyFile = new File("config/hoplitex.json");
            if (legacyFile.exists()) {
                file = legacyFile;
            }
        }
        Gson gson = new GsonBuilder().setPrettyPrinting().create();
        try {
            if (file.exists()) {
                try (FileReader reader = new FileReader(file)) {
                    instance = gson.fromJson(reader, ConfigData.class);
                }
            }
            if (instance == null) {
                instance = new ConfigData();
                File target = new File("config/glade.json");
                if (target.getParentFile() != null) {
                    target.getParentFile().mkdirs();
                }
                try (FileWriter writer = new FileWriter(target)) {
                    gson.toJson(instance, writer);
                }
            }
        } catch (Exception e) {
            System.err.println("[Glade] Error loading config: " + e.getMessage());
            instance = new ConfigData();
        }
    }
}
