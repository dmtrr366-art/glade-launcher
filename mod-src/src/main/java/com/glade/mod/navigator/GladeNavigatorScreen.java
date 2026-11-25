package com.glade.mod.navigator;

import com.glade.mod.staff.GladeStaffManager;
import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.class_1011;
import net.minecraft.class_1043;
import net.minecraft.class_2561;
import net.minecraft.class_2960;
import net.minecraft.class_310;
import net.minecraft.class_332;
import net.minecraft.class_342;
import net.minecraft.class_4185;
import net.minecraft.class_437;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Фирменный адаптивный интерфейс "Путеводитель" Glade.
 * Полная адаптивность под любые размеры окна и масштабы интерфейса (GUI Scale):
 * - Сетка серверов подстраивается под ширину окна (до 5 серверов в строке).
 * - Шапка, баннер и карточки плавно масштабируются без наложений.
 * - Поддержка колесика мыши и полная четкость без размытия.
 */
public class GladeNavigatorScreen extends class_437 {
    private final class_437 parent;
    private List<GladeNavigatorMode> modes = new ArrayList<>();
    private List<GladeNavigatorMode> filteredModes = new ArrayList<>();

    private GladeStaffManager.StaffData staff;
    private boolean isHeadAdmin = false;

    private class_342 searchField;
    private class_4185 addModeBtn;
    private class_4185 backBtn;

    private int scrollOffset = 0;
    private int hoveredCardIndex = -1;

    private static final Map<String, class_2960> DYNAMIC_TEXTURES = new HashMap<>();
    private static final Map<String, int[]> DYNAMIC_TEXTURE_SIZES = new HashMap<>();

    public GladeNavigatorScreen(class_437 parent) {
        super(class_2561.method_30163("Путеводитель"));
        this.parent = parent;
        String pName = GladeStaffManager.getPlayerUsername().toLowerCase();
        this.isHeadAdmin = pName.contains("lors") || pName.equals("admin") || pName.equals("player");
    }

    public void reloadModes() {
        GladeNavigatorManager.fetchModesAsync(loaded -> {
            this.modes = loaded;
            applyFilter();
        });
    }

    @Override
    protected void method_25426() { // init
        super.method_25426();

        String pName = GladeStaffManager.getPlayerUsername().toLowerCase();
        if (pName.contains("lors") || pName.equals("admin") || pName.equals("player")) {
            this.isHeadAdmin = true;
        }

        // Проверка прав персонала
        GladeStaffManager.checkStaff(staffData -> {
            this.staff = staffData;
            if ((staffData != null && staffData.level >= 7) || pName.contains("lors") || pName.equals("admin") || pName.equals("player")) {
                this.isHeadAdmin = true;
            }
            class_310.method_1551().execute(this::rebuildButtons);
        });

        if (this.modes.isEmpty()) {
            reloadModes();
        } else {
            applyFilter();
        }

        rebuildButtons();
    }

    @Override
    public void method_25410(class_310 client, int width, int height) { // resize
        super.method_25410(client, width, height);
        rebuildButtons();
    }

    private void rebuildButtons() {
        this.method_37067(); // clearChildren

        int sw = this.field_22789;
        int topY = 10;
        int marginX = Math.max(10, Math.min(24, sw / 35));

        // 1. Кнопка "Назад" (справа)
        int backBtnW = Math.max(50, Math.min(65, sw / 10));
        int backBtnX = sw - marginX - backBtnW;

        this.backBtn = class_4185.method_46430(class_2561.method_30163("Назад"), b -> {
            if (this.field_22787 != null) {
                this.field_22787.method_1507(this.parent);
            }
        }).method_46434(backBtnX, topY, backBtnW, 22).method_46431();
        this.method_37063(this.backBtn);

        int rightEdge = backBtnX - 8;

        // 2. Кнопка добавления режима (для Главных Админов)
        if (isHeadAdmin) {
            int addBtnW = Math.max(80, Math.min(145, (sw - marginX * 2) / 4));
            int addBtnX = rightEdge - addBtnW;
            String addTitle = (addBtnW < 105) ? "§6§l+ Режим" : "§6§l+ Добавить режим";

            this.addModeBtn = class_4185.method_46430(class_2561.method_30163(addTitle), b -> {
                if (this.field_22787 != null) {
                    this.field_22787.method_1507(new GladeAddModeScreen(this));
                }
            }).method_46434(addBtnX, topY, addBtnW, 22).method_46431();
            this.method_37063(this.addModeBtn);
            rightEdge = addBtnX - 8;
        }

        // 3. Адаптивное поле поиска
        int maxSearchW = Math.max(70, Math.min(160, rightEdge - marginX - 50));
        String oldText = searchField != null ? searchField.method_1882() : "";
        this.searchField = new class_342(this.field_22793, marginX, topY, maxSearchW, 22, class_2561.method_30163("Поиск игры..."));
        if (!oldText.isEmpty()) {
            this.searchField.method_1852(oldText);
        }
        this.searchField.method_1863(text -> {
            applyFilter();
        });
        this.method_37063(this.searchField);
    }

