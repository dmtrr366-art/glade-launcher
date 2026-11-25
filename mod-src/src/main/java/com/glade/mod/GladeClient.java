package com.glade.mod;

import net.fabricmc.api.ClientModInitializer;

public class GladeClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        System.out.println("[Glade] Инициализация защищенного клиентского ядра Glade Core 1.0...");

        // Проверка криптографической подписи официального лаунчера (защита от кражи)
        if (!GladeCrypto.verifyLauncherEnvironment()) {
            System.err.println("[Glade Security] ВНИМАНИЕ: Неавторизованный запуск! Мод защищен и работает только в официальном Glade Launcher.");
            // Отключаем функции мода при неавторизованном переносе
            return;
        }

        GladeConfig.load();
        GladeSecurityScanner.scan();
        System.out.println("[Glade] Модули скинов, защиты и интерфейса успешно загружены!");
    }
}
