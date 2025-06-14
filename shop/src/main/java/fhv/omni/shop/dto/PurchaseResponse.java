package fhv.omni.shop.dto;

import jakarta.validation.constraints.NotNull;

public record PurchaseResponse(
        @NotNull String username,
        @NotNull String itemId,
        @NotNull String itemName,
        @NotNull Integer price,
        @NotNull Integer remainingCoins,
        @NotNull Boolean success,
        String message
) {
}
