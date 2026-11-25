package com.glade.mod;

import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.class_2561;
import net.minecraft.class_2960;
import net.minecraft.class_332;
import net.minecraft.class_4185;

public class GladeMenuButton extends class_4185 {
    private final class_2960 normalTexture;
    private final class_2960 hoverTexture;
    private final int texWidth;
    private final int texHeight;

    public GladeMenuButton(int x, int y, int width, int height,
                           class_2960 normalTexture, class_2960 hoverTexture,
                           int texWidth, int texHeight,
                           class_4185.class_4241 onPress) {
        super(x, y, width, height, class_2561.method_30163(""), onPress, field_40754);
        this.normalTexture = normalTexture;
        this.hoverTexture = hoverTexture;
        this.texWidth = texWidth;
        this.texHeight = texHeight;
    }

    @Override
    public void method_48579(class_332 context, int mouseX, int mouseY, float delta) {
        boolean hovered = this.method_49606();
        class_2960 tex = hovered ? this.hoverTexture : this.normalTexture;

        int x = this.method_46426();
        int y = this.method_46427();
        int w = this.method_25368();
        int h = this.method_25364();

        RenderSystem.enableBlend();
        RenderSystem.defaultBlendFunc();
        context.method_25293(tex, x, y, w, h, 0f, 0f, texWidth, texHeight, texWidth, texHeight);
    }
}
