package fhv.omni.shop.controller;

import fhv.omni.shop.dto.PlayerUnlocksDto;
import fhv.omni.shop.dto.PurchaseRequest;
import fhv.omni.shop.dto.PurchaseResponse;
import fhv.omni.shop.dto.ShopItemDto;
import fhv.omni.shop.service.ShopService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/shop")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:4173"}, allowCredentials = "true")
public class ShopController {
    private final ShopService shopService;

    @GetMapping("/items")
    public ResponseEntity<List<ShopItemDto>> getShopItems(@RequestParam String username) {
        log.info("Getting shop items for user: {}", username);
        List<ShopItemDto> items = shopService.getShopItems(username);
        return ResponseEntity.ok(items);
    }

    @GetMapping("/unlocks/{username}")
    public ResponseEntity<PlayerUnlocksDto> getPlayerUnlocks(@PathVariable String username) {
        log.info("Getting unlocks for user: {}", username);
        PlayerUnlocksDto playerUnlocks = shopService.getPlayerUnlocks(username);
        return ResponseEntity.ok(playerUnlocks);
    }

    @PostMapping("/purchase")
    public ResponseEntity<PurchaseResponse> purchaseItem(@Valid @RequestBody PurchaseRequest request) {
        log.info("Purchase request: {} wants to buy {}", request.username(), request.itemId());

        try {
            PurchaseResponse response = shopService.purchaseItem(request);

            if (response.success()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.badRequest().body(response);
            }
        } catch (IllegalArgumentException e) {
            log.error("Purchase failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                    new PurchaseResponse(request.username(), request.itemId(), "Unknown", 0, 0, false, e.getMessage())
            );
        } catch (Exception e) {
            log.error("Purchase failed for user {}: {}", request.username(), e.getMessage());
            return ResponseEntity.internalServerError().body(
                    new PurchaseResponse(request.username(), request.itemId(), "Unknown", 0, 0, false, "Internal Server Error")
            );
        }
    }

    @GetMapping("/check-unlock/{username}/{itemId}")
    public ResponseEntity<Map<String, Object>> checkUnlock(@PathVariable String username, @PathVariable String itemId) {
        boolean unlocked = shopService.hasUnlockedItem(username, itemId);
        return ResponseEntity.ok(Map.of(
                "username", username,
                "itemId", itemId,
                "unlocked", unlocked
        ));
    }

    @GetMapping("/check-map/{username}/{mapId}")
    public ResponseEntity<Map<String, Object>> checkMapUnlock(@PathVariable String username, @PathVariable String mapId) {
        boolean unlocked = shopService.hasUnlockedMap(username, mapId);
        return ResponseEntity.ok(Map.of(
                "username", username,
                "mapId", mapId,
                "unlocked", unlocked
        ));
    }
}
