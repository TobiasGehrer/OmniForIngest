package fhv.omni.shop.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdatePlayerPreferenceRequest(
        @NotBlank
        String username,

        @NotBlank
        String selectedSkin
) {
}
