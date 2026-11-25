package com.glade.mod.mixin;

import com.glade.mod.GladeSkinManager;
import com.mojang.authlib.GameProfile;
import net.minecraft.class_640;
import net.minecraft.class_8685;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(class_640.class)
public abstract class PlayerListEntryMixin {
    @Shadow
    @Final
    private GameProfile field_3741;

    @Inject(method = "method_52810", at = @At("RETURN"), cancellable = true)
    private void onGetSkinTextures(CallbackInfoReturnable<class_8685> cir) {
        if (this.field_3741 != null && this.field_3741.getName() != null) {
            class_8685 custom = GladeSkinManager.getTextures(this.field_3741.getName(), cir.getReturnValue());
            if (custom != null) {
                cir.setReturnValue(custom);
            }
        }
    }
}
