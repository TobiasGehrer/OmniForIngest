package fhv.omni.gamelogic.service.game;

import fhv.omni.gamelogic.service.game.enums.GameState;
import jakarta.websocket.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import static fhv.omni.gamelogic.service.game.JsonUtils.objectMapper;

@Service
public class GameService {
    private final Logger logger = LoggerFactory.getLogger(GameService.class);
    private final Map<String, GameRoom> gameRooms = new ConcurrentHashMap<>();

    private final ScheduledExecutorService cleanupService = Executors.newSingleThreadScheduledExecutor();

    public GameService() {
        // Run cleanup every 5 minutes to remove empty rooms
        cleanupService.scheduleAtFixedRate(this::cleanupEmptyRooms, 5, 5, TimeUnit.MINUTES);
    }

    public boolean connect(String username, String mapId, Session session) {
        logger.info("Connectin player {} to map {}", username, mapId);

        GameRoom room = gameRooms.computeIfAbsent(mapId, k -> new GameRoom(mapId));
        boolean connected = room.connect(username, session);

        if (connected) {
            logger.info("Player {} connected to map {}. Room now has {} players",
                    username, mapId, room.getPlayerCount());
        } else {
            try {
                Map<String, Object> errorMessage = new HashMap<>();
                errorMessage.put("type", "connection_failed");

                if (room.isFull()) {
                    errorMessage.put("reason", "room_full");
                    errorMessage.put("message", "Room is full (max 4 players)");
                } else if (room.getGameState() == GameState.PLAYING || room.getGameState() == GameState.COUNTDOWN) {
                    errorMessage.put("reason", "game_in_progress");
                    errorMessage.put("message", "Cannot join - game is in progress");
                } else {
                    errorMessage.put("reason", "unknow");
                    errorMessage.put("message", "Unable to join room");
                }

                String json = objectMapper.writeValueAsString(errorMessage);
                session.getBasicRemote().sendText(json);
                session.close();
            } catch (IOException e) {
                logger.error("Error sending connection failed message to player {}: {}", username, e.getMessage());
            }
        }

        return connected;
    }

    public void disconnect(String username, String mapId) {
        GameRoom room = gameRooms.get(mapId);
        if (room != null) {
            room.disconnect(username);
            logger.info("Player {} disconnected from map {}. Room now has {} players.",
                    username, mapId, room.getPlayerCount());
        }
    }

    public void disconnectBySession(Session session) {
        String username = (String) session.getUserProperties().get("username");
        String mapId = (String) session.getUserProperties().get("mapId");

        if (username != null && mapId != null) {
            disconnect(username, mapId);
        } else {
            logger.warn("Could not find username or mapId for session during disconnect");
        }
    }

    public void handleMessage(String username, String mapId, String messageType, Map<String, Object> data) {
        GameRoom room = gameRooms.get(mapId);
        if (room != null) {
            room.handleMessage(username, messageType, data);
        } else {
            logger.warn("Received message for non-existent room: {}", mapId);
        }
    }

    public int getActiveRoomCount() {
        return gameRooms.size();
    }

    public int getTotalPlayerCount() {
        return gameRooms.values().stream()
                .mapToInt(GameRoom::getPlayerCount)
                .sum();
    }

    public Map<String, Integer> getRoomStats() {
        Map<String, Integer> stats = new ConcurrentHashMap<>();
        gameRooms.forEach((mapId, room) -> stats.put(mapId, room.getPlayerCount()));
        return stats;
    }

    public Map<String, Object> getDetailedRoomStats() {
        Map<String, Object> stats = new ConcurrentHashMap<>();
        gameRooms.forEach((mapId, room) -> {
            Map<String, Object> roomInfo = new HashMap<>();
            roomInfo.put("playerCount", room.getPlayerCount());
            roomInfo.put("maxPlayers", 4);
            roomInfo.put("gameState", room.getGameState().toString());
            roomInfo.put("isFUll", room.isFull());
            stats.put(mapId, roomInfo);
        });

        return stats;
    }

    private void cleanupEmptyRooms() {
        gameRooms.entrySet().removeIf(entry -> {
            GameRoom room = entry.getValue();
            if (room.isEmpty()) {
                logger.info("Cleaning up empty room for map: {}", entry.getKey());
                room.shutdown();
                return true;
            }
            return false;
        });

        if (!gameRooms.isEmpty()) {
            logger.debug("Room cleanup completed. Active rooms: {}, Total players: {}",
                    getActiveRoomCount(), getTotalPlayerCount());
        }
    }

    public void shutdown() {
        logger.info("Shutting down GameService...");

        // Shutdown all rooms
        gameRooms.values().forEach(GameRoom::shutdown);
        gameRooms.clear();

        // Shutdown cleanup service
        cleanupService.shutdown();
        try {
            if (!cleanupService.awaitTermination(5, TimeUnit.SECONDS)) {
                cleanupService.shutdownNow();
            }
        } catch (InterruptedException e) {
            cleanupService.shutdownNow();
            Thread.currentThread().interrupt();
        }

        logger.info("GameService shutdown completed.");
    }
}
