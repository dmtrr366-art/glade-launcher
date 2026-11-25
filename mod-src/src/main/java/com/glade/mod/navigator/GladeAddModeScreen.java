package com.glade.mod.navigator;

import com.glade.mod.staff.GladeStaffManager;
import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.class_2561;
import net.minecraft.class_310;
import net.minecraft.class_332;
import net.minecraft.class_342;
import net.minecraft.class_4185;
import net.minecraft.class_437;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * Диалог создания нового игрового режима для Главных Администраторов.
 * Полностью адаптивен под изменение размеров окна.
 */
public class GladeAddModeScreen extends class_437 {
    private final GladeNavigatorScreen parentScreen;

    private class_342 nameField;
    private class_342 badgeField;
    private class_342 ipsField;
    private class_4185 chooseFileBtn;
    private class_4185 saveBtn;
    private class_4185 cancelBtn;

    private String currentName = "Новый Режим";
    private String currentBadge = "NEW";
    private String currentIps = "127.0.0.1:25565";

    private String selectedFilePath = "";
    private String selectedFileName = "";
    private String selectedIconBase64 = "";
    private String selectedPresetIcon = "server";
    private String statusMessage = "";

    public GladeAddModeScreen(GladeNavigatorScreen parentScreen) {
        super(class_2561.method_30163("Добавление режима"));
        this.parentScreen = parentScreen;
    }

    @Override
    protected void method_25426() { // init
        super.method_25426();
        rebuildDialog();
    }

    @Override
    public void method_25410(class_310 client, int width, int height) { // resize
        super.method_25410(client, width, height);
        // Сохраняем введенный текст при изменении размеров
        if (nameField != null) currentName = nameField.method_1882();
        if (badgeField != null) currentBadge = badgeField.method_1882();
        if (ipsField != null) currentIps = ipsField.method_1882();
        rebuildDialog();
    }

    private void rebuildDialog() {
        this.method_37067(); // clearChildren

        int sw = this.field_22789;
        int sh = this.field_22790;
        int cardW = Math.max(260, Math.min(420, sw - 16));
        int cardH = Math.max(230, Math.min(310, sh - 16));
        int cardX = (sw - cardW) / 2;
        int cardY = (sh - cardH) / 2;

        int fieldX = cardX + 16;
        int fieldW = cardW - 32;

        // Поле 1: Название режима
        this.nameField = new class_342(this.field_22793, fieldX, cardY + 44, fieldW, 20, class_2561.method_30163("Название"));
        this.nameField.method_1852(currentName);
        this.method_37063(this.nameField);

        // Поле 2: Бейдж
        this.badgeField = new class_342(this.field_22793, fieldX, cardY + 86, fieldW, 20, class_2561.method_30163("Бейдж"));
        this.badgeField.method_1852(currentBadge);
        this.method_37063(this.badgeField);

        // Поле 3: Серверные IP-адреса
        this.ipsField = new class_342(this.field_22793, fieldX, cardY + 128, fieldW, 20, class_2561.method_30163("IP серверов"));
        this.ipsField.method_1852(currentIps);
        this.method_37063(this.ipsField);

        // Кнопка нативного выбора файла
        String btnText = selectedFileName.isEmpty() ? "Обзор файлов на диске (PNG/JPG)..." : "§aВыбран: " + selectedFileName;
        this.chooseFileBtn = class_4185.method_46430(class_2561.method_30163(btnText), b -> {
            this.statusMessage = "§eОткрытие диалога файлов...";
            GladeFileChooser.chooseImageFileAsync(path -> {
                class_310.method_1551().execute(() -> {
                    if (path != null && !path.isEmpty()) {
                        File f = new File(path);
                        if (f.exists() && f.isFile()) {
                            try {
                                byte[] bytes = java.nio.file.Files.readAllBytes(f.toPath());
                                String ext = path.toLowerCase().endsWith(".jpg") || path.toLowerCase().endsWith(".jpeg") ? "jpeg" : "png";
                                this.selectedIconBase64 = "data:image/" + ext + ";base64," + java.util.Base64.getEncoder().encodeToString(bytes);
                                this.selectedFilePath = path;
                                this.selectedFileName = f.getName();
                                this.statusMessage = "§aИзображение " + f.getName() + " загружено (" + (bytes.length / 1024) + " КБ)";
                                if (this.chooseFileBtn != null) {
                                    this.chooseFileBtn.method_25355(class_2561.method_30163("§a" + this.selectedFileName));
                                }
                            } catch (Exception e) {
                                this.statusMessage = "§cОшибка чтения файла: " + e.getMessage();
                            }
                        }
                    } else {
                        this.statusMessage = "§7Выбор файла отменен";
                    }
                });
            });
        }).method_46434(fieldX, cardY + 170, fieldW, 20).method_46431();
        this.method_37063(this.chooseFileBtn);

        // Пресеты иконок: [Сервер] [Меч] [Оружие] [Книга] [Замок] [Геймпад]
        String[] presets = {"server", "sword", "gun", "book", "castle", "gamepad"};
        String[] presetTitles = {"Сервер", "Меч", "Оружие", "Книга", "Замок", "Геймпад"};
        int pBtnW = (fieldW - (presets.length - 1) * 3) / presets.length;
        for (int i = 0; i < presets.length; i++) {
            final String pKey = presets[i];
            class_4185 pBtn = class_4185.method_46430(class_2561.method_30163(presetTitles[i]), b -> {
                this.selectedPresetIcon = pKey;
                this.selectedFileName = "";
                this.selectedFilePath = "";
                this.selectedIconBase64 = "";
                this.statusMessage = "§bВыбрана иконка: " + pKey;
                if (this.chooseFileBtn != null) {
                    this.chooseFileBtn.method_25355(class_2561.method_30163("Обзор файлов на диске (PNG/JPG)..."));
                }
            }).method_46434(fieldX + i * (pBtnW + 3), cardY + 196, pBtnW, 18).method_46431();
            this.method_37063(pBtn);
        }

        // Кнопки сохранения и отмены
        int btnW = (fieldW - 10) / 2;
        this.saveBtn = class_4185.method_46430(class_2561.method_30163("§a§lСохранить"), b -> {
            saveMode();
        }).method_46434(fieldX, cardY + cardH - 30, btnW, 22).method_46431();
        this.method_37063(this.saveBtn);

        this.cancelBtn = class_4185.method_46430(class_2561.method_30163("Отмена"), b -> {
            if (this.field_22787 != null) {
                this.field_22787.method_1507(this.parentScreen);
            }
        }).method_46434(fieldX + btnW + 10, cardY + cardH - 30, btnW, 22).method_46431();
        this.method_37063(this.cancelBtn);
    }

