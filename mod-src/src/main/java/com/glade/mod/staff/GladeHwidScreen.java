package com.glade.mod.staff;

import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.class_2561;
import net.minecraft.class_310;
import net.minecraft.class_332;
import net.minecraft.class_4185;
import net.minecraft.class_437;

import java.awt.Toolkit;
import java.awt.datatransfer.StringSelection;

/**
 * Окно подтверждения и привязки аппаратного серийного номера ПК (HWID).
 * Отображается, если компьютер модератора еще не одобрен главным администратором.
 */
public class GladeHwidScreen extends class_437 {
    private final GladeStaffManager.StaffData staff;
    private String copyButtonText = "СКОПИРОВАТЬ СЕРИЙНЫЙ НОМЕР ПК";
    private boolean isCopied = false;

    public GladeHwidScreen(GladeStaffManager.StaffData staff) {
        super(class_2561.method_30163("Glade Hardware Verification"));
        this.staff = staff;
    }

    @Override
    protected void method_25426() { // init
        super.method_25426();

        int sw = this.field_22789;
        int sh = this.field_22790;
        int cardW = Math.min(480, sw - 40);
        int cardH = Math.min(270, sh - 40);
        int cardX = (sw - cardW) / 2;
        int cardY = (sh - cardH) / 2;

        // 1. Кнопка копирования серийного номера
        class_4185 copyBtn = class_4185.method_46430(class_2561.method_30163(this.copyButtonText), b -> {
            copyHwidToClipboard();
            this.isCopied = true;
            this.copyButtonText = "СКОПИРОВАНО В БУФЕР ОБМЕНА!";
            b.method_25355(class_2561.method_30163(this.copyButtonText));
        }).method_46434(cardX + 24, cardY + 115, cardW - 48, 24).method_46431();
        this.method_37063(copyBtn);

        // 2. Кнопка "Проверить доступ"
        class_4185 checkBtn = class_4185.method_46430(class_2561.method_30163("ПРОВЕРИТЬ ДОСТУП"), b -> {
            GladeStaffManager.invalidateCache();
            class_310 mc = class_310.method_1551();
            if (mc != null) {
                GladeStaffManager.openStaffOrHwidScreen(mc);
            }
        }).method_46434(cardX + 24, cardY + cardH - 38, cardW / 2 - 30, 24).method_46431();
        this.method_37063(checkBtn);

        // 3. Кнопка "Закрыть"
        class_4185 closeBtn = class_4185.method_46430(class_2561.method_30163("ЗАКРЫТЬ"), b -> {
            if (this.field_22787 != null) {
                this.field_22787.method_1507(null);
            }
        }).method_46434(cardX + cardW / 2 + 6, cardY + cardH - 38, cardW / 2 - 30, 24).method_46431();
        this.method_37063(closeBtn);
    }

    private void copyHwidToClipboard() {
        String hwid = staff.clientHwid;
        if (hwid == null || hwid.isEmpty()) {
            hwid = GladeHardwareId.getHardwareSerial();
        }
        try {
            class_310 mc = class_310.method_1551();
            if (mc != null && mc.field_1774 != null) {
                mc.field_1774.method_1455(hwid);
            }
            // Дублируем через системный буфер Java AWT
            StringSelection selection = new StringSelection(hwid);
            Toolkit.getDefaultToolkit().getSystemClipboard().setContents(selection, selection);
        } catch (Throwable t) {
            System.err.println("[Glade HWID] Ошибка копирования в буфер: " + t.getMessage());
        }
    }

