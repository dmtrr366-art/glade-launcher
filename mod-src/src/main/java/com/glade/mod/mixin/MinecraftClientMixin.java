package com.glade.mod.mixin;

import net.minecraft.class_310;
import net.minecraft.class_437;
import net.minecraft.class_442;
import net.minecraft.class_500;
import net.minecraft.class_526;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(class_310.class)
public abstract class MinecraftClientMixin {
    @Shadow
    public abstract void method_1507(class_437 screen);

    /**
     * Засекречивание версии: заголовок окна всегда "Glade Version 1.0" вместо "Minecraft* 1.21.1"
     */
    @Inject(method = "method_24287", at = @At("HEAD"), cancellable = true)
    private void onGetWindowTitle(CallbackInfoReturnable<String> cir) {
        cir.setReturnValue("Glade Version 1.0");
    }

    @Inject(method = "method_1507", at = @At("HEAD"), cancellable = true)
    private void onSetScreen(class_437 screen, CallbackInfo ci) {
        // Блокировка доступа к меню сетевой игры (список серверов) и одиночной игре:
        // Всегда возвращает игрока в главное меню Glade
        if (screen instanceof class_500 || screen instanceof class_526) {
            ci.cancel();
            this.method_1507(new class_442());
        }
    }
}
