package com.glade.mod.staff;

import com.glade.mod.GladeAnimationManager;
import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.class_2561;
import net.minecraft.class_310;
import net.minecraft.class_332;
import net.minecraft.class_342;
import net.minecraft.class_4185;
import net.minecraft.class_437;
import net.minecraft.class_640;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Фирменный графический интерфейс выдачи и снятия наказаний Glade (CMI).
 * Снятие наказаний доступно строго со звания Модератор и выше.
 */
public class GladePunishScreen extends class_437 {
    private final GladeStaffManager.StaffData staff;
    private final List<GladePunishRule> rules;

    // 0 = Выдача наказания, 1 = Снятие наказания
    private int currentTab = 0;

    private List<String> onlinePlayers = new ArrayList<>();
    private List<String> filteredPlayers = new ArrayList<>();
    private String selectedPlayer = "";

    // Режим выдачи
    private int selectedRuleIndex = 0;
    private int selectedStageIndex = 0;
    private int ruleScrollOffset = 0;
    private final int MAX_VISIBLE_RULES = 8;

    // Режим снятия (только Модератор+)
    public enum UnpunishType {
        UNMUTE("Размутить", "cmi unmute", "Снятие мута"),
        UNBAN("Разбанить", "cmi unban", "Снятие бана"),
        UNWARN("Снять варн", "cmi unwarn", "Снятие варна"),
        CLEARWARNS("Очистить варны", "cmi clearwarns", "Очистка всех варнов");

        public final String title;
        public final String commandPrefix;
        public final String logAction;

        UnpunishType(String title, String commandPrefix, String logAction) {
            this.title = title;
            this.commandPrefix = commandPrefix;
            this.logAction = logAction;
        }
    }

    private int selectedUnpunishIndex = 0;
    private final UnpunishType[] unpunishTypes = UnpunishType.values();

    private class_342 playerSearchField;
    private class_342 commentField;
    private class_4185 executeBtn;

    private int playerScrollOffset = 0;
    private final int MAX_VISIBLE_PLAYERS = 6;

    public GladePunishScreen(GladeStaffManager.StaffData staff) {
        super(class_2561.method_30163("Glade Punish System"));
        this.staff = staff;
        this.rules = GladePunishRule.getDefaultRules();
    }

    @Override
    protected void method_25426() { // init
        super.method_25426();

        // 1. Сбор списка игроков онлайн с сервера
        this.onlinePlayers.clear();
        class_310 mc = class_310.method_1551();
        if (mc != null && mc.method_1562() != null) {
            Collection<class_640> entries = mc.method_1562().method_2880();
            if (entries != null) {
                for (class_640 e : entries) {
                    if (e != null && e.method_2966() != null && e.method_2966().getName() != null) {
                        String name = e.method_2966().getName();
                        if (!name.isEmpty() && !this.onlinePlayers.contains(name)) {
                            this.onlinePlayers.add(name);
                        }
                    }
                }
            }
        }
        if (this.onlinePlayers.isEmpty()) {
            this.onlinePlayers.add("TestPlayer1");
            this.onlinePlayers.add("TestPlayer2");
        }
        this.filteredPlayers = new ArrayList<>(this.onlinePlayers);
        if (!filteredPlayers.isEmpty() && selectedPlayer.isEmpty()) {
            selectedPlayer = filteredPlayers.get(0);
        }

        rebuildUi();
    }

