package fhv.omni.gamelogic.service.shop;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class ShopServiceClient {
    private static final String DEFAULT_SKIN = "player_0";

    private final Logger logger = LoggerFactory.getLogger(ShopServiceClient.class);
    private final RestTemplate restTemplate;
    private final String shopServiceUrl;
    private final ExecutorService executorService = Executors.newCachedThreadPool();

    public ShopServiceClient(@Value("${services.shop.url:http://localhost:8084}") String shopServiceUrl) {
        this.shopServiceUrl = shopServiceUrl;
        this.restTemplate = new RestTemplate();
        logger.info("ShopServiceClient initialized with URL: {}", shopServiceUrl);
    }

    public String getPlayerSkin(String username) {
        try {
            logger.info("Fetching skin for player: {}", username);
            String url = shopServiceUrl + "/api/shop/preferences/" + username;

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url, 
                    HttpMethod.GET, 
                    null, 
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                if (body != null) {
                    String selectedSkin = (String) body.get("selectedSkin");
                    logger.info("Retrieved skin for player {}: {}", username, selectedSkin);
                    return selectedSkin != null && !selectedSkin.isEmpty() ? selectedSkin : DEFAULT_SKIN;
                } else {
                    logger.warn("Response body is null for player {}", username);
                    return DEFAULT_SKIN;
                }
            } else {
                logger.warn("Failed to get skin for player {}: No data returned", username);
                return DEFAULT_SKIN;
            }
        } catch (HttpClientErrorException.NotFound e) {
            logger.warn("Player {} not found in shop service, using default skin", username);
            return DEFAULT_SKIN;
        } catch (Exception e) {
            logger.error("Error fetching skin for player {}: {}", username, e.getMessage());
            return DEFAULT_SKIN;
        }
    }

    public CompletableFuture<String> getPlayerSkinAsync(String username) {
        return CompletableFuture.supplyAsync(() -> getPlayerSkin(username), executorService);
    }
}
