package at.fhv.enterpriseapplications.wallet.controller;

import at.fhv.enterpriseapplications.wallet.dto.AddCoinsRequest;
import at.fhv.enterpriseapplications.wallet.dto.AddCoinsResponse;
import at.fhv.enterpriseapplications.wallet.dto.WalletDto;
import at.fhv.enterpriseapplications.wallet.service.WalletService;
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
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:4173"}, allowCredentials="true")
public class WalletController {

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

    @GetMapping("/{username}/coins")
    public ResponseEntity<Map<String, Object>> getCoins(@PathVariable String username) {
        log.info("Getting coins for user: {}", username);
        Integer coins = walletService.getCoins(username);
        return ResponseEntity.ok(Map.of(
                "username", username,
                "coins", coins)
        );
    }
}
