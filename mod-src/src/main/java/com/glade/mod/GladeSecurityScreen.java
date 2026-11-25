package com.glade.mod;

import net.minecraft.class_332;
import net.minecraft.class_4185;
import net.minecraft.class_437;
import net.minecraft.class_2561;

public class GladeSecurityScreen extends class_437 {
    private final String reason;

    public GladeSecurityScreen(String reason) {
        super(class_2561.method_30163("Glade Security Guard"));
        this.reason = reason;
    }

    @Override
    protected void method_25426() {
        super.method_25426();

        int btnWidth = 200;
        int btnHeight = 24;
        int x = (this.field_22789 - btnWidth) / 2;
        int y = this.field_22790 / 2 + 50;

        // Кнопка "Закрыть игру"
        class_4185 closeBtn = class_4185.method_46430(
            class_2561.method_30163("Закрыть игру"),
            button -> {
                if (this.field_22787 != null) {
                    this.field_22787.method_1592();
                }
            }
        ).method_46434(x, y, btnWidth, btnHeight).method_46431();

        this.method_37063(closeBtn);
    }

    @Override
    public void method_25394(class_332 context, int mouseX, int mouseY, float delta) {
        // Темный фон с предупреждающим красным оттенком
        context.method_25294(0, 0, this.field_22789, this.field_22790, 0xEE110000);

        // Рамка предупреждения
        int boxW = Math.min(500, this.field_22789 - 40);
        int boxH = 180;
        int boxX = (this.field_22789 - boxW) / 2;
        int boxY = this.field_22790 / 2 - 90;

        context.method_25294(boxX, boxY, boxX + boxW, boxY + boxH, 0xF0180a08);
        context.method_49601(boxX, boxY, boxW, boxH, 0xFFFF3300);

        // Заголовки
        String title = "ВНИМАНИЕ! ДОСТУП В ИГРУ ЗАБЛОКИРОВАН";
        context.method_25294(boxX, boxY, boxX + boxW, boxY + 28, 0x88CC1100);
        
        if (this.field_22787 != null && this.field_22787.field_1772 != null) {
            int tw = this.field_22787.field_1772.method_1727(title);
            context.method_51433(this.field_22787.field_1772, title, (this.field_22789 - tw) / 2, boxY + 9, 0xFFFFFFFF, true);

            String line1 = "Система безопасности Glade обнаружила запрещенные файлы:";
            context.method_51433(this.field_22787.field_1772, line1, boxX + 16, boxY + 42, 0xFFFFCCAA, false);

            String violText = (this.reason != null && !this.reason.isEmpty()) ? this.reason : "Неизвестная модификация";
            context.method_51433(this.field_22787.field_1772, violText, boxX + 16, boxY + 62, 0xFFFF4444, false);

            String line3 = "Для входа на сервер удалите читы/запрещенные моды из папки mods.";
            context.method_51433(this.field_22787.field_1772, line3, boxX + 16, boxY + 86, 0xFFAAAAAA, false);
        }

        super.method_25394(context, mouseX, mouseY, delta);
    }
}
