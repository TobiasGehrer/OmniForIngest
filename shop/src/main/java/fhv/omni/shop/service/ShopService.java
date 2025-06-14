package fhv.omni.shop.service;

import fhv.omni.shop.dto.*;
import fhv.omni.shop.entity.PlayerPreference;
import fhv.omni.shop.entity.PlayerUnlock;
import fhv.omni.shop.entity.ShopItem;
import fhv.omni.shop.enums.ItemType;
import fhv.omni.shop.repository.PlayerPreferenceRepository;
import fhv.omni.shop.repository.PlayerUnlockRepository;
import fhv.omni.shop.repository.ShopItemRepository;
import jakarta.annotation.PostConstruct;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShopService {
    private static final String DEFAULT_SKIN = "player_0";

    private final ShopItemRepository shopItemRepository;
    private final PlayerUnlockRepository playerUnlockRepository;
    private final PlayerPreferenceRepository playerPreferenceRepository;
    private final WalletServiceClient walletServiceClient;

    @PostConstruct
    public void initializeShopItems() {
        // Initialize default shop items if they don't exist
        if (shopItemRepository.count() == 0) {
            log.info("Initialize default shop items...");

            ShopItem map2Unlock = new ShopItem();
            map2Unlock.setItemId("map2");
            map2Unlock.setName("Medium Map Unlock");
            map2Unlock.setDescription("Damage & healing regions and powerups.");
            map2Unlock.setItemType(ItemType.MAP_UNLOCK);
            map2Unlock.setPrice(500);
            map2Unlock.setIsActive(true);

            ShopItem map3Unlock = new ShopItem();
            map3Unlock.setItemId("map3");
            map3Unlock.setName("Hard Map Unlock");
            map3Unlock.setDescription("Damage & healing regions, powerups, shrinking map and one enemy bot");
            map3Unlock.setItemType(ItemType.MAP_UNLOCK);
            map3Unlock.setPrice(1000);
            map3Unlock.setIsActive(true);

            // Add player skin items
            for (int i = 0; i <= 25; i++) {
                ShopItem playerSkin = new ShopItem();
                playerSkin.setItemId("player_" + i);
                playerSkin.setName("Skin " + i);
                playerSkin.setDescription("A unique player character skin.");
                playerSkin.setItemType(ItemType.CHARACTER_SKIN);
                if (i == 0) {
                    playerSkin.setPrice(0); // Default skin is free
                } else {
                    playerSkin.setPrice(50);
                }
                playerSkin.setIsActive(true);
                shopItemRepository.save(playerSkin);
            }

            shopItemRepository.save(map2Unlock);
            shopItemRepository.save(map3Unlock);

            log.info("Default shop items initialized");
        }
    }

    public List<ShopItemDto> getShopItems(String username) {
        List<ShopItem> items = shopItemRepository.findByIsActiveTrueOrderByItemTypeAscPriceAsc();
        Set<String> unlockedItems = playerUnlockRepository.findUnlockedItemIdsByUsername(username)
                .stream().collect(Collectors.toSet());

        return items.stream()
                .map(item -> {
                    // Make default skin always appear as unlocked
                    boolean isUnlocked = unlockedItems.contains(item.getItemId()) || DEFAULT_SKIN.equals(item.getItemId());
                    return ShopItemDto.fromEntity(item, isUnlocked);
                })
                .toList();
    }

    public PlayerUnlocksDto getPlayerUnlocks(String username) {
        List<String> unlockedItems = playerUnlockRepository.findUnlockedItemIdsByUsername(username);
        // Add default skin to the list of unlocked items if it's not already there
        if (!unlockedItems.contains(DEFAULT_SKIN)) {
            unlockedItems.add(DEFAULT_SKIN);
        }
        return new PlayerUnlocksDto(username, unlockedItems);
    }

    @Transactional
    public PurchaseResponse purchaseItem(PurchaseRequest request) {
        String username = request.username();
        String itemId = request.itemId();

        // Check if item exists
        ShopItem item = shopItemRepository.findByItemId(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Item not found: " + itemId));

        // Prevent purchasing default skin as it should be free and automatically unlocked
        if (DEFAULT_SKIN.equals(itemId)) {
            return new PurchaseResponse(
                    username, itemId, item.getName(), item.getPrice(),
                    walletServiceClient.getPlayerCoins(username), false,
                    "Default skin is already unlocked for all players"
            );
        }

        // Check if already unlocked
        if (playerUnlockRepository.existsByUsernameAndItemId(username, itemId)) {
            return new PurchaseResponse(
                    username, itemId, item.getName(), item.getPrice(),
                    walletServiceClient.getPlayerCoins(username), false,
                    "Item already unlocked"
            );
        }

        // Check if player has enough coins
        Integer playerCoins = walletServiceClient.getPlayerCoins(username);
        if (playerCoins < item.getPrice()) {
            return new PurchaseResponse(
                    username, itemId, item.getName(), item.getPrice(),
                    playerCoins, false,
                    "Insufficient coins. Need " + item.getPrice() + " coins, but only have " + playerCoins
            );
        }

        // Deduct coins
        boolean deductSuccess = walletServiceClient.deductCoins(username, item.getPrice());
        if (!deductSuccess) {
            return new PurchaseResponse(
                    username, itemId, item.getName(), item.getPrice(),
                    playerCoins, false,
                    "Failed to deduct coins from wallet"
            );
        }

        // Create unlock record
        PlayerUnlock unlock = new PlayerUnlock(username, itemId);
        playerUnlockRepository.save(unlock);

        Integer remainingCoins = walletServiceClient.getPlayerCoins(username);

        log.info("Player {} successfully purchased {} for {} coins. Remaining coins: {}",
                username, item.getName(), item.getPrice(), remainingCoins);

        return new PurchaseResponse(
                username, itemId, item.getName(), item.getPrice(),
                remainingCoins, true,
                "Purchase successful! " + item.getName() + " unlocked."
        );
    }

    public boolean hasUnlockedItem(String username, String itemId) {
        // default skin is always considered unlocked for all players
        if (DEFAULT_SKIN.equals(itemId)) {
            return true;
        }
        return playerUnlockRepository.existsByUsernameAndItemId(username, itemId);
    }

    public boolean hasUnlockedMap(String username, String mapId) {
        return hasUnlockedItem(username, mapId);
    }

    public PlayerPreferenceDto getPlayerPreference(String username) {
        PlayerPreference preference = playerPreferenceRepository.findByUsername(username)
                .orElseGet(() -> {
                    // Create default preference if not exists
                    PlayerPreference newPreference = new PlayerPreference(username);
                    return playerPreferenceRepository.save(newPreference);
                });

        return PlayerPreferenceDto.fromEntity(preference);
    }

    @Transactional
    public PlayerPreferenceDto updatePlayerPreference(UpdatePlayerPreferenceRequest request) {
        String username = request.username();
        String selectedSkin = request.selectedSkin();

        // Verify the skin is unlocked or is the default skin
        if (!selectedSkin.equals(DEFAULT_SKIN) && !hasUnlockedItem(username, selectedSkin)) {
            throw new IllegalArgumentException("Cannot select skin that is not unlocked: " + selectedSkin);
        }

        PlayerPreference preference = playerPreferenceRepository.findByUsername(username)
                .orElseGet(() -> new PlayerPreference(username));

        preference.setSelectedSkin(selectedSkin);
        preference = playerPreferenceRepository.save(preference);

        log.info("Updated player preference for {}: selectedSkin={}", username, selectedSkin);

        return PlayerPreferenceDto.fromEntity(preference);
    }
}
