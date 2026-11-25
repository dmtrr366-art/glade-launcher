package com.glade.mod.mixin;

import com.glade.mod.GladeAnimationManager;
import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.class_332;
import net.minecraft.class_437;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(class_437.class)
public abstract class ScreenMixin {
    @Shadow public net.minecraft.class_310 field_22787;
    @Shadow public int field_22789;
    @Shadow public int field_22790;

    @Inject(method = "method_25420", at = @At("HEAD"), cancellable = true)
    private void onRenderBackground(class_332 context, int mouseX, int mouseY, float delta, CallbackInfo ci) {
        if ((Object) this instanceof com.glade.mod.navigator.GladeNavigatorScreen ||
            (Object) this instanceof com.glade.mod.navigator.GladeAddModeScreen) {
            ci.cancel();
            return;
        }

        // Если игрок в меню (мир еще не загружен), используем атмосферный живой фон Glade
        if (this.field_22787 != null && this.field_22787.field_1687 == null) {
            GladeAnimationManager.init(this.field_22787);
            int sw = this.field_22789;
            int sh = this.field_22790;

            RenderSystem.enableBlend();
            RenderSystem.defaultBlendFunc();
            context.method_25293(GladeAnimationManager.getCurrentTexture(), 0, 0, sw, sh, 0f, 0f, 1280, 720, 1280, 720);
            // Мягкое затемнение для отличной читаемости всех кнопок и настроек
            context.method_25294(0, 0, sw, sh, 0xA60E0B09);
            ci.cancel();
        }
    }

    @Inject(method = "method_57734", at = @At("HEAD"), cancellable = true)
    private void onRenderBlur(float delta, CallbackInfo ci) {
        if ((Object) this instanceof com.glade.mod.navigator.GladeNavigatorScreen ||
            (Object) this instanceof com.glade.mod.navigator.GladeAddModeScreen) {
            ci.cancel();
        }
    }

    @Inject(method = "method_57728", at = @At("HEAD"), cancellable = true)
    private void onRenderInGameBackground(class_332 context, float delta, CallbackInfo ci) {
        if ((Object) this instanceof com.glade.mod.navigator.GladeNavigatorScreen ||
            (Object) this instanceof com.glade.mod.navigator.GladeAddModeScreen) {
            ci.cancel();
        }
    }
}
