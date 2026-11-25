package com.glade.mod.staff;

import java.util.ArrayList;
import java.util.List;

public class GladePunishRule {
    public enum ActionType {
        MUTE("Мут"),
        TEMPBAN("Бан (вр.)"),
        BAN("Бан (навсегда)"),
        KICK("Кик"),
        WARN("Варн");

        public final String title;
        ActionType(String title) {
            this.title = title;
        }
    }

    public static class Stage {
        public final int number;
        public final ActionType action;
        public final String duration; // "15m", "1h", "1d", "perm"
        public final String durationDisplay; // "15 мин", "1 час", "Навсегда"
        public final int minLevel; // 1=Стажер, 2=Хелпер, 3=Ст.хелпер, 4=Модератор, 5=Ст.модератор, 6=Администратор, 7=Гл.администратор
        public final String minRankTitle;

        public Stage(int number, ActionType action, String duration, String durationDisplay, int minLevel, String minRankTitle) {
            this.number = number;
            this.action = action;
            this.duration = duration;
            this.durationDisplay = durationDisplay;
            this.minLevel = minLevel;
            this.minRankTitle = minRankTitle;
        }
    }

    public final String id;
    public final String category;
    public final String name;
    public final List<Stage> stages = new ArrayList<>();

    public GladePunishRule(String id, String category, String name) {
        this.id = id;
        this.category = category;
        this.name = name;
    }

    public GladePunishRule addStage(ActionType action, String duration, String durationDisplay, int minLevel, String minRankTitle) {
        this.stages.add(new Stage(this.stages.size() + 1, action, duration, durationDisplay, minLevel, minRankTitle));
        return this;
    }

    /**
     * Формирует готовую CMI команду для отправки на сервер
     */
    public String buildCmiCommand(String targetPlayer, int stageIndex, String comment) {
        if (stageIndex < 0 || stageIndex >= stages.size()) return "";
        Stage stage = stages.get(stageIndex);

        String cleanComment = (comment == null) ? "" : comment.trim();
        String reason = name + " [Ст." + stage.number + "]" + (cleanComment.isEmpty() ? "" : " - " + cleanComment);

        switch (stage.action) {
            case MUTE:
                return "cmi mute " + targetPlayer + " " + stage.duration + " " + reason;
            case TEMPBAN:
                return "cmi tempban " + targetPlayer + " " + stage.duration + " " + reason;
            case BAN:
                return "cmi ban " + targetPlayer + " " + reason;
            case KICK:
                return "cmi kick " + targetPlayer + " " + reason;
            case WARN:
                return "cmi warn " + targetPlayer + " " + reason;
            default:
                return "cmi mute " + targetPlayer + " " + stage.duration + " " + reason;
        }
    }