    private void saveMode() {
        String name = this.nameField.method_1882().trim();
        String badge = this.badgeField.method_1882().trim();
        String rawIps = this.ipsField.method_1882().trim();

        if (name.isEmpty()) {
            this.statusMessage = "§cВведите название режима!";
            return;
        }

        List<String> serverIps = new ArrayList<>();
        if (!rawIps.isEmpty()) {
            String[] split = rawIps.split("[,;\\s]+");
            for (String s : split) {
                if (!s.trim().isEmpty()) serverIps.add(s.trim());
            }
        }
        if (serverIps.isEmpty()) {
            serverIps.add("127.0.0.1:25565");
        }

        String icon = !selectedIconBase64.isEmpty() ? selectedIconBase64 : selectedPresetIcon;

        this.statusMessage = "§eСохранение режима...";
        this.saveBtn.field_22763 = false;

        GladeNavigatorManager.addModeAsync(name, badge, "#e67e22", "", icon, serverIps).thenAccept(success -> {
            class_310.method_1551().execute(() -> {
                if (success) {
                    if (this.field_22787 != null) {
                        this.parentScreen.reloadModes();
                        this.field_22787.method_1507(this.parentScreen);
                    }
                } else {
                    this.statusMessage = "§cОшибка сохранения (требуются права Гл. Админа)";
                    this.saveBtn.field_22763 = true;
                }
            });
        });
    }

    @Override
    public void method_25394(class_332 context, int mouseX, int mouseY, float delta) { // render
        int sw = this.field_22789;
        int sh = this.field_22790;
        int cardW = Math.max(260, Math.min(420, sw - 16));
        int cardH = Math.max(230, Math.min(310, sh - 16));
        int cardX = (sw - cardW) / 2;
        int cardY = (sh - cardH) / 2;

        RenderSystem.enableBlend();
        RenderSystem.defaultBlendFunc();

        // 1. Плотное затемнение
        context.method_25294(0, 0, sw, sh, 0xF506080C);

        // 2. Карточка модального окна
        context.method_25294(cardX, cardY, cardX + cardW, cardY + cardH, 0xFF14100D);

        // Двойная золотистая рамка Glade
        int borderCol = 0xFFE67300;
        int innerCol = 0xFFFFAC28;
        context.method_25294(cardX, cardY, cardX + cardW, cardY + 2, borderCol);
        context.method_25294(cardX, cardY + cardH - 2, cardX + cardW, cardY + cardH, borderCol);
        context.method_25294(cardX, cardY + 2, cardX + 2, cardY + cardH - 2, borderCol);
        context.method_25294(cardX + cardW - 2, cardY + 2, cardX + cardW, cardY + cardH - 2, borderCol);

        context.method_25294(cardX + 2, cardY + 2, cardX + cardW - 2, cardY + 3, innerCol);
        context.method_25294(cardX + 2, cardY + 2, cardX + 3, cardY + cardH - 2, innerCol);

        if (this.field_22793 != null) {
            // Заголовок
            context.method_51433(this.field_22793, "§6§lДОБАВИТЬ РЕЖИМ (ГЛ. АДМИН)", cardX + 16, cardY + 12, 0xFFFFCC33, true);

            // Текстовые метки
            context.method_51433(this.field_22793, "§eНазвание режима:", cardX + 16, cardY + 32, 0xFFFFFFFF, true);
            context.method_51433(this.field_22793, "§eБейдж:", cardX + 16, cardY + 74, 0xFFFFFFFF, true);
            context.method_51433(this.field_22793, "§eIP адреса серверов:", cardX + 16, cardY + 116, 0xFFFFFFFF, true);
            context.method_51433(this.field_22793, "§eИконка режима (файл или пресет):", cardX + 16, cardY + 158, 0xFFFFFFFF, true);

            // Статус
            if (!statusMessage.isEmpty()) {
                context.method_51433(this.field_22793, statusMessage, cardX + 16, cardY + 220, 0xFFFFFFFF, true);
            } else if (!selectedFileName.isEmpty()) {
                context.method_51433(this.field_22793, "§aФайл: " + selectedFileName, cardX + 16, cardY + 220, 0xFFFFFFFF, true);
            } else {
                context.method_51433(this.field_22793, "§7Выбрана иконка: §f" + selectedPresetIcon, cardX + 16, cardY + 220, 0xFFFFFFFF, true);
            }
        }

        super.method_25394(context, mouseX, mouseY, delta);
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