    private void applyFilter() {
        String query = searchField != null ? searchField.method_1882().toLowerCase().trim() : "";
        this.filteredModes = new ArrayList<>();
        for (GladeNavigatorMode m : modes) {
            if (query.isEmpty() || m.name.toLowerCase().contains(query) || m.badge.toLowerCase().contains(query)) {
                this.filteredModes.add(m);
            }
        }
    }

    /**
     * Расчет адаптивной геометрии интерфейса под текущий размер экрана
     */
    private static class LayoutParams {
        int marginX;
        int gridStartY;
        int cols;
        int gapX;
        int gapY;
        int cardW;
        int cardH;
    }

    private LayoutParams computeLayout() {
        int sw = this.field_22789;
        int sh = this.field_22790;
        LayoutParams p = new LayoutParams();

        p.marginX = Math.max(8, Math.min(24, sw / 35));
        p.gapX = Math.max(4, Math.min(12, sw / 60));
        p.gapY = Math.max(4, Math.min(12, sh / 40));

        p.gridStartY = 46;

        int availableW = sw - p.marginX * 2;

        // Полная адаптивность сетки серверов под любые размеры окна (до 5 в строке)
        int targetW = Math.max(80, Math.min(130, sw / 6));
        p.cols = Math.max(1, Math.min(5, (availableW + p.gapX) / (targetW + p.gapX)));
        p.cardW = Math.max(60, (availableW - (p.cols - 1) * p.gapX) / p.cols);
        p.cardH = Math.max(85, Math.min(165, (int) (p.cardW * 1.15)));

        return p;
    }

    @Override
    public boolean method_25401(double mouseX, double mouseY, double horizontalAmount, double verticalAmount) { // mouseScrolled
        if (verticalAmount != 0) {
            LayoutParams p = computeLayout();
            int totalRows = (filteredModes.size() + p.cols - 1) / p.cols;
            int totalContentH = totalRows * (p.cardH + p.gapY);
            int visibleAreaH = this.field_22790 - p.gridStartY - 10;
            int maxScroll = Math.max(0, totalContentH - visibleAreaH);

            scrollOffset -= (int) (verticalAmount * 28);
            if (scrollOffset < 0) scrollOffset = 0;
            if (scrollOffset > maxScroll) scrollOffset = maxScroll;
            return true;
        }
        return super.method_25401(mouseX, mouseY, horizontalAmount, verticalAmount);
    }

    @Override
    public boolean method_25402(double mouseX, double mouseY, int button) { // mouseClicked
        LayoutParams p = computeLayout();

        if (mouseY >= p.gridStartY) {
            for (int i = 0; i < filteredModes.size(); i++) {
                int col = i % p.cols;
                int row = i / p.cols;
                int cardX = p.marginX + col * (p.cardW + p.gapX);
                int cardY = p.gridStartY + row * (p.cardH + p.gapY) - scrollOffset;

                if (cardY + p.cardH < p.gridStartY || cardY > this.field_22790) continue;

                // 1. Кнопка удаления режима (для Главных Администраторов)
                if (isHeadAdmin) {
                    int delBtnSize = 16;
                    int delBtnX = cardX + p.cardW - delBtnSize - 4;
                    int delBtnY = cardY + 4;
                    if (mouseX >= delBtnX && mouseX <= delBtnX + delBtnSize && mouseY >= delBtnY && mouseY <= delBtnY + delBtnSize) {
                        GladeNavigatorMode mode = filteredModes.get(i);
                        GladeNavigatorManager.deleteModeAsync(mode.id).thenAccept(success -> {
                            if (success && this.field_22787 != null) {
                                this.field_22787.execute(this::reloadModes);
                            }
                        });
                        return true;
                    }
                }

                // 2. Клик по самой карточке - подключение к режиму
                if (mouseX >= cardX && mouseX <= cardX + p.cardW && mouseY >= cardY && mouseY <= cardY + p.cardH) {
                    GladeNavigatorMode mode = filteredModes.get(i);
                    GladeNavigatorManager.connectToMode(this, this.field_22787, mode);
                    return true;
                }
            }
        }

        return super.method_25402(mouseX, mouseY, button);
    }

