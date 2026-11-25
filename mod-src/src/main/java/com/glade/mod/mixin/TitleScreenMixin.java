package com.glade.mod.mixin;

import com.glade.mod.GladeAnimationManager;
import com.glade.mod.GladeConfig;
import com.glade.mod.GladeMenuButton;
import com.glade.mod.GladeSecurityScanner;
import com.glade.mod.GladeSecurityScreen;
import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.class_2561;
import net.minecraft.class_2960;
import net.minecraft.class_310;
import net.minecraft.class_332;
import net.minecraft.class_412;
import net.minecraft.class_429;
import net.minecraft.class_437;
import net.minecraft.class_442;
import net.minecraft.class_639;
import net.minecraft.class_642;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(class_442.class)
public abstract class TitleScreenMixin extends class_437 {
    private GladeMenuButton settingsBtn;
    private GladeMenuButton playBtn;
    private GladeMenuButton quitBtn;

    protected TitleScreenMixin(class_2561 title) {
        super(title);
    }

    @Inject(method = "method_25426", at = @At("TAIL"))
    private void onInit(CallbackInfo ci) {
        GladeAnimationManager.init(this.field_22787);
        rebuildGladeMenu();
    }

    private void rebuildGladeMenu() {
        // Удаляем все стандартные кнопки Minecraft
        this.method_37067();

        int sw = this.field_22789;
        int sh = this.field_22790;

        // Полноэкранный адаптивный масштаб (без принудительного ограничения)
        double scale = Math.min((double) sw / 800.0, (double) sh / 460.0);
        scale = Math.max(0.20, Math.min(1.0, scale));

        // 1. Адаптивный логотип Glade: занимает до 36% высоты экрана
        int maxLogoH = (int) (sh * 0.36);
        int logoH = Math.max(35, Math.min(maxLogoH, (int) Math.round(210 * scale)));
        int logoW = (int) Math.round(logoH * (260.0 / 240.0));
        int logoX = (sw - logoW) / 2;
        int logoY = Math.max(4, (int) (10 * scale));

        // 2. Адаптивные 3 кнопки: Настройки, Играть, Выход
        int topForButtons = logoY + logoH + Math.max(4, (int) (8 * scale));
        int availableH = sh - topForButtons - 14;

        int btnH = Math.max(26, Math.min((int)(availableH * 0.85), (int) Math.round(140 * scale)));
        int playH = Math.min(availableH, (int) Math.round(btnH * 1.12));

        int sideW = (int) Math.round(btnH * (135.0 / 160.0));
        int playW = (int) Math.round(playH * (160.0 / 185.0));
        int gap = Math.max(4, Math.min(16, (int) (12 * scale)));

        // Проверяем, чтобы кнопки по ширине гарантированно влезали в окно
        int maxTotalW = sw - 16;
        int totalW = sideW * 2 + playW + gap * 2;
        if (totalW > maxTotalW) {
            double shrink = (double) maxTotalW / totalW;
            sideW = Math.max(20, (int) (sideW * shrink));
            playW = Math.max(24, (int) (playW * shrink));
            btnH = Math.max(22, (int) (btnH * shrink));
            playH = Math.max(24, (int) (playH * shrink));
            gap = Math.max(2, (int) (gap * shrink));
            totalW = sideW * 2 + playW + gap * 2;
        }

        int startX = (sw - totalW) / 2;
        int settingsX = startX;
        int playX = startX + sideW + gap;
        int quitX = playX + playW + gap;

        // Центрируем группу кнопок по вертикали в оставшемся пространстве
        int buttonsY = topForButtons + Math.max(0, (availableH - btnH) / 2);
        int playY = buttonsY - (playH - btnH) / 2;

        this.settingsBtn = new GladeMenuButton(
            settingsX, buttonsY, sideW, btnH,
            GladeAnimationManager.BTN_SETTINGS, GladeAnimationManager.BTN_SETTINGS_HOVER,
            330, 390,
            button -> {
                if (this.field_22787 != null) {
                    this.field_22787.method_1507(new class_429(this, this.field_22787.field_1690));
                }
            }
        );

        this.playBtn = new GladeMenuButton(
            playX, playY, playW, playH,
            GladeAnimationManager.BTN_PLAY, GladeAnimationManager.BTN_PLAY_HOVER,
            390, 450,
            button -> {
                if (!GladeSecurityScanner.scan()) {
                    if (this.field_22787 != null) {
                        this.field_22787.method_1507(new GladeSecurityScreen(GladeSecurityScanner.getViolation()));
                    }
                    return;
                }

                String ip = GladeConfig.get().serverAddress;
                String name = GladeConfig.get().serverName;
                if (this.field_22787 != null) {
                    try {
                        class_639 address = class_639.method_2950(ip);
                        class_642 info = new class_642(name, ip, class_642.class_8678.field_45611);
                        class_412.method_36877(this, this.field_22787, address, info, false, null);
                    } catch (Throwable t) {
                        System.err.println("[Glade] Error connecting: " + t.getMessage());
                    }
                }
            }
        );

        this.quitBtn = new GladeMenuButton(
            quitX, buttonsY, sideW, btnH,
            GladeAnimationManager.BTN_QUIT, GladeAnimationManager.BTN_QUIT_HOVER,
            340, 390,
            button -> {
                if (this.field_22787 != null) {
                    this.field_22787.method_1592();
                }
            }
        );

        this.method_37063(this.settingsBtn);
        this.method_37063(this.playBtn);
        this.method_37063(this.quitBtn);

        // Кнопка модерации в правом верхнем углу (видна только персоналу Glade)
        com.glade.mod.staff.GladeStaffManager.checkStaff(staff -> {
            if (staff != null && staff.isStaff) {
                int staffBtnW = Math.min(115, sw / 4);
                int staffBtnH = 20;
                net.minecraft.class_4185 staffBtn = net.minecraft.class_4185.method_46430(
                    class_2561.method_30163("Модерация [K]"),
                    b -> {
                        class_310 mc = class_310.method_1551();
                        if (mc != null) {
                            com.glade.mod.staff.GladeStaffManager.openStaffOrHwidScreen(mc);
                        }
                    }
                ).method_46434(sw - staffBtnW - 8, 8, staffBtnW, staffBtnH).method_46431();
                this.method_37063(staffBtn);
            }
        });
    }

