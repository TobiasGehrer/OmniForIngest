package fhv.omni.shop.dto;

import jakarta.validation.constraints.NotNull;

public record PurchaseRequest(
        @NotNull String username,
        @NotNull String itemId
) {
}