    @Override
    public void method_25394(class_332 context, int mouseX, int mouseY, float delta) { // render
        int sw = this.field_22789;
        int sh = this.field_22790;
        int cardW = Math.min(480, sw - 40);
        int cardH = Math.min(270, sh - 40);
        int cardX = (sw - cardW) / 2;
        int cardY = (sh - cardH) / 2;

        RenderSystem.enableBlend();
        RenderSystem.defaultBlendFunc();

        // Затемнение
        context.method_25294(0, 0, sw, sh, 0xAA000000);

        // Карточка: темный обсидиан
        context.method_25294(cardX, cardY, cardX + cardW, cardY + cardH, 0xF814100D);

        // Янтарная окантовка Glade
        int borderCol = 0xFFE67300;
        int innerCol = 0xFFFFB833;
        context.method_25294(cardX, cardY, cardX + cardW, cardY + 2, borderCol);
        context.method_25294(cardX, cardY + cardH - 2, cardX + cardW, cardY + cardH, borderCol);
        context.method_25294(cardX, cardY, cardX + 2, cardY + cardH, borderCol);
        context.method_25294(cardX + cardW - 2, cardY, cardX + cardW, cardY + cardH, borderCol);

        context.method_25294(cardX + 2, cardY + 2, cardX + cardW - 2, cardY + 3, innerCol);
        context.method_25294(cardX + 2, cardY + 2, cardX + 3, cardY + cardH - 2, innerCol);

        if (this.field_22793 != null) {
            // Заголовок
            String title = "ПРИВЯЗКА УСТРОЙСТВА ПЕРСОНАЛА";
            context.method_51433(this.field_22793, title, cardX + 24, cardY + 16, 0xFFFFCC33, true);

            String roleTag = "[" + staff.title.toUpperCase() + "] " + staff.username;
            int rtw = this.field_22793.method_1727(roleTag);
            context.method_51433(this.field_22793, roleTag, cardX + cardW - rtw - 24, cardY + 16, 0xFFFFB833, true);

            // Разделитель
            context.method_25294(cardX + 24, cardY + 32, cardX + cardW - 24, cardY + 33, 0xFF452C18);

            // Статус
            boolean isMismatch = "MISMATCH".equals(staff.hwidStatus);
            String statusText = isMismatch 
                ? "ВНИМАНИЕ: ДРУГОЙ КОМПЬЮТЕР! ДОСТУП ЗАБЛОКИРОВАН"
                : "ТРЕБУЕТСЯ ПОДТВЕРЖДЕНИЕ ГЛАВНЫМ АДМИНИСТРАТОРОМ";
            int statusCol = isMismatch ? 0xFFFF4444 : 0xFFFFB833;
            context.method_51433(this.field_22793, statusText, cardX + 24, cardY + 42, statusCol, true);

            String sub = "Серийный номер вашего ПК (HWID):";
            context.method_51433(this.field_22793, sub, cardX + 24, cardY + 62, 0xFFCCC0B0, true);

            // Плашка с серийным номером
            int hwidBoxY = cardY + 76;
            context.method_25294(cardX + 24, hwidBoxY, cardX + cardW - 24, hwidBoxY + 28, 0xFF22170F);
            context.method_25294(cardX + 24, hwidBoxY, cardX + cardW - 24, hwidBoxY + 1, 0xFF553311);
            context.method_25294(cardX + 24, hwidBoxY + 27, cardX + cardW - 24, hwidBoxY + 28, 0xFF553311);

            String hwid = staff.clientHwid;
            if (hwid == null || hwid.isEmpty()) {
                hwid = GladeHardwareId.getHardwareSerial();
            }
            int hwidW = this.field_22793.method_1727(hwid);
            context.method_51433(this.field_22793, hwid, cardX + (cardW - hwidW) / 2, hwidBoxY + 10, 0xFFFFAA00, true);

            // Инструкции
            String ins1 = "1. Скопируйте серийный номер вашего ПК по кнопке ниже.";
            String ins2 = "2. Отправьте его Главному Администратору для активации.";
            String ins3 = "3. После добавления нажмите «Проверить доступ».";

            context.method_51433(this.field_22793, ins1, cardX + 24, cardY + 150, 0xFF998877, false);
            context.method_51433(this.field_22793, ins2, cardX + 24, cardY + 164, 0xFF998877, false);
            context.method_51433(this.field_22793, ins3, cardX + 24, cardY + 178, 0xFF998877, false);
        }

        super.method_25394(context, mouseX, mouseY, delta);
    }
}
