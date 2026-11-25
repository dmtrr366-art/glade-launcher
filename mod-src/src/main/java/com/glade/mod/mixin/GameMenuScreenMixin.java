package com.glade.mod.mixin;

import com.glade.mod.navigator.GladeNavigatorScreen;
import net.minecraft.class_2561;
import net.minecraft.class_4185;
import net.minecraft.class_433;
import net.minecraft.class_437;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Внедрение кнопки "Путеводитель" в главное внутриигровое меню паузы (ESC).
 * Позволяет игрокам переключаться между серверами и режимами прямо из игры.
 */
@Mixin(class_433.class)
public abstract class GameMenuScreenMixin extends class_437 {

    protected GameMenuScreenMixin(class_2561 title) {
        super(title);
    }

    @Inject(method = "method_25426", at = @At("TAIL"))
    private void onInit(CallbackInfo ci) {
        int centerX = this.field_22789 / 2;
        int btnW = 204;
        int btnH = 20;
        int btnX = centerX - btnW / 2;

        // По умолчанию ищем слот ненужных кнопок отзывов Mojang ("Оставить отзыв" / "Нашли ошибку?")
        // чтобы встроить Путеводитель гармонично прямо в центр меню паузы, как на Cristalix
        int targetY = this.field_22790 / 4 + 72 - 16;
        boolean foundFeedback = false;

        for (net.minecraft.class_364 widget : this.method_25396()) {
            if (widget instanceof net.minecraft.class_339 btn) {
                String label = btn.method_25369().getString().toLowerCase();
                if (label.contains("отзыв") || label.contains("ошибку") || label.contains("feedback") || label.contains("bugs")) {
                    if (!foundFeedback) {
                        targetY = btn.method_46427();
                        foundFeedback = true;
                    }
                    btn.field_22764 = false; // visible = false
                    btn.field_22763 = false; // active = false
                    btn.method_46419(-9999);
                }
            }
        }

        if (!foundFeedback) {
            targetY = this.field_22790 / 4 + 72 - 16;
        }

        class_4185 navBtn = class_4185.method_46430(
            class_2561.method_30163("§b§lПутеводитель"),
            button -> {
                if (this.field_22787 != null) {
                    this.field_22787.method_1507(new GladeNavigatorScreen(this));
                }
            }
        ).method_46434(btnX, targetY, btnW, btnH).method_46431();

        this.method_37063(navBtn);
    }
}
