package com.glade.mod.mixin;

import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.class_2561;
import net.minecraft.class_310;
import net.minecraft.class_327;
import net.minecraft.class_332;
import net.minecraft.class_339;
import net.minecraft.class_357;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(class_357.class)
public abstract class SliderWidgetMixin extends class_339 {
    @Shadow
    protected double field_22753; // slider value [0.0, 1.0]

    protected SliderWidgetMixin(int x, int y, int width, int height, class_2561 message) {
        super(x, y, width, height, message);
    }

    @Inject(method = "method_48579", at = @At("HEAD"), cancellable = true)
    private void onRenderWidget(class_332 context, int mouseX, int mouseY, float delta, CallbackInfo ci) {
        int x = this.method_46426();
        int y = this.method_46427();
        int w = this.method_25368();
        int h = this.method_25364();

        boolean hovered = this.method_49606() || this.method_25367();
        boolean active = this.field_22763;

        RenderSystem.enableBlend();
        RenderSystem.defaultBlendFunc();

        // 1. Обсидиановый фон трека слайдера
        int bgCol = active ? (hovered ? 0xF2221B16 : 0xEE16120E) : 0x88120E0B;
        context.method_25294(x, y, x + w, y + h, bgCol);

        // 2. Рамка слайдера
        int borderCol;
        int innerCol;
        if (!active) {
            borderCol = 0xFF452C18;
            innerCol = 0xFF2E1C0F;
        } else if (hovered) {
            borderCol = 0xFFFFAC28;
            innerCol = 0xFFFFD266;
        } else {
            borderCol = 0xFFD86E0C;
            innerCol = 0xFFA04808;
        }

        context.method_25294(x, y, x + w, y + 1, borderCol);
        context.method_25294(x, y + h - 1, x + w, y + h, borderCol);
        context.method_25294(x, y + 1, x + 1, y + h - 1, borderCol);
        context.method_25294(x + w - 1, y + 1, x + w, y + h - 1, borderCol);

        // 3. Ползунок (Thumb handle) слайдера в стиле Glade
        int thumbW = 8;
        int thumbX = x + (int) (this.field_22753 * (double) (w - thumbW));
        int thumbY = y;
        int thumbH = h;

        int thumbBg = active ? (hovered ? 0xFFFFB833 : 0xFFE67300) : 0xFF664422;
        int thumbHighlight = active ? (hovered ? 0xFFFFE599 : 0xFFFFD266) : 0xFF885533;

        context.method_25294(thumbX, thumbY + 1, thumbX + thumbW, thumbY + thumbH - 1, thumbBg);
        context.method_25294(thumbX + 1, thumbY + 2, thumbX + 3, thumbY + thumbH - 2, thumbHighlight);

        // 4. Текст слайдера с автоматическим центрированием Minecraft
        class_310 mc = class_310.method_1551();
        class_327 tr = mc.field_1772;
        if (tr != null) {
            int textCol = active ? (hovered ? 0xFFFFFFFF : 0xFFEDE2D0) : 0xFF7A6855;
            this.method_49604(context, tr, 2, textCol);
        }

        ci.cancel();
    }
}