    @Inject(method = "method_25394", at = @At("HEAD"), cancellable = true)
    private void onRender(class_332 context, int mouseX, int mouseY, float delta, CallbackInfo ci) {
        GladeAnimationManager.init(this.field_22787);

        int sw = this.field_22789;
        int sh = this.field_22790;

        double scale = Math.min((double) sw / 800.0, (double) sh / 460.0);
        scale = Math.max(0.20, Math.min(1.0, scale));

        RenderSystem.enableBlend();
        RenderSystem.defaultBlendFunc();

        // 1. Отрисовка живого анимированного фона Glade
        class_2960 bgTexture = GladeAnimationManager.getCurrentTexture();
        context.method_25293(bgTexture, 0, 0, sw, sh, 0f, 0f, 1280, 720, 1280, 720);

        // 2. Отрисовка логотипа Glade
        int maxLogoH = (int) (sh * 0.36);
        int logoH = Math.max(35, Math.min(maxLogoH, (int) Math.round(210 * scale)));
        int logoW = (int) Math.round(logoH * (260.0 / 240.0));
        int logoX = (sw - logoW) / 2;
        int logoY = Math.max(4, (int) (10 * scale));
        context.method_25293(GladeAnimationManager.LOGO, logoX, logoY, logoW, logoH, 0f, 0f, 600, 560, 600, 560);

        // 3. Отрисовка кнопок меню Glade
        if (this.settingsBtn != null) {
            this.settingsBtn.method_25394(context, mouseX, mouseY, delta);
        }
        if (this.playBtn != null) {
            this.playBtn.method_25394(context, mouseX, mouseY, delta);
        }
        if (this.quitBtn != null) {
            this.quitBtn.method_25394(context, mouseX, mouseY, delta);
        }

        // Отрисовка дополнительных виджетов (например, кнопки модерации)
        for (net.minecraft.class_364 child : this.method_25396()) {
            if (child instanceof net.minecraft.class_339 widget && !(widget instanceof GladeMenuButton)) {
                widget.method_25394(context, mouseX, mouseY, delta);
            }
        }

        // 4. Аккуратный номер версии в нижнем левом углу
        if (this.field_22793 != null) {
            context.method_51433(this.field_22793, "Version 1.0", 8, sh - 14, 0xCCFFAA00, true);
        }

        ci.cancel();
    }
}
