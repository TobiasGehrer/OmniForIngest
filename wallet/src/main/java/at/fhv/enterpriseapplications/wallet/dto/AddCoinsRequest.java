package at.fhv.enterpriseapplications.wallet.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record AddCoinsRequest(
        @NotNull String username,
        @NotNull @Positive Integer amount
) {}
