package fhv.omni.wallet.dto;

import jakarta.validation.constraints.NotNull;

public record WalletDto(
        @NotNull String username,
        @NotNull Integer coins
) {
}