    private void rebuildUi() {
        this.method_37067(); // clearChildren

        int sw = this.field_22789;
        int sh = this.field_22790;
        int cardW = Math.min(640, sw - 20);
        int cardH = Math.min(380, sh - 20);
        int cardX = (sw - cardW) / 2;
        int cardY = (sh - cardH) / 2;

        // Вкладки переключения режимов (Выдача / Снятие)
        int tabBtnW = 75;
        int tabBtnH = 18;
        int tabX = cardX + 172;
        int tabY = cardY + 11;

        class_4185 tabIssueBtn = class_4185.method_46430(class_2561.method_30163(currentTab == 0 ? "[ Выдача ]" : "Выдача"), b -> {
            this.currentTab = 0;
            rebuildUi();
        }).method_46434(tabX, tabY, tabBtnW, tabBtnH).method_46431();
        this.method_37063(tabIssueBtn);

        boolean canRevoke = (staff.level >= 4); // Только от Модератора (level 4+)
        String revokeLabel = canRevoke ? (currentTab == 1 ? "[ Снятие ]" : "Снятие") : "Снятие [Мод+]";

        class_4185 tabRevokeBtn = class_4185.method_46430(class_2561.method_30163(revokeLabel), b -> {
            if (canRevoke) {
                this.currentTab = 1;
                rebuildUi();
            }
        }).method_46434(tabX + tabBtnW + 6, tabY, tabBtnW + (canRevoke ? 0 : 25), tabBtnH).method_46431();
        tabRevokeBtn.field_22763 = canRevoke; // Неактивна для стажеров и хелперов
        this.method_37063(tabRevokeBtn);

        // Поле поиска игрока (слева)
        int pColX = cardX + 16;
        int pColW = 145;
        this.playerSearchField = new class_342(this.field_22793, pColX, cardY + 44, pColW, 18, class_2561.method_30163("Поиск..."));
        this.playerSearchField.method_1863(text -> {
            String query = text.toLowerCase().trim();
            this.filteredPlayers = new ArrayList<>();
            for (String p : onlinePlayers) {
                if (p.toLowerCase().contains(query)) {
                    this.filteredPlayers.add(p);
                }
            }
            this.playerScrollOffset = 0;
            if (!filteredPlayers.isEmpty()) {
                selectedPlayer = filteredPlayers.get(0);
            } else if (!text.trim().isEmpty()) {
                selectedPlayer = text.trim();
            }
            if (currentTab == 0) {
                updateStageButtons();
            }
        });
        this.method_37063(this.playerSearchField);

        int mColX = cardX + 172;
        int mColW = cardW - 172 - 212;
        int rColX = cardX + cardW - 200;
        int rColW = 184;

        if (currentTab == 0) {
            // === РЕЖИМ 1: ВЫДАЧА НАКАЗАНИЯ ===
            int ruleY = cardY + 44;
            for (int i = 0; i < MAX_VISIBLE_RULES; i++) {
                final int ruleIdx = i + ruleScrollOffset;
                if (ruleIdx < rules.size()) {
                    GladePunishRule r = rules.get(ruleIdx);
                    boolean isSelected = (selectedRuleIndex == ruleIdx);
                    String title = (isSelected ? "> " : "") + r.name;

                    class_4185 btn = class_4185.method_46430(class_2561.method_30163(title), b -> {
                        this.selectedRuleIndex = ruleIdx;
                        this.selectedStageIndex = 0;
                        rebuildUi();
                    }).method_46434(mColX, ruleY + i * 23, mColW, 20).method_46431();

                    this.method_37063(btn);
                }
            }

            if (ruleScrollOffset > 0) {
                class_4185 upBtn = class_4185.method_46430(class_2561.method_30163("▲"), b -> {
                    ruleScrollOffset = Math.max(0, ruleScrollOffset - 1);
                    rebuildUi();
                }).method_46434(mColX + mColW - 20, cardY + 28, 20, 14).method_46431();
                this.method_37063(upBtn);
            }

            if (ruleScrollOffset + MAX_VISIBLE_RULES < rules.size()) {
                class_4185 downBtn = class_4185.method_46430(class_2561.method_30163("▼"), b -> {
                    ruleScrollOffset = Math.min(rules.size() - MAX_VISIBLE_RULES, ruleScrollOffset + 1);
                    rebuildUi();
                }).method_46434(mColX + mColW - 20, ruleY + MAX_VISIBLE_RULES * 23 + 1, 20, 14).method_46431();
                this.method_37063(downBtn);
            }

            // Поле комментария / доказательства
            this.commentField = new class_342(this.field_22793, rColX, cardY + 160, rColW, 18, class_2561.method_30163("Доказательства..."));
            this.method_37063(this.commentField);

            updateStageButtons();

            this.executeBtn = class_4185.method_46430(class_2561.method_30163("ВЫДАТЬ НАКАЗАНИЕ"), b -> {
                executePunishment();
            }).method_46434(cardX + cardW - 190, cardY + cardH - 34, 174, 22).method_46431();
            this.method_37063(this.executeBtn);

        } else {
            // === РЕЖИМ 2: СНЯТИЕ НАКАЗАНИЯ (ТОЛЬКО МОДЕРАТОР+) ===
            int actionY = cardY + 44;
            for (int i = 0; i < unpunishTypes.length; i++) {
                final int idx = i;
                UnpunishType type = unpunishTypes[i];
                boolean isSelected = (selectedUnpunishIndex == idx);
                String title = (isSelected ? "> " : "") + type.title + " (/" + type.commandPrefix + ")";

                class_4185 btn = class_4185.method_46430(class_2561.method_30163(title), b -> {
                    this.selectedUnpunishIndex = idx;
                    rebuildUi();
                }).method_46434(mColX, actionY + i * 28, mColW, 24).method_46431();

                this.method_37063(btn);
            }

            // Шаблоны причин снятия (справа)
            String[] templates = {"Ошибочная выдача", "Амнистия / Разбан", "Принятое обжалование", "Замена наказания"};
            for (int t = 0; t < templates.length; t++) {
                final String tpl = templates[t];
                class_4185 tBtn = class_4185.method_46430(class_2561.method_30163(tpl), b -> {
                    if (this.commentField != null) {
                        this.commentField.method_1852(tpl);
                    }
                }).method_46434(rColX, cardY + 44 + t * 24, rColW, 20).method_46431();
                this.method_37063(tBtn);
            }

            // Поле ввода причины снятия
            this.commentField = new class_342(this.field_22793, rColX, cardY + 160, rColW, 18, class_2561.method_30163("Причина снятия..."));
            this.method_37063(this.commentField);

            this.executeBtn = class_4185.method_46430(class_2561.method_30163("СНЯТЬ НАКАЗАНИЕ"), b -> {
                executeUnpunish();
            }).method_46434(cardX + cardW - 190, cardY + cardH - 34, 174, 22).method_46431();
            this.method_37063(this.executeBtn);
        }

        // Кнопка закрытия окна
        class_4185 closeBtn = class_4185.method_46430(class_2561.method_30163("ЗАКРЫТЬ"), b -> {
            if (this.field_22787 != null) {
                this.field_22787.method_1507(null);
            }
        }).method_46434(cardX + 16, cardY + cardH - 34, 90, 22).method_46431();
        this.method_37063(closeBtn);
    }

