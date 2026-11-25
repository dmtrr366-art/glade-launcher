package com.glade.mod.mixin;

import com.glade.mod.GladeSkinManager;
import com.mojang.authlib.GameProfile;
import net.minecraft.class_1657;
import net.minecraft.class_1937;
import net.minecraft.class_2338;
import net.minecraft.class_742;
import net.minecraft.class_8685;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(class_742.class)
public abstract class AbstractClientPlayerEntityMixin extends class_1657 {
    public AbstractClientPlayerEntityMixin(class_1937 world, class_2338 pos, float yaw, GameProfile gameProfile) {
        super(world, pos, yaw, gameProfile);
    }

    @Inject(method = "method_52814", at = @At("RETURN"), cancellable = true)
    private void onGetSkinTextures(CallbackInfoReturnable<class_8685> cir) {
        GameProfile profile = this.method_7334();
        if (profile != null && profile.getName() != null) {
            class_8685 custom = GladeSkinManager.getTextures(profile.getName(), cir.getReturnValue());
            if (custom != null) {
                cir.setReturnValue(custom);
            }
        }
    }
}
