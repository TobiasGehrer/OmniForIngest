package fhv.omni.shop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
public class WalletServiceClient {
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String walletServiceUrl;

    public WalletServiceClient(@Value("${wallet.service.url:http://localhost:8083}") String walletServiceUrl) {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
        this.walletServiceUrl = walletServiceUrl;
    }

    public Integer getPlayerCoins(String username) {
        try {
            String url = walletServiceUrl + "/api/wallet/" + username + "/coins";
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                Map<String, Object> responseBody = objectMapper.readValue(response.getBody(), Map.class);
                return (Integer) responseBody.get("coins");
            } else {
                log.warn("Failed to get coins for {}: HTTP {}", username, response.getStatusCode());
                return 0;
            }
        } catch (Exception e) {
            log.error("Error getting coins for {}: {}", username, e.getMessage());
            return 0;
        }
    }

    public boolean deductCoins(String username, Integer amount) {
        try {
            String url = walletServiceUrl + "/api/wallet/" + username + "/deduct-coins";

            Map<String, Integer> requestBody = new HashMap<>();
            requestBody.put("amount", amount);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Integer>> requestEntity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    requestEntity,
                    String.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Successfully deducted {} coins for {}", amount, username);
                return true;
            } else {
                log.error("Failed to deduct coins for {}: HTTP {}", username, response.getStatusCode());
                return false;
            }
        } catch (Exception e) {
            log.error("Error deducting coins for {}: {}", username, e.getMessage());
            return false;
        }
    }
}