    private void updateStageButtons() {
        int sw = this.field_22789;
        int sh = this.field_22790;
        int cardW = Math.min(640, sw - 20);
        int cardH = Math.min(380, sh - 20);
        int cardX = (sw - cardW) / 2;
        int cardY = (sh - cardH) / 2;
        int rColX = cardX + cardW - 200;
        int rColW = 184;

        if (selectedRuleIndex >= 0 && selectedRuleIndex < rules.size()) {
            GladePunishRule r = rules.get(selectedRuleIndex);
            for (int s = 0; s < r.stages.size() && s < 4; s++) {
                final int stageIdx = s;
                GladePunishRule.Stage stage = r.stages.get(s);
                boolean allowed = (staff.level >= stage.minLevel);
                boolean isSelected = (selectedStageIndex == stageIdx);

                String label = "Ст." + stage.number + ": " + stage.durationDisplay;
                if (!allowed) {
                    label = "Ст." + stage.number + " [" + stage.minRankTitle + "+]";
                } else if (isSelected) {
                    label = "[x] " + label;
                }

                class_4185 stageBtn = class_4185.method_46430(class_2561.method_30163(label), b -> {
                    this.selectedStageIndex = stageIdx;
                    rebuildUi();
                }).method_46434(rColX, cardY + 44 + s * 23, rColW, 20).method_46431();

                stageBtn.field_22763 = allowed;
                this.method_37063(stageBtn);
            }
        }
    }

    private void executePunishment() {
        if (selectedPlayer.isEmpty()) return;
        if (selectedRuleIndex < 0 || selectedRuleIndex >= rules.size()) return;
        GladePunishRule rule = rules.get(selectedRuleIndex);
        if (selectedStageIndex < 0 || selectedStageIndex >= rule.stages.size()) return;
        GladePunishRule.Stage stage = rule.stages.get(selectedStageIndex);

        if (staff.level < stage.minLevel) {
            class_310 mc = class_310.method_1551();
            if (mc != null && mc.field_1724 != null) {
                mc.field_1724.method_43496(class_2561.method_30163("§c[Glade] Ваш ранг (" + staff.title + ") не позволяет выдать эту стадию! Требуется: " + stage.minRankTitle));
            }
            return;
        }

        String comment = (commentField != null) ? commentField.method_1882() : "";
        String command = rule.buildCmiCommand(selectedPlayer, selectedStageIndex, comment);

        class_310 mc = class_310.method_1551();
        if (mc != null) {
            boolean onServer = (mc.method_1562() != null && mc.field_1724 != null);

            if (onServer && mc.method_1562() != null) {
                mc.method_1562().method_45731(command);
            }

            GladeStaffManager.logPunishment(selectedPlayer, stage.action.title, rule.name, stage.number, stage.durationDisplay, comment);

            if (onServer && mc.field_1724 != null) {
                mc.field_1724.method_43496(class_2561.method_30163("§6[Glade Staff] §aКоманда наказания для §e" + selectedPlayer + "§a отправлена:"));
                mc.field_1724.method_43496(class_2561.method_30163("§7/" + command));
            }

            mc.method_1507(null);
        }
    }

