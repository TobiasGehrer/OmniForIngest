package fhv.omni.wallet.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record AddCoinsResponse(
        @NotNull String username,
        @NotNull @Positive Integer coinsAdded,
        @NotNull Integer totalCoins,
        String message
) {
}
