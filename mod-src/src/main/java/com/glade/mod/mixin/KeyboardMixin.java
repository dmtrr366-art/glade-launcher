package com.glade.mod.mixin;

import com.glade.mod.staff.GladeStaffManager;
import net.minecraft.class_309;
import net.minecraft.class_310;
import net.minecraft.class_442;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(class_309.class)
public abstract class KeyboardMixin {
    private static final int KEY_K = 75; // GLFW_KEY_K
    private static final int ACTION_PRESS = 1; // GLFW_PRESS

    @Inject(method = "method_1466", at = @At("HEAD"))
    private void onKey(long window, int key, int scancode, int action, int modifiers, CallbackInfo ci) {
        if (key == KEY_K && action == ACTION_PRESS) {
            class_310 mc = class_310.method_1551();
            if (mc != null) {
                // Открывается как во время игры (field_1755 == null), так и прямо в главном меню Glade (TitleScreen)
                boolean canTrigger = (mc.field_1755 == null && mc.field_1724 != null) || (mc.field_1755 instanceof class_442);
                if (canTrigger) {
                    GladeStaffManager.openStaffOrHwidScreen(mc);
                }
            }
        }
    }
}
