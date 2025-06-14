package fhv.omni.shop.dto;

import fhv.omni.shop.entity.PlayerPreference;

public record PlayerPreferenceDto(
        String username,
        String selectedSkin
) {
    public static PlayerPreferenceDto fromEntity(PlayerPreference preference) {
        return new PlayerPreferenceDto(
                preference.getUsername(),
                preference.getSelectedSkin()
        );
    }
}