    public static List<GladePunishRule> getDefaultRules() {
        List<GladePunishRule> list = new ArrayList<>();

        // 1. Категория: 1. Общие
        list.add(new GladePunishRule("1.5.1", "Общие", "1.5.1 Покупка/продажа за реал")
            .addStage(ActionType.BAN, "perm", "Перманентный бан", 6, "Администратор"));

        // 2. Категория: 3. Чат
        list.add(new GladePunishRule("3.1", "Чат", "3.1 Оскорбления игроков")
            .addStage(ActionType.MUTE, "30m", "30 минут", 1, "Стажёр")
            .addStage(ActionType.MUTE, "60m", "60 минут (повторно)", 1, "Стажёр"));

        list.add(new GladePunishRule("3.2", "Чат", "3.2 Упоминание/оскорбление родных")
            .addStage(ActionType.TEMPBAN, "1d", "1 день", 3, "Ст. хелпер")
            .addStage(ActionType.TEMPBAN, "7d", "7 дней", 4, "Модератор")
            .addStage(ActionType.TEMPBAN, "14d", "14 дней", 4, "Модератор")
            .addStage(ActionType.TEMPBAN, "30d", "30 дней", 5, "Ст. модератор"));

        list.add(new GladePunishRule("3.3", "Чат", "3.3 Розжиг / оск. нации / религии")
            .addStage(ActionType.TEMPBAN, "1d", "1 день", 3, "Ст. хелпер")
            .addStage(ActionType.TEMPBAN, "7d", "7 дней", 4, "Модератор")
            .addStage(ActionType.TEMPBAN, "14d", "14 дней", 4, "Модератор")
            .addStage(ActionType.TEMPBAN, "30d", "30 дней", 5, "Ст. модератор"));

        list.add(new GladePunishRule("3.4", "Чат", "3.4 Оскорбление администрации")
            .addStage(ActionType.MUTE, "30m", "30 минут", 1, "Стажёр")
            .addStage(ActionType.MUTE, "60m", "60 минут", 1, "Стажёр")
            .addStage(ActionType.MUTE, "120m", "120 минут (Ст. адм.)", 4, "Модератор"));

        list.add(new GladePunishRule("3.5", "Чат", "3.5 Флуд сообщениями")
            .addStage(ActionType.MUTE, "5m", "5 минут", 1, "Стажёр")
            .addStage(ActionType.MUTE, "10m", "10 минут (повторно)", 1, "Стажёр"));

        list.add(new GladePunishRule("3.5.1", "Чат", "3.5.1 Конфликты / провокации в чате")
            .addStage(ActionType.MUTE, "15m", "15 минут", 1, "Стажёр")
            .addStage(ActionType.MUTE, "30m", "30 минут (повторно)", 1, "Стажёр"));

        list.add(new GladePunishRule("3.6", "Чат", "3.6 Реклама сторонних проектов")
            .addStage(ActionType.MUTE, "30m", "30 минут", 1, "Стажёр")
            .addStage(ActionType.MUTE, "60m", "60 минут", 1, "Стажёр")
            .addStage(ActionType.MUTE, "120m", "120 минут (Ст. адм.)", 4, "Модератор")
            .addStage(ActionType.TEMPBAN, "14d", "14 дней + бан ПК", 5, "Ст. модератор"));

        list.add(new GladePunishRule("3.7", "Чат", "3.7 Распространение перс. данных")
            .addStage(ActionType.TEMPBAN, "14d", "14 дней", 4, "Модератор")
            .addStage(ActionType.TEMPBAN, "30d", "30 дней", 5, "Ст. модератор")
            .addStage(ActionType.BAN, "perm", "Перманентный бан", 6, "Администратор"));

        list.add(new GladePunishRule("3.8", "Чат", "3.8 Угрозы в реальной жизни")
            .addStage(ActionType.TEMPBAN, "30d", "30 дней", 5, "Ст. модератор")
            .addStage(ActionType.BAN, "perm", "Перманентный бан", 6, "Администратор"));

        // 3. Категория: 4. Геймплей
        list.add(new GladePunishRule("4.1", "Геймплей", "4.1 Багоюз / Abuse уязвимостей")
            .addStage(ActionType.TEMPBAN, "12h", "12 часов", 3, "Ст. хелпер")
            .addStage(ActionType.TEMPBAN, "3d", "3 дня", 3, "Ст. хелпер")
            .addStage(ActionType.TEMPBAN, "30d", "30 дней (Ст. адм.)", 5, "Ст. модератор")
            .addStage(ActionType.BAN, "perm", "Перманент (Вред экономике)", 6, "Администратор"));

        list.add(new GladePunishRule("4.2.2", "Геймплей", "4.2.2 Тимминг на Королевской битве")
            .addStage(ActionType.TEMPBAN, "3h", "3 часа", 2, "Хелпер")
            .addStage(ActionType.TEMPBAN, "24h", "24 часа (повторно)", 3, "Ст. хелпер"));

        list.add(new GladePunishRule("4.3", "Геймплей", "4.3 Сторонние программы")
            .addStage(ActionType.TEMPBAN, "14d", "14 дней", 4, "Модератор")
            .addStage(ActionType.TEMPBAN, "30d", "30 дней (повторно)", 5, "Ст. модератор"));

        // 4. Категория: 5. Команда GLADE
        list.add(new GladePunishRule("5.1", "Администрация", "5.1 Выдача себя за команду GLADE")
            .addStage(ActionType.TEMPBAN, "3d", "3 дня", 3, "Ст. хелпер")
            .addStage(ActionType.TEMPBAN, "14d", "14 дней", 4, "Модератор")
            .addStage(ActionType.BAN, "perm", "Перманентный бан", 6, "Администратор"));

        list.add(new GladePunishRule("5.2", "Администрация", "5.2 Обман сотрудников проекта")
            .addStage(ActionType.TEMPBAN, "14d", "14 дней", 4, "Модератор")
            .addStage(ActionType.TEMPBAN, "30d", "30 дней", 5, "Ст. модератор")
            .addStage(ActionType.BAN, "perm", "Перманентный бан", 6, "Администратор"));

        // 5. Категория: 6. Грубые нарушения
        list.add(new GladePunishRule("6.3", "Грубые", "6.3 Злоупотребление правилами")
            .addStage(ActionType.TEMPBAN, "3d", "3 дня", 3, "Ст. хелпер")
            .addStage(ActionType.TEMPBAN, "7d", "7 дней", 4, "Модератор")
            .addStage(ActionType.BAN, "perm", "Перманентный бан", 6, "Администратор"));

        list.add(new GladePunishRule("6.4", "Грубые", "6.4 Обход блокировки")
            .addStage(ActionType.TEMPBAN, "14d", "14 дней (прошлый срок)", 4, "Модератор")
            .addStage(ActionType.BAN, "perm", "Перманентный бан", 6, "Администратор"));

        list.add(new GladePunishRule("6.5", "Грубые", "6.5 Ущерб серверам / экономике")
            .addStage(ActionType.BAN, "perm", "Перманентный бан", 6, "Администратор"));

        list.add(new GladePunishRule("6.6", "Грубые", "6.6 Читы / AHK / макросы")
            .addStage(ActionType.BAN, "perm", "Перманентный бан + HWID", 6, "Администратор"));

        list.add(new GladePunishRule("6.7", "Грубые", "6.7 Неконструктивная критика")
            .addStage(ActionType.TEMPBAN, "14d", "14 дней (Ст. адм.)", 5, "Ст. модератор")
            .addStage(ActionType.TEMPBAN, "30d", "30 дней (Ст. адм.)", 5, "Ст. модератор")
            .addStage(ActionType.BAN, "perm", "Перманентный бан", 6, "Администратор"));

        list.add(new GladePunishRule("6.8", "Грубые", "6.8 Покрывательство читеров/вредителей")
            .addStage(ActionType.TEMPBAN, "7d", "7 дней + штраф 5M", 5, "Ст. модератор")
            .addStage(ActionType.TEMPBAN, "30d", "30 дней + штраф 10M", 5, "Ст. модератор")
            .addStage(ActionType.BAN, "perm", "Перманентный бан", 6, "Администратор"));

        return list;
    }
}
