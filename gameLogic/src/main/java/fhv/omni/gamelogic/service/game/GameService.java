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
        cleanupService.scheduleAtFixedRate(this::cleanupEmptyRooms, 1, 2, TimeUnit.MINUTES);
    }

    public boolean connect(String username, String mapId, Session session) {
        GameRoom room = gameRooms.get(mapId);
        boolean roomRecreated = false;
        
        if (room != null && room.isShuttingDown()) {
            logger.info("Removing shutting down room {} to allow recreation", mapId);
            gameRooms.remove(mapId);
            room = null;
            roomRecreated = true;
        }
        
        if (room == null) {
            logger.info("Creating new game room for map {} (recreation: {})", mapId, roomRecreated);
            room = new GameRoom(mapId);
            gameRooms.put(mapId, room);
        }


        boolean connected = room.connect(username, session);

        if (!connected) {
            logger.warn("Connection failed for {} to room {} - sending failure message", username, mapId);
            sendConnectionFailedMessage(session, room);
        } else {
            logger.info("Successfully connected {} to room {}", username, mapId);
        }

        return connected;
    }

    public void disconnect(String username, String mapId) {
        GameRoom room = gameRooms.get(mapId);
        if (room != null) {
            room.disconnect(username);
        }
    }

    public void disconnectBySession(Session session) {
        String username = (String) session.getUserProperties().get("username");
        String mapId = (String) session.getUserProperties().get("mapId");

        if (username != null && mapId != null) {
            disconnect(username, mapId);
        }
    }

    public void handleMessage(String username, String mapId, String messageType, Map<String, Object> data) {
        GameRoom room = gameRooms.get(mapId);
        if (room != null && !room.isShuttingDown()) {
            room.handleMessage(username, messageType, data);
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

    public Map<String, Object> getDetailedRoomStats() {
        Map<String, Object> stats = new ConcurrentHashMap<>();
        gameRooms.forEach((mapId, room) -> {
            Map<String, Object> roomInfo = new HashMap<>();
            roomInfo.put("playerCount", room.getPlayerCount());
            roomInfo.put("maxPlayers", 4);
            roomInfo.put("gameState", room.getGameState().toString());
            roomInfo.put("isFull", room.isFull());
            stats.put(mapId, roomInfo);
        });

        return stats;
    }

    private void sendConnectionFailedMessage(Session session, GameRoom room) {
        try {
            Map<String, Object> errorMessage = new HashMap<>();
            errorMessage.put("type", "connection_failed");

            if (room.isFull()) {
                errorMessage.put("reason", "room_full");
                errorMessage.put("message", "Room is full (max 4 players)");
            } else if (room.getGameState() == GameState.PLAYING || room.getGameState() == GameState.COUNTDOWN) {
                errorMessage.put("reason", "game_in_progress");
                errorMessage.put("message", "Game is in progress");
            } else {
                errorMessage.put("reason", "unknown");
                errorMessage.put("message", "Unable to join room");
            }

            String json = objectMapper.writeValueAsString(errorMessage);
            session.getBasicRemote().sendText(json);
            session.close();
        } catch (IOException e) {
            logger.error("Error sending connection failed message: {}", e.getMessage());
        }
    }

    private void cleanupEmptyRooms() {

        gameRooms.entrySet().removeIf(entry -> {
            GameRoom room = entry.getValue();
            if (room.isEmpty() || room.isShuttingDown()) {
                logger.info("Cleaning up room {} - empty: {}, shutting down: {}",
                        entry.getKey(), room.isEmpty(), room.isShuttingDown());

                if (!room.isShuttingDown()) {
                    room.shutdown();
                }

                return true;
            }

            return false;
        });

    }

    public void shutdown() {
        logger.info("Shutting down GameService - closing {} rooms",  gameRooms.size());

        gameRooms.values().forEach(GameRoom::shutdown);
        gameRooms.clear();

        cleanupService.shutdown();

        try {
            if (!cleanupService.awaitTermination(5, TimeUnit.SECONDS)) {
                cleanupService.shutdownNow();
            }
        } catch (InterruptedException e) {
            cleanupService.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}
