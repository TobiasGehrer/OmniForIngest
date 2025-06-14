package fhv.omni.gateway.forwarding;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;
import reactor.util.annotation.NonNull;

@Component
public class SessionOrCookieWebFilter implements WebFilter {

    private static final String SESSION_COOKIE_NAME = "SESSION";

    @Override
    @NonNull
    public Mono<Void> filter(@NonNull ServerWebExchange exchange, @NonNull WebFilterChain chain) {
        // Allow WebSocket upgrade requests to pass through without session validation
        boolean isWebSocketUpgrade = "websocket".equalsIgnoreCase(
                exchange.getRequest().getHeaders().getFirst("Upgrade"));

        if (isWebSocketUpgrade) {
            // For WebSocket connections, still check for session but don't block if missing
            // This helps with connection state tracking
            boolean hasSessionCookie = exchange.getRequest()
                    .getCookies()
                    .getFirst(SESSION_COOKIE_NAME) != null;

            if (!hasSessionCookie) {
                // Log for debugging but allow connection
                System.out.println("WebSocket connection without session cookie - allowing but logging");
            }

            return chain.filter(exchange);
        }

        boolean hasSessionCookie = exchange.getRequest()
                .getCookies()
                .getFirst(SESSION_COOKIE_NAME) != null;

        if (hasSessionCookie) {
            return chain.filter(exchange);
        } else {
            exchange.getResponse().setStatusCode(HttpStatus.FORBIDDEN);
            return exchange.getResponse().setComplete();
        }
    }
}
