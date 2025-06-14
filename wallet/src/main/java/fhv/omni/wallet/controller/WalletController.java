package fhv.omni.wallet.controller;

import fhv.omni.wallet.dto.AddCoinsRequest;
import fhv.omni.wallet.dto.AddCoinsResponse;
import fhv.omni.wallet.dto.WalletDto;
import fhv.omni.wallet.service.WalletService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:4173", "https://omni.jware.at"}, allowCredentials = "true")
public class WalletController {

    private static final String SUCCESS_KEY = "success";
    private static final String MESSAGE_KEY = "message";
    private static final String USERNAME_KEY = "username";
    private static final String REMAINING_COINS_KEY = "remainingCoins";
    private static final String COINS_KEY = "coins";

    private final WalletService walletService;

    @GetMapping("/{username}")
    public ResponseEntity<WalletDto> getWallet(@PathVariable String username) {
        log.info("Getting wallet for user: {}", username);
        WalletDto wallet = walletService.getWallet(username);
        return ResponseEntity.ok(wallet);
    }

    @PostMapping("/{username}/add-coins")
    public ResponseEntity<AddCoinsResponse> addCoins(@PathVariable String username, @Valid @RequestBody AddCoinsRequest request) {
        if (request.amount() <= 0) {
            return ResponseEntity.badRequest().body(new AddCoinsResponse(username, 0, 0, "Amount must be positive"));
        }

        log.info("Adding {} coins to user: {}", request.amount(), username);

        try {
            WalletDto updatedWallet = walletService.addCoins(username, request.amount());

            AddCoinsResponse response = new AddCoinsResponse(
                    updatedWallet.username(),
                    request.amount(),
                    updatedWallet.coins(),
                    "Coins added successfully"
            );

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error adding coins to user {}: {}", username, e.getMessage());
            return ResponseEntity.internalServerError().body(new AddCoinsResponse(username, 0, 0, "Failed to add coins: " + e.getMessage()));
        }
    }

    @PostMapping("/{username}/deduct-coins")
    public ResponseEntity<Map<String, Object>> deductCoins(@PathVariable String username, @Valid @RequestBody Map<String, Integer> request) {
        Integer amount = request.get("amount");

        if (amount <= 0) {
            return ResponseEntity.badRequest().body(Map.of(
                    SUCCESS_KEY, false,
                    MESSAGE_KEY, "Amount must be positive"
            ));
        }

        log.info("Deducting {} coins from user: {}", amount, username);

        try {
            WalletDto updatedWallet = walletService.deductCoins(username, amount);

            return ResponseEntity.ok(Map.of(
                    SUCCESS_KEY, true,
                    USERNAME_KEY, updatedWallet.username(),
                    REMAINING_COINS_KEY, updatedWallet.coins(),
                    MESSAGE_KEY, "Coins deducted successfully"
            ));
        } catch (IllegalArgumentException e) {
            log.warn("Deduction failed for user {}: {}", username, e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    SUCCESS_KEY, false,
                    MESSAGE_KEY, e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Error deducting coins from user {}: {}", username, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    SUCCESS_KEY, false,
                    MESSAGE_KEY, "Failed to deduct coins: " + e.getMessage()
            ));
        }
    }

    @GetMapping("/{username}/coins")
    public ResponseEntity<Map<String, Object>> getCoins(@PathVariable String username) {
        log.info("Getting coins for user: {}", username);
        Integer coins = walletService.getCoins(username);
        return ResponseEntity.ok(Map.of(
                USERNAME_KEY, username,
                COINS_KEY, coins)
        );
    }
}
