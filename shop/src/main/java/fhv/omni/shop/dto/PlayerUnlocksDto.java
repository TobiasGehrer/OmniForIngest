package fhv.omni.shop.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record PlayerUnlocksDto(
        @NotNull String username,
        @NotNull List<String> unlockedItems
) {}
