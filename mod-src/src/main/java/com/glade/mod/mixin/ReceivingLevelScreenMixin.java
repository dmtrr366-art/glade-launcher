package com.glade.mod.mixin;

import com.glade.mod.GladeAnimationManager;
import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.class_2561;
import net.minecraft.class_332;
import net.minecraft.class_434;
import net.minecraft.class_437;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(class_434.class)
public abstract class ReceivingLevelScreenMixin extends class_437 {
    protected ReceivingLevelScreenMixin(class_2561 title) {
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

        // 2. Адаптивная карточка загрузки мира
        int cardW = Math.min(sw - 20, Math.max(180, (int) Math.round(440 * scale)));
        int cardH = Math.min(sh - 20, Math.max(80, (int) Math.round(110 * scale)));
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

        // 3. Фон карточки
        context.method_25294(cardX, cardY, cardX + cardW, cardY + cardH, 0xF414100D);

        // Янтарная окантовка Glade
        int borderCol = 0xFFE67300;
        int innerCol = 0xFFFFB833;
        int darkCol = 0xFF351600;

        context.method_25294(cardX - 1, cardY - 1, cardX + cardW + 1, cardY, darkCol);
        context.method_25294(cardX - 1, cardY + cardH, cardX + cardW + 1, cardY + cardH + 1, darkCol);
        context.method_25294(cardX - 1, cardY - 1, cardX, cardY + cardH + 1, darkCol);
        context.method_25294(cardX + cardW, cardY - 1, cardX + cardW + 1, cardY + cardH + 1, darkCol);

        context.method_25294(cardX, cardY, cardX + cardW, cardY + 2, borderCol);
        context.method_25294(cardX, cardY + cardH - 2, cardX + cardW, cardY + cardH, borderCol);
        context.method_25294(cardX, cardY, cardX + 2, cardY + cardH, borderCol);
        context.method_25294(cardX + cardW - 2, cardY, cardX + cardW, cardY + cardH, borderCol);

        context.method_25294(cardX + 2, cardY + 2, cardX + cardW - 2, cardY + 3, innerCol);
        context.method_25294(cardX + 2, cardY + 2, cardX + 3, cardY + cardH - 2, innerCol);

        int notchCol = 0xFFFFD040;
        context.method_25294(cardX + 3, cardY + 3, cardX + 7, cardY + 7, notchCol);
        context.method_25294(cardX + cardW - 7, cardY + 3, cardX + cardW - 3, cardY + 7, notchCol);
        context.method_25294(cardX + 3, cardY + cardH - 7, cardX + 7, cardY + cardH - 3, notchCol);
        context.method_25294(cardX + cardW - 7, cardY + cardH - 7, cardX + cardW - 3, cardY + cardH - 3, notchCol);

        if (this.field_22793 != null) {
            String title = "ВХОД В МИР GLADE";
            int tw = this.field_22793.method_1727(title);
            context.method_51433(this.field_22793, title, (sw - tw) / 2, cardY + 14, 0xFFFFCC33, true);

            String sub = "Синхронизация территории и ресурсов...";
            int swSub = this.field_22793.method_1727(sub);
            int subY = cardY + 32;
            context.method_51433(this.field_22793, sub, (sw - swSub) / 2, subY, 0xFFEDE2D0, true);

            int barW = cardW - 40;
            int barH = 4;
            int barX = cardX + 20;
            int barY = cardY + cardH - 18;
            context.method_25294(barX, barY, barX + barW, barY + barH, 0xFF241A12);

            long time = System.currentTimeMillis();
            int pulseW = barW / 3;
            int pulsePos = (int) ((time / 5) % (barW + pulseW)) - pulseW;
            int px1 = Math.max(barX, barX + pulsePos);
            int px2 = Math.min(barX + barW, barX + pulsePos + pulseW);
            if (px2 > px1) {
                context.method_25294(px1, barY, px2, barY + barH, 0xFFFF9900);
            }
        }

        ci.cancel();
    }
}
