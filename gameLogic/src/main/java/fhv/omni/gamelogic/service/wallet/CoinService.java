package fhv.omni.gamelogic.service.wallet;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Service
public class CoinService {
    private final Logger logger = LoggerFactory.getLogger(CoinService.class);
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${wallet.service.url:http://localhost:8083}")
    private String walletServiceUrl;

    private static final Map<Integer, Integer> RANK_REWARDS = Map.of(
            1, 100, // 1st place: 100 coins
            2, 75, // 2nd place: 75 coins
            3, 50, // 3rd place: 50 coins
            4, 25 // 4th place: 25 coins
    );

    public CoinService() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    public CompletableFuture<Integer> awardCoinsForRank(String username, int rank) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                Integer coinsToAward = RANK_REWARDS.get(rank);

                if (coinsToAward == null) {
                    logger.warn("No coin reward defined for rank: {}", rank);
                    return null;
                }

                return addCoinsToWallet(username, coinsToAward);
            } catch (Exception e) {
                logger.error("Error awarding coins to player {}: {}", username, e.getMessage());
                return null;
            }
        });
    }

    private Integer addCoinsToWallet(String username, Integer amount) {
        try {
            String url = this.walletServiceUrl + "/api/wallet/" + username + "/add-coins";

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("username", username);
            requestBody.put("amount", amount);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    requestEntity,
                    String.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                Map<String, Object> responseBody = objectMapper.readValue(response.getBody(), Map.class);
                Integer totalCoins = (Integer) responseBody.get("totalCoins");

                logger.info("Successfully awarded {} coins to {}. Total coins: {}", amount, username, totalCoins);

                return totalCoins;
            } else {
                logger.error("Failed to add coins for {}: HTTP {}", username, response.getStatusCode());
                return null;
            }
        } catch (JsonProcessingException e) {
            logger.error("Error parsing wallet service response for {}: {}", username, e.getMessage());
            return null;
        } catch (Exception e) {
            logger.error("Error communicating with wallet service for {}: {}", username, e.getMessage());
            return null;
        }
    }

    public CompletableFuture<Integer> getPlayerCoins(String username) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String url = this.walletServiceUrl + "/api/wallet/" + username + "/coins";

                ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

                if (response.getStatusCode().is2xxSuccessful()) {
                    Map<String, Object> responseBody = objectMapper.readValue(response.getBody(), Map.class);
                    return (Integer) responseBody.get("coins");
                } else {
                    logger.warn("Failed to get coins for {}: HTTP {}", username, response.getStatusCode());
                    return 0;
                }
            } catch (Exception e) {
                logger.error("Error getting coins for {}: {}", username, e.getMessage());
                return 0;
            }
        });
    }

    public Map<String, Integer> awardCoinsToPlayer(Map<String, Integer> playerRanks) {
        Map<String, Integer> coinResults = new HashMap<>();

        playerRanks.forEach((username, rank) -> {
            CompletableFuture<Integer> future = awardCoinsForRank(username, rank);

            try {
                Integer coinsAwarded = RANK_REWARDS.get(rank);

                if (coinsAwarded != null) {
                    coinResults.put(username, coinsAwarded);
                    logger.info("Queued {} coins for player {} (rank {})", coinsAwarded, username, rank);
                }
            } catch (Exception e) {
                logger.error("Error processing coin award for {}: {}", username, e.getMessage());
                coinResults.put(username, 0);
            }
        });

        return coinResults;
    }
}
