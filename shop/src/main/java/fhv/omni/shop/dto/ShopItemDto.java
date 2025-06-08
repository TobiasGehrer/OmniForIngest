package fhv.omni.shop.dto;

import fhv.omni.shop.entity.ShopItem;
import jakarta.validation.constraints.NotNull;

public record ShopItemDto(
        @NotNull String itemId,
        @NotNull String name,
        String description,
        @NotNull String itemType,
        @NotNull Integer price,
        Boolean isUnlocked
) {
    public static ShopItemDto fromEntity(ShopItem item,boolean isUnlocked) {
        return new ShopItemDto(
                item.getItemId(),
                item.getName(),
                item.getDescription(),
                item.getItemType().name(),
                item.getPrice(),
                isUnlocked
        );
    }
}
