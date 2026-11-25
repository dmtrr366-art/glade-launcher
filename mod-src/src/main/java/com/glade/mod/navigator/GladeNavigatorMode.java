package com.glade.mod.navigator;

import java.util.ArrayList;
import java.util.List;

/**
 * Модель игрового режима в Путеводителе Glade
 */
public class GladeNavigatorMode {
    public String id;
    public String name;
    public String badge;
    public String badgeColor;
    public String description;
    public String icon;
    public List<String> serverIps = new ArrayList<>();
    public int online = 0;

    public GladeNavigatorMode() {
    }

    public GladeNavigatorMode(String id, String name, String badge, String badgeColor, String description, String icon, List<String> serverIps, int online) {
        this.id = id;
        this.name = name;
        this.badge = badge != null ? badge : "NEW";
        this.badgeColor = badgeColor != null ? badgeColor : "#e67e22";
        this.description = description != null ? description : "";
        this.icon = icon != null ? icon : "server";
        this.serverIps = serverIps != null ? serverIps : new ArrayList<>();
        this.online = online;
    }

    public int getParsedBadgeColor() {
        if (badgeColor != null && badgeColor.startsWith("#")) {
            try {
                return (int) Long.parseLong("FF" + badgeColor.substring(1), 16);
            } catch (Exception ignored) {}
        }
        return 0xFFFF7700;
    }
}
