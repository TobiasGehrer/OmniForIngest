package fhv.omni.gateway.config;

import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.server.ServerWebExchange;

@Configuration
public class WebSocketConfig {

    @Bean
    public GlobalFilter webSocketSessionFilter() {
        return (exchange, chain) -> {
            // Check if this is a WebSocket upgrade request
            boolean isWebSocketUpgrade = "websocket".equalsIgnoreCase(
                    exchange.getRequest().getHeaders().getFirst("Upgrade"));

            if (isWebSocketUpgrade) {
                // Add headers to help with connection tracking
                ServerWebExchange modifiedExchange = exchange.mutate()
                        .request(exchange.getRequest().mutate()
                                .header("X-Gateway-WebSocket", "true")
                                .build())
                        .build();

                return chain.filter(modifiedExchange);
            }

            return chain.filter(exchange);
        };
    }
}