    private void executeUnpunish() {
        if (selectedPlayer.isEmpty()) return;

        // Строгая проверка: снимать наказание разрешено только Модератору и выше (level >= 4)
        if (staff.level < 4) {
            class_310 mc = class_310.method_1551();
            if (mc != null && mc.field_1724 != null) {
                mc.field_1724.method_43496(class_2561.method_30163("§c[Glade] Снятие наказаний доступно только со звания Модератор и выше!"));
            }
            return;
        }

        UnpunishType type = unpunishTypes[selectedUnpunishIndex];
        String comment = (commentField != null) ? commentField.method_1882().trim() : "";
        String command = type.commandPrefix + " " + selectedPlayer + (comment.isEmpty() ? "" : " " + comment);

        class_310 mc = class_310.method_1551();
        if (mc != null) {
            boolean onServer = (mc.method_1562() != null && mc.field_1724 != null);

            if (onServer && mc.method_1562() != null) {
                mc.method_1562().method_45731(command);
            }

            GladeStaffManager.logPunishment(selectedPlayer, type.logAction, "Снятие наказания", 0, "0", comment);

            if (onServer && mc.field_1724 != null) {
                mc.field_1724.method_43496(class_2561.method_30163("§6[Glade Staff] §aКоманда снятия наказания для §e" + selectedPlayer + "§a отправлена:"));
                mc.field_1724.method_43496(class_2561.method_30163("§7/" + command));
            }

            mc.method_1507(null);
        }
    }

    @Override
    public boolean method_25402(double mouseX, double mouseY, int button) { // mouseClicked
        int sw = this.field_22789;
        int sh = this.field_22790;
        int cardW = Math.min(640, sw - 20);
        int cardH = Math.min(380, sh - 20);
        int cardX = (sw - cardW) / 2;
        int cardY = (sh - cardH) / 2;

        int pColX = cardX + 16;
        int pColW = 145;
        int listY = cardY + 68;

        if (mouseX >= pColX && mouseX <= pColX + pColW && mouseY >= listY && mouseY <= listY + MAX_VISIBLE_PLAYERS * 19) {
            int clickedIdx = (int) ((mouseY - listY) / 19) + playerScrollOffset;
            if (clickedIdx >= 0 && clickedIdx < filteredPlayers.size()) {
                selectedPlayer = filteredPlayers.get(clickedIdx);
                return true;
            }
        }

        return super.method_25402(mouseX, mouseY, button);
    }

    @Override
    public boolean method_25401(double mouseX, double mouseY, double horizontalAmount, double verticalAmount) { // mouseScrolled
        int sw = this.field_22789;
        int sh = this.field_22790;
        int cardW = Math.min(640, sw - 20);
        int cardH = Math.min(380, sh - 20);
        int cardX = (sw - cardW) / 2;

        int pColX = cardX + 16;
        int pColW = 145;
        if (mouseX >= pColX && mouseX <= pColX + pColW) {
            if (verticalAmount > 0 && playerScrollOffset > 0) {
                playerScrollOffset--;
                return true;
            } else if (verticalAmount < 0 && (playerScrollOffset + MAX_VISIBLE_PLAYERS) < filteredPlayers.size()) {
                playerScrollOffset++;
                return true;
            }
        }

        if (currentTab == 0) {
            int mColX = cardX + 172;
            int mColW = cardW - 172 - 212;
            if (mouseX >= mColX && mouseX <= mColX + mColW) {
                if (verticalAmount > 0 && ruleScrollOffset > 0) {
                    ruleScrollOffset--;
                    rebuildUi();
                    return true;
                } else if (verticalAmount < 0 && (ruleScrollOffset + MAX_VISIBLE_RULES) < rules.size()) {
                    ruleScrollOffset++;
                    rebuildUi();
                    return true;
                }
            }
        }

        return super.method_25401(mouseX, mouseY, horizontalAmount, verticalAmount);
    }

