package com.glade.mod.mixin;

import com.glade.mod.GladeAnimationManager;
import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.class_2561;
import net.minecraft.class_332;
import net.minecraft.class_339;
import net.minecraft.class_364;
import net.minecraft.class_412;
import net.minecraft.class_437;
import net.minecraft.class_5481;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import java.util.List;

@Mixin(class_412.class)
public abstract class ConnectScreenMixin extends class_437 {
    @Shadow @Final net.minecraft.class_2561 field_44548; // status text

    protected ConnectScreenMixin(class_2561 title) {
        super(title);
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

        // 1. Живой анимированный HD фон Glade
        context.method_25293(GladeAnimationManager.getCurrentTexture(), 0, 0, sw, sh, 0f, 0f, 1280, 720, 1280, 720);
        context.method_25294(0, 0, sw, sh, 0x66000000);

        // 2. Адаптивная карточка подключения Glade
        int cardW = Math.min(sw - 20, Math.max(180, (int) Math.round(440 * scale)));
        int cardH = Math.min(sh - 20, Math.max(110, (int) Math.round(160 * scale)));
        int cardX = (sw - cardW) / 2;

        int availableTop = (sh - cardH) / 2;
        int logoH = Math.min(availableTop - 6, (int) Math.round(180 * scale));
        int logoW = (int) Math.round(logoH * (220.0 / 205.0));
        int logoX = (sw - logoW) / 2;
        int logoY = Math.max(2, (availableTop - logoH) / 2);

        int cardY = (logoH > 24) ? Math.max(logoY + logoH + 6, (sh - cardH) / 2 + logoH / 4) : (sh - cardH) / 2;

        if (logoH > 24) {
            context.method_25293(GladeAnimationManager.LOGO, logoX, logoY, logoW, logoH, 0f, 0f, 600, 560, 600, 560);
        }

        // 3. Фон карточки: темный обсидиан
        context.method_25294(cardX, cardY, cardX + cardW, cardY + cardH, 0xF414100D);

        // Стилизованная янтарная окантовка Glade
        int borderCol = 0xFFE67300;
        int innerCol = 0xFFFFB833;
        int darkCol = 0xFF351600;

        // Внешний темный край
        context.method_25294(cardX - 1, cardY - 1, cardX + cardW + 1, cardY, darkCol);
        context.method_25294(cardX - 1, cardY + cardH, cardX + cardW + 1, cardY + cardH + 1, darkCol);
        context.method_25294(cardX - 1, cardY - 1, cardX, cardY + cardH + 1, darkCol);
        context.method_25294(cardX + cardW, cardY - 1, cardX + cardW + 1, cardY + cardH + 1, darkCol);

        // Основная янтарная рамка (2px)
        context.method_25294(cardX, cardY, cardX + cardW, cardY + 2, borderCol);
        context.method_25294(cardX, cardY + cardH - 2, cardX + cardW, cardY + cardH, borderCol);
        context.method_25294(cardX, cardY, cardX + 2, cardY + cardH, borderCol);
        context.method_25294(cardX + cardW - 2, cardY, cardX + cardW, cardY + cardH, borderCol);

        // Внутренняя акцентная полоса сверху и слева
        context.method_25294(cardX + 2, cardY + 2, cardX + cardW - 2, cardY + 3, innerCol);
        context.method_25294(cardX + 2, cardY + 2, cardX + 3, cardY + cardH - 2, innerCol);

        // Угловые золотые акцентные блоки (Minecraft RPG notch)
        int notchCol = 0xFFFFD040;
        context.method_25294(cardX + 3, cardY + 3, cardX + 7, cardY + 7, notchCol);
        context.method_25294(cardX + cardW - 7, cardY + 3, cardX + cardW - 3, cardY + 7, notchCol);
        context.method_25294(cardX + 3, cardY + cardH - 7, cardX + 7, cardY + cardH - 3, notchCol);
        context.method_25294(cardX + cardW - 7, cardY + cardH - 7, cardX + cardW - 3, cardY + cardH - 3, notchCol);

        // 4. Текстовое содержимое карточки
        if (this.field_22793 != null) {
            String title = "GLADE NETWORK";
            int tw = this.field_22793.method_1727(title);
            int titleX = (sw - tw) / 2;
            int titleY = cardY + 14;
            context.method_51433(this.field_22793, title, titleX, titleY, 0xFFFFCC33, true);

            // Декоративные разделительные линии по бокам заголовка
            int lineMargin = 20;
            int lineY = titleY + 4;
            if (titleX - 12 > cardX + lineMargin) {
                context.method_25294(cardX + lineMargin, lineY, titleX - 12, lineY + 1, 0x88FFAA22);
                context.method_25294(titleX + tw + 12, lineY, cardX + cardW - lineMargin, lineY + 1, 0x88FFAA22);
            }

            // Анимированная плавная полоса загрузки в янтарных тонах
            int barW = cardW - 40;
            int barH = 4;
            int barX = cardX + 20;
            int barY = cardY + 32;
            context.method_25294(barX, barY, barX + barW, barY + barH, 0xFF1C130D);
            context.method_25294(barX, barY - 1, barX + barW, barY, 0xFF352214);
            context.method_25294(barX, barY + barH, barX + barW, barY + barH + 1, 0xFF352214);

            long time = System.currentTimeMillis();
            int pulseW = Math.max(40, barW / 3);
            int pulsePos = (int) ((time / 4) % (barW + pulseW)) - pulseW;
            int px1 = Math.max(barX, barX + pulsePos);
            int px2 = Math.min(barX + barW, barX + pulsePos + pulseW);
            if (px2 > px1) {
                // Основное тело импульса
                context.method_25294(px1, barY, px2, barY + barH, 0xFFFF8C00);
                // Яркое ядро по центру импульса
                int coreX1 = Math.max(px1, px1 + (px2 - px1) / 4);
                int coreX2 = Math.min(px2, px2 - (px2 - px1) / 4);
                if (coreX2 > coreX1) {
                    context.method_25294(coreX1, barY, coreX2, barY + barH, 0xFFFFE066);
                }
            }

            // Текст статуса / ошибки подключения (гарантированное математическое центрирование)
            if (this.field_44548 != null) {
                List<class_5481> lines = this.field_22793.method_1728(this.field_44548, cardW - 30);
                int startY = cardY + 44;
                for (int i = 0; i < lines.size() && i < 2; i++) {
                    context.method_35719(this.field_22793, lines.get(i), sw / 2, startY + i * 11, 0xFFEDE2D0);
                }
            }
        }

        // 5. Позиционирование кнопки "Отмена" аккуратно внизу внутри карточки
        int btnW = Math.min(130, cardW - 24);
        int btnH = Math.max(18, Math.min(22, (int)(cardH * 0.16)));
        int btnX = cardX + (cardW - btnW) / 2;
        int btnY = cardY + cardH - btnH - 8;

        for (class_364 child : this.method_25396()) {
            if (child instanceof class_339 widget) {
                widget.method_46421(btnX);
                widget.method_46419(btnY);
                widget.method_25358(btnW);
                widget.method_53533(btnH);
                widget.method_25394(context, mouseX, mouseY, delta);
            }
        }

        ci.cancel();
    }
}
