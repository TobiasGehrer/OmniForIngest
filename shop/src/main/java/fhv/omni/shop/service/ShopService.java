package fhv.omni.shop.service;

import fhv.omni.shop.dto.PlayerUnlocksDto;
import fhv.omni.shop.dto.PurchaseRequest;
import fhv.omni.shop.dto.PurchaseResponse;
import fhv.omni.shop.dto.ShopItemDto;
import fhv.omni.shop.entity.PlayerUnlock;
import fhv.omni.shop.entity.ShopItem;
import fhv.omni.shop.enums.ItemType;
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
    private final ShopItemRepository shopItemRepository;
    private final PlayerUnlockRepository playerUnlockRepository;
    private final WalletServiceClient walletServiceClient;

    @PostConstruct
    public void initializeShopItems() {
        // Initialize default shop items if they don't exist
        if (shopItemRepository.count() == 0) {
            log.info("Initialize default shop items...");

            ShopItem map2Unlock = new ShopItem();
            map2Unlock.setItemId("map2");
            map2Unlock.setName("Map 2 Unlock");
            map2Unlock.setDescription("Playing field with fixed objects, damage regions, healing regions and personal items."); //TODO: CHANGE DESCRIPTION
            map2Unlock.setItemType(ItemType.MAP_UNLOCK);
            map2Unlock.setPrice(500);
            map2Unlock.setIsActive(true);

            ShopItem map3Unlock = new ShopItem();
            map3Unlock.setItemId("map3");
            map3Unlock.setName("Map 3 Unlock");
            map3Unlock.setDescription("Playing field with fixed objects, damage regions, healing regions, personal items, growing damage region and one NPC"); //TODO: CHANGE DESCRIPTION
            map3Unlock.setItemType(ItemType.MAP_UNLOCK);
            map3Unlock.setPrice(1000);
            map3Unlock.setIsActive(true);

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
                .map(item -> ShopItemDto.fromEntity(item, unlockedItems.contains(item.getItemId())))
                .toList();
    }

    public PlayerUnlocksDto getPlayerUnlocks(String username) {
        List<String> unlockedItems = playerUnlockRepository.findUnlockedItemIdsByUsername(username);
        return new PlayerUnlocksDto(username, unlockedItems);
    }

    @Transactional
    public PurchaseResponse purchaseItem(PurchaseRequest request) {
        String username = request.username();
        String itemId = request.itemId();

        // Check if item exists
        ShopItem item = shopItemRepository.findByItemId(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Item not found: " + itemId));

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
        return playerUnlockRepository.existsByUsernameAndItemId(username, itemId);
    }

    public boolean hasUnlockedMap(String username, String mapId) {
        return hasUnlockedItem(username, mapId);
    }
}
