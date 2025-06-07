package at.fhv.enterpriseapplications.wallet.dto;

import jakarta.validation.constraints.NotNull;

import javax.swing.*;

public record WalletDto(
        @NotNull String username,
        @NotNull Integer coins
) {}
