package fhv.omni.gamelogic.controller;

import fhv.omni.gamelogic.config.GameServerEndpointConfigurator;
import fhv.omni.gamelogic.config.WebSocketConfig.GameInputDecoder;
import fhv.omni.gamelogic.config.WebSocketConfig.GameInputEncoder;
import fhv.omni.gamelogic.service.game.GameService;
import jakarta.websocket.*;
import jakarta.websocket.server.ServerEndpoint;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

import static fhv.omni.gamelogic.service.game.JsonUtils.objectMapper;

@ServerEndpoint(value = "/game",
        configurator = GameServerEndpointConfigurator.class,
        decoders = {GameInputDecoder.class},
        encoders = {GameInputEncoder.class})
@Component
public class GameServerEndpoint {

    private static final Logger logger = LoggerFactory.getLogger(GameServerEndpoint.class);
    private final GameService gameService;

    @Autowired
    public GameServerEndpoint(GameService gameService) {
        this.gameService = gameService;
    }

    @OnOpen
    public void onOpen(Session session) {
        String username = null;
        String mapId = null;

        try {
            // Extract username from token parameter
            List<String> tokenParams = session.getRequestParameterMap().get("token");
            if (tokenParams == null || tokenParams.isEmpty()) {
                logger.error("No token parameter provided for WebSocket connection");
                session.close();
                return;
            }
            username = tokenParams.get(0);

            // Extract mapId from map parameter
            List<String> mapParams = session.getRequestParameterMap().get("map");
            if (mapParams == null || mapParams.isEmpty()) {
                logger.error("No map parameter provided for WebSocket connection");
                session.close();
                return;
            }

            mapId = mapParams.get(0);

            logger.info("WebSocket connection opened for player: {} on map: {}", username, mapId);

            // Store both username and mapId in session for later use
            session.getUserProperties().put("username", username);
            session.getUserProperties().put("mapId", mapId);

            boolean connected = gameService.connect(username, mapId, session);

            if (!connected) {
                logger.warn("Connection rejected for player {} on map {}", username, mapId);
                return;
            }
        } catch (Exception e) {
            logger.error("Error in Websocket open handler", e);
            try {
                session.close();
            } catch (Exception closeException) {
                logger.error("Error closing session after open error", closeException);
            }
        }
    }

    @OnClose
    public void onClose(Session session) {
        try {
            String username = (String) session.getUserProperties().get("username");
            String mapId = (String) session.getUserProperties().get("mapId");

            if (username != null && mapId != null) {
                logger.info("WebSocket connection closed for player: {} on map: {}", username, mapId);
            } else {
                logger.info("WebSocket connection closed for unknown player (properties not set)");
            }

            gameService.disconnectBySession(session);
        } catch (Exception e) {
            logger.error("Error in WebSocket close handler", e);
        }
    }

    @OnMessage
    public void onMessage(String message, Session session) {
        try {
            // Parse the message as JSON
            Map<String, Object> jsonMessage = objectMapper.readValue(message, new com.fasterxml.jackson.core.type.TypeReference<>() {});

            // Get player ID and map ID from session properties
            String username = (String) session.getUserProperties().get("username");
            String mapId = (String) session.getUserProperties().get("mapId");

            if (username == null || mapId == null) {
                logger.warn("Received message from session without username or mapId");
                return;
            }

            // Extract message type
            String messageType = (String) jsonMessage.getOrDefault("type", "");

            // Handle the message
            gameService.handleMessage(username, mapId, messageType, jsonMessage);
        } catch (Exception e) {
            logger.error("Error processing message: {}", e.getMessage(), e);
        }
    }

    @OnError
    public void onError(Session session, Throwable throwable) {
        String username = (String) session.getUserProperties().get("username");
        String mapId = (String) session.getUserProperties().get("mapId");

        logger.error("WebSocket error for player: {} on map: {}", username, mapId, throwable);
        gameService.disconnectBySession(session);
    }
}
