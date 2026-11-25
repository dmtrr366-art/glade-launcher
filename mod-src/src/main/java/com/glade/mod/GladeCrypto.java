package com.glade.mod;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;

public class GladeCrypto {
    private static final byte[] MASTER_SALT = new byte[] {
        0x47, 0x6C, 0x61, 0x64, 0x65, 0x47, 0x75, 0x61,
        0x72, 0x64, 0x32, 0x30, 0x32, 0x36, 0x21, 0x2A
    }; // GladeGuard2026!*

    /**
     * Дешифрование зашифрованных строк ядра (предотвращает просмотр базы античита и протокола в декомпиляторах)
     */
    public static String decrypt(String base64Encrypted) {
        try {
            byte[] raw = Base64.getDecoder().decode(base64Encrypted);
            byte[] iv = Arrays.copyOfRange(raw, 0, 16);
            byte[] cipherText = Arrays.copyOfRange(raw, 16, raw.length);

            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] keyBytes = Arrays.copyOf(md.digest(MASTER_SALT), 16);

            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(keyBytes, "AES"), new IvParameterSpec(iv));
            byte[] decrypted = cipher.doFinal(cipherText);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return base64Encrypted;
        }
    }

    /**
     * Шифрование строк для упаковки
     */
    public static String encrypt(String plainText) {
        try {
            byte[] iv = new byte[] { 0x12, 0x34, 0x56, 0x78, (byte) 0x90, (byte) 0xAB, (byte) 0xCD, (byte) 0xEF, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, (byte) 0x88 };
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] keyBytes = Arrays.copyOf(md.digest(MASTER_SALT), 16);

            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(keyBytes, "AES"), new IvParameterSpec(iv));
            byte[] encrypted = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

            byte[] out = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(encrypted, 0, out, iv.length, encrypted.length);
            return Base64.getEncoder().encodeToString(out);
        } catch (Exception e) {
            return plainText;
        }
    }

    /**
     * Валидация запуска через официальный Glade Launcher (защита от кражи и переноса на другие лаунчеры)
     */
    public static boolean verifyLauncherEnvironment() {
        String brand = System.getProperty("minecraft.launcher.brand");
        String token = System.getProperty("glade.launcher.token");
        
        // Разрешено только при запуске через Glade Launcher
        if (brand == null || !brand.equalsIgnoreCase("Glade")) {
            return false;
        }
        if (token == null || token.trim().isEmpty()) {
            return false;
        }
        return true;
    }
}
