package com.glade.mod.mixin;

import com.glade.mod.GladeMenuButton;
import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.class_2561;
import net.minecraft.class_310;
import net.minecraft.class_327;
import net.minecraft.class_332;
import net.minecraft.class_339;
import net.minecraft.class_4264;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(class_4264.class)
public abstract class PressableWidgetMixin extends class_339 {
    @Shadow
    public abstract void method_48589(class_332 context, class_327 textRenderer, int color);

    protected PressableWidgetMixin(int x, int y, int width, int height, class_2561 message) {
        super(x, y, width, height, message);
    }

    @Inject(method = "method_48579", at = @At("HEAD"), cancellable = true)
    private void onRenderWidget(class_332 context, int mouseX, int mouseY, float delta, CallbackInfo ci) {
        // Главные кнопки меню отрисовываются собственным рендерером GladeMenuButton
        if ((Object) this instanceof GladeMenuButton) {
            return;
        }

        int x = this.method_46426();
        int y = this.method_46427();
        int w = this.method_25368();
        int h = this.method_25364();

        boolean hovered = this.method_49606() || this.method_25367();
        boolean active = this.field_22763;

        RenderSystem.enableBlend();
        RenderSystem.defaultBlendFunc();

        // 1. Обсидиановый фон кнопки
        int bgCol = active ? (hovered ? 0xF2221B16 : 0xEE16120E) : 0x88120E0B;
        context.method_25294(x, y, x + w, y + h, bgCol);

        // 2. Стилизованная янтарная рамка в стиле Glade
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

        // Внешний контур
        context.method_25294(x, y, x + w, y + 1, borderCol);
        context.method_25294(x, y + h - 1, x + w, y + h, borderCol);
        context.method_25294(x, y + 1, x + 1, y + h - 1, borderCol);
        context.method_25294(x + w - 1, y + 1, x + w, y + h - 1, borderCol);

        // Внутренний акцент
        if (active && h > 14 && w > 14) {
            context.method_25294(x + 1, y + 1, x + w - 1, y + 2, innerCol);
            context.method_25294(x + 1, y + 1, x + 2, y + h - 1, innerCol);
        }

        // Угловые акцентные насечки в стиле Minecraft RPG
        int accentCol = active ? (hovered ? 0xFFFFDD66 : 0xFFFF9922) : 0xFF553318;
        if (w >= 16 && h >= 14) {
            context.method_25294(x + 2, y + 2, x + 4, y + 4, accentCol);
            context.method_25294(x + w - 4, y + 2, x + w - 2, y + 4, accentCol);
            context.method_25294(x + 2, y + h - 4, x + 4, y + h - 2, accentCol);
            context.method_25294(x + w - 4, y + h - 4, x + w - 2, y + h - 2, accentCol);
        }

        // 3. Текст кнопки через встроенный механизм Minecraft с гарантированным математическим центрированием,
        // автоматическим скроллингом и обрезкой по краям кнопки при любом масштабе интерфейса
        class_310 mc = class_310.method_1551();
        class_327 tr = mc.field_1772;
        if (tr != null) {
            int textCol = active ? (hovered ? 0xFFFFFFFF : 0xFFEDE2D0) : 0xFF7A6855;
            this.method_48589(context, tr, textCol);
        }

        ci.cancel();
    }
}