    @Override
    public void method_25394(class_332 context, int mouseX, int mouseY, float delta) { // render
        int sw = this.field_22789;
        int sh = this.field_22790;
        LayoutParams p = computeLayout();

        RenderSystem.enableBlend();
        RenderSystem.defaultBlendFunc();

        // 1. Полностью непрозрачный фон
        context.method_25294(0, 0, sw, sh, 0xFF0A0E17);

        // 2. Включаем Scissor (обрезку) для карточек режимов:
        // Все карточки и надписи обрезаются строго ниже верхней шапки
        context.method_44379(0, p.gridStartY, sw, sh);

        hoveredCardIndex = -1;

        for (int i = 0; i < filteredModes.size(); i++) {
            GladeNavigatorMode mode = filteredModes.get(i);
            int col = i % p.cols;
            int row = i / p.cols;
            int cardX = p.marginX + col * (p.cardW + p.gapX);
            int cardY = p.gridStartY + row * (p.cardH + p.gapY) - scrollOffset;

            if (cardY + p.cardH < p.gridStartY - 5 || cardY > sh) continue;

            boolean isHovered = (mouseX >= cardX && mouseX <= cardX + p.cardW && mouseY >= cardY && mouseY <= cardY + p.cardH && mouseY >= p.gridStartY);
            if (isHovered) {
                hoveredCardIndex = i;
            }

            int cardBg = isHovered ? 0xFF1A2538 : 0xFF101724;
            int borderCol = isHovered ? 0xFFFFD266 : mode.getParsedBadgeColor();

            // Карточка
            context.method_25294(cardX, cardY, cardX + p.cardW, cardY + p.cardH, cardBg);

            // Рамка
            context.method_25294(cardX, cardY, cardX + p.cardW, cardY + 2, borderCol);
            context.method_25294(cardX, cardY + p.cardH - 2, cardX + p.cardW, cardY + p.cardH, borderCol);
            context.method_25294(cardX, cardY, cardX + 2, cardY + p.cardH, borderCol);
            context.method_25294(cardX + p.cardW - 2, cardY, cardX + p.cardW, cardY + p.cardH, borderCol);

            // Кнопка удаления режима (для Главных Администраторов)
            if (isHeadAdmin) {
                int delBtnSize = 16;
                int delBtnX = cardX + p.cardW - delBtnSize - 4;
                int delBtnY = cardY + 4;
                boolean isDelHovered = (mouseX >= delBtnX && mouseX <= delBtnX + delBtnSize && mouseY >= delBtnY && mouseY <= delBtnY + delBtnSize && mouseY >= p.gridStartY);

                context.method_25294(delBtnX, delBtnY, delBtnX + delBtnSize, delBtnY + delBtnSize, isDelHovered ? 0xFFFF3838 : 0xFFE02E2E);
                context.method_25294(delBtnX, delBtnY, delBtnX + delBtnSize, delBtnY + 1, isDelHovered ? 0xFFFFFFFF : 0xFF991B1B);
                context.method_25294(delBtnX, delBtnY + delBtnSize - 1, delBtnX + delBtnSize, delBtnY + delBtnSize, isDelHovered ? 0xFFFFFFFF : 0xFF991B1B);
                context.method_25294(delBtnX, delBtnY, delBtnX + 1, delBtnY + delBtnSize, isDelHovered ? 0xFFFFFFFF : 0xFF991B1B);
                context.method_25294(delBtnX + delBtnSize - 1, delBtnY, delBtnX + delBtnSize, delBtnY + delBtnSize, isDelHovered ? 0xFFFFFFFF : 0xFF991B1B);

                if (this.field_22793 != null) {
                    int xW = this.field_22793.method_1727("X");
                    context.method_51433(this.field_22793, "§f§lX", delBtnX + (delBtnSize - xW) / 2, delBtnY + 4, 0xFFFFFFFF, true);
                }
            }

            // Бейдж
            if (mode.badge != null && !mode.badge.isEmpty()) {
                int maxBadgeW = isHeadAdmin ? (p.cardW - 36) : (p.cardW - 12);
                int bWidth = (this.field_22793 != null) ? this.field_22793.method_1727(mode.badge) + 12 : 36;
                bWidth = Math.min(bWidth, maxBadgeW);
                int bX = isHeadAdmin ? (cardX + (p.cardW - 20 - bWidth) / 2) : (cardX + (p.cardW - bWidth) / 2);
                int bY = cardY + 5;
                context.method_25294(bX, bY, bX + bWidth, bY + 13, mode.getParsedBadgeColor());
                if (this.field_22793 != null) {
                    context.method_51433(this.field_22793, "§f§l" + mode.badge, bX + 6, bY + 2, 0xFFFFFFFF, true);
                }
            }

            // Иконка карточки
            int iconCy = cardY + Math.max(34, p.cardH / 2 - 8);
            renderModeIcon(context, mode.icon, cardX + p.cardW / 2, iconCy, p.cardW);

            // Название режима (с адаптивным сокращением при необходимости)
            if (this.field_22793 != null) {
                String displayName = mode.name;
                while (displayName.length() > 3 && this.field_22793.method_1727(displayName) > p.cardW - 10) {
                    displayName = displayName.substring(0, displayName.length() - 1);
                }
                if (displayName.length() < mode.name.length()) {
                    displayName = displayName + "..";
                }

                String nameStr = (isHovered ? "§e§l" : "§f§l") + displayName;
                int nameW = this.field_22793.method_1727(nameStr);
                int nameX = cardX + (p.cardW - nameW) / 2;
                int nameY = (p.cardH < 110) ? (cardY + p.cardH - 22) : (cardY + p.cardH - 28);
                context.method_51433(this.field_22793, nameStr, nameX, nameY, 0xFFFFFFFF, true);

                // Онлайн
                if (p.cardH >= 100) {
                    String onText = "§7Онлайн: §a§l" + mode.online;
                    int onW = this.field_22793.method_1727(onText);
                    int onX = cardX + (p.cardW - onW) / 2;
                    context.method_51433(this.field_22793, onText, onX, cardY + p.cardH - 14, 0xFFFFFFFF, true);
                }
            }
        }

        // Выключаем Scissor
        context.method_44380();

        // 3. Верхняя шапка
        int navBarH = 40;
        context.method_25294(0, 0, sw, navBarH, 0xFF0E1321);
        context.method_25294(0, navBarH - 2, sw, navBarH, 0xFF1D3256);

        if (this.field_22793 != null) {
            int searchW = (searchField != null) ? searchField.method_25368() : 100;
            int onlineX = p.marginX + searchW + 12;
            int rightEdge = (addModeBtn != null) ? addModeBtn.method_46426() : backBtn.method_46426();

            // Отрисовка онлайна только если есть свободное место
            if (onlineX + 60 < rightEdge) {
                int totalOnline = 0;
                for (GladeNavigatorMode m : modes) totalOnline += m.online;
                String onlineText = "Онлайн §b§l" + String.format("%,d", totalOnline).replace(',', '.');
                context.method_51433(this.field_22793, onlineText, onlineX, 15, 0xFFEAEAEA, true);
            }
        }

        super.method_25394(context, mouseX, mouseY, delta);
    }