    @Override
    public void method_25394(class_332 context, int mouseX, int mouseY, float delta) { // render
        int sw = this.field_22789;
        int sh = this.field_22790;
        int cardW = Math.min(640, sw - 20);
        int cardH = Math.min(380, sh - 20);
        int cardX = (sw - cardW) / 2;
        int cardY = (sh - cardH) / 2;

        RenderSystem.enableBlend();
        RenderSystem.defaultBlendFunc();

        // 1. Затемнение фона
        context.method_25294(0, 0, sw, sh, 0x99000000);

        // 2. Обсидиановая карточка окна наказаний
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

        // 3. Заголовок и бейдж ранга
        if (this.field_22793 != null) {
            String title = "МОДЕРАЦИЯ GLADE";
            context.method_51433(this.field_22793, title, cardX + 16, cardY + 14, 0xFFFFCC33, true);

            String badge = "[" + staff.title.toUpperCase() + "] " + staff.username;
            int bw = this.field_22793.method_1727(badge);
            context.method_51433(this.field_22793, badge, cardX + cardW - bw - 16, cardY + 14, 0xFFFFB833, true);

            // Разделительная линия
            context.method_25294(cardX + 16, cardY + 31, cardX + cardW - 16, cardY + 32, 0xFF452C18);

            // Заголовки колонок
            context.method_51433(this.field_22793, "1. Нарушитель:", cardX + 16, cardY + 34, 0xFFEDE2D0, true);

            if (currentTab == 0) {
                String rulesHeader = "2. Правило (" + (ruleScrollOffset + 1) + "-" + Math.min(ruleScrollOffset + MAX_VISIBLE_RULES, rules.size()) + "/" + rules.size() + "):";
                context.method_51433(this.field_22793, rulesHeader, cardX + 172, cardY + 34, 0xFFEDE2D0, true);
                context.method_51433(this.field_22793, "3. Стадия наказания:", cardX + cardW - 200, cardY + 34, 0xFFEDE2D0, true);
                context.method_51433(this.field_22793, "Доказательства:", cardX + cardW - 200, cardY + 147, 0xFFEDE2D0, true);
            } else {
                context.method_51433(this.field_22793, "2. Действие снятия:", cardX + 172, cardY + 34, 0xFFEDE2D0, true);
                context.method_51433(this.field_22793, "3. Шаблоны причин:", cardX + cardW - 200, cardY + 34, 0xFFEDE2D0, true);
                context.method_51433(this.field_22793, "Причина снятия:", cardX + cardW - 200, cardY + 147, 0xFFEDE2D0, true);
            }

            // Список игроков (Колонка 1)
            int pColX = cardX + 16;
            int pColW = 145;
            int listY = cardY + 66;

            for (int i = 0; i < MAX_VISIBLE_PLAYERS; i++) {
                int pIdx = i + playerScrollOffset;
                if (pIdx < filteredPlayers.size()) {
                    String pName = filteredPlayers.get(pIdx);
                    boolean isSelected = pName.equals(selectedPlayer);
                    int itemY = listY + i * 19;

                    int rowBg = isSelected ? 0xFF553311 : 0xAA221810;
                    context.method_25294(pColX, itemY, pColX + pColW, itemY + 17, rowBg);

                    if (isSelected) {
                        context.method_25294(pColX, itemY, pColX + 2, itemY + 17, 0xFFFF9900);
                        context.method_25294(pColX + pColW - 2, itemY, pColX + pColW, itemY + 17, 0xFFFF9900);
                    }

                    int textCol = isSelected ? 0xFFFFFFFF : 0xFFCCC0B0;
                    context.method_51433(this.field_22793, pName, pColX + 8, itemY + 4, textCol, false);
                }
            }

            // Предпросмотр CMI команды внизу
            int previewY = cardY + cardH - 62;
            context.method_25294(cardX + 16, previewY, cardX + cardW - 16, previewY + 22, 0xFF221810);
            context.method_25294(cardX + 16, previewY, cardX + cardW - 16, previewY + 1, 0xFF452C18);

            String cmdText = "";
            String comment = (commentField != null) ? commentField.method_1882().trim() : "";
            String target = selectedPlayer.isEmpty() ? "<Игрок>" : selectedPlayer;

            if (currentTab == 0 && selectedRuleIndex >= 0 && selectedRuleIndex < rules.size()) {
                GladePunishRule r = rules.get(selectedRuleIndex);
                cmdText = "Команда: /" + r.buildCmiCommand(target, selectedStageIndex, comment);
            } else if (currentTab == 1) {
                UnpunishType type = unpunishTypes[selectedUnpunishIndex];
                cmdText = "Команда: /" + type.commandPrefix + " " + target + (comment.isEmpty() ? "" : " " + comment);
            }

            if (this.field_22793.method_1727(cmdText) > cardW - 40) {
                cmdText = cmdText.substring(0, Math.min(cmdText.length(), 65)) + "...";
            }
            context.method_51433(this.field_22793, cmdText, cardX + 24, previewY + 7, currentTab == 1 ? 0xFF66FF88 : 0xFFFFAA00, true);
        }

        super.method_25394(context, mouseX, mouseY, delta);
    }
}