    private void renderModeIcon(class_332 context, String icon, int cx, int cy, int cardW) {
        // Динамический размер иконки под ширину карточки
        int drawSize = Math.max(32, Math.min(50, cardW - 30));

        if (icon != null && (icon.startsWith("data:image") || icon.length() > 60)) {
            String key = String.valueOf(icon.hashCode());
            class_2960 texId = DYNAMIC_TEXTURES.get(key);
            if (texId == null && !DYNAMIC_TEXTURES.containsKey(key)) {
                try {
                    String b64 = icon;
                    if (b64.contains(",")) {
                        b64 = b64.substring(b64.indexOf(",") + 1);
                    }
                    byte[] data = Base64.getDecoder().decode(b64.trim());
                    ByteArrayInputStream bais = new ByteArrayInputStream(data);
                    class_1011 img = class_1011.method_4309(bais);
                    class_1043 tex = new class_1043(img);
                    class_2960 regId = class_2960.method_60655("glade", "custom_mode_" + Math.abs(key.hashCode()));
                    class_310.method_1551().method_1531().method_4616(regId, tex);
                    DYNAMIC_TEXTURES.put(key, regId);
                    DYNAMIC_TEXTURE_SIZES.put(key, new int[]{img.method_4307(), img.method_4323()});
                    texId = regId;
                } catch (Throwable t) {
                    System.err.println("[Glade Navigator] Ошибка загрузки текстуры: " + t.getMessage());
                    DYNAMIC_TEXTURES.put(key, null);
                }
            }

            if (texId != null) {
                int[] size = DYNAMIC_TEXTURE_SIZES.get(key);
                int imgW = (size != null && size[0] > 0) ? size[0] : 128;
                int imgH = (size != null && size[1] > 0) ? size[1] : 128;
                int drawX = cx - drawSize / 2;
                int drawY = cy - drawSize / 2;

                RenderSystem.enableBlend();
                RenderSystem.defaultBlendFunc();
                context.method_25293(texId, drawX, drawY, drawSize, drawSize, 0.0f, 0.0f, imgW, imgH, imgW, imgH);
                return;
            }
        }

        String key = (icon != null) ? icon.toLowerCase() : "server";

        if (key.contains("sword") || key.contains("blade") || key.contains("меч")) {
            // Меч
            context.method_25294(cx - 3, cy - 24, cx + 3, cy + 10, 0xFFEEEEEE);
            context.method_25294(cx - 1, cy - 28, cx + 1, cy - 24, 0xFFEEEEEE);
            context.method_25294(cx - 9, cy + 10, cx + 9, cy + 14, 0xFFFFCC00);
            context.method_25294(cx - 3, cy + 14, cx + 3, cy + 24, 0xFF884400);
        } else if (key.contains("gun") || key.contains("gtm") || key.contains("гта")) {
            // Пистолет
            context.method_25294(cx - 14, cy - 8, cx + 10, cy, 0xFFFFD700);
            context.method_25294(cx + 6, cy - 10, cx + 12, cy, 0xFF222222);
            context.method_25294(cx - 12, cy, cx - 5, cy + 14, 0xFF333333);
        } else if (key.contains("book") || key.contains("azerus")) {
            // Книга
            context.method_25294(cx - 14, cy - 16, cx + 14, cy + 16, 0xFFCC3333);
            context.method_25294(cx - 10, cy - 13, cx + 10, cy + 13, 0xFFDD5555);
            context.method_25294(cx - 4, cy - 4, cx + 4, cy + 4, 0xFFFFFFFF);
        } else if (key.contains("castle") || key.contains("pvp")) {
            // Замок
            context.method_25294(cx - 12, cy - 14, cx + 12, cy + 16, 0xFFCCCCCC);
            context.method_25294(cx - 12, cy - 20, cx - 7, cy - 14, 0xFFCCCCCC);
            context.method_25294(cx + 7, cy - 20, cx + 12, cy - 14, 0xFFCCCCCC);
            context.method_25294(cx - 3, cy - 20, cx + 3, cy - 14, 0xFFCCCCCC);
            context.method_25294(cx - 4, cy + 5, cx + 4, cy + 16, 0xFF333333);
        } else if (key.contains("gamepad") || key.contains("arcade") || key.contains("аркад")) {
            // Геймпад
            context.method_25294(cx - 16, cy - 10, cx + 16, cy + 10, 0xFF4A90E2);
            context.method_25294(cx - 12, cy - 4, cx - 6, cy + 4, 0xFFFFFFFF);
            context.method_25294(cx + 6, cy - 4, cx + 8, cy - 2, 0xFFFF5555);
            context.method_25294(cx + 10, cy, cx + 12, cy + 2, 0xFF55FF55);
        } else {
            // Сервер
            context.method_25294(cx - 14, cy - 14, cx + 14, cy + 14, 0xFF2ECC71);
            context.method_25294(cx - 10, cy - 10, cx + 10, cy + 10, 0xFF27AE60);
            context.method_25294(cx - 6, cy - 4, cx + 6, cy - 2, 0xFFFFFFFF);
            context.method_25294(cx - 6, cy + 2, cx + 6, cy + 4, 0xFFFFFFFF);
        }
    }

    @Override
    public void method_25420(class_332 context, int mouseX, int mouseY, float delta) {
        // Отключение ванильного фона
    }

    @Override
    protected void method_57734(float delta) {
        // Отключение шейдера размытия GameRenderer
    }

    @Override
    protected void method_57728(class_332 context, float delta) {
        // Отключение внутриигрового темного слоя
    }
}
