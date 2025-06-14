package fhv.omni.gamelogic.service.game;

import fhv.omni.gamelogic.service.game.enums.GameState;
import fhv.omni.gamelogic.service.shop.ShopServiceClient;
import jakarta.websocket.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class GameRoomCore {
    protected static final int MAX_PLAYERS = 4;
    private final Logger logger = LoggerFactory.getLogger(GameRoomCore.class);
    private final String mapId;
    private final Map<String, Session> players = new ConcurrentHashMap<>();
    private final Map<String, PlayerState> playerStates = new ConcurrentHashMap<>();
    private final Map<String, Boolean> playerReadyStatus = new ConcurrentHashMap<>();
    private final List<SpawnPoint> spawnPoints = new ArrayList<>();
    private final Random random = new Random();
    private final ShopServiceClient shopServiceClient;
    protected GameState gameState = GameState.WAITING;

    public GameRoomCore(String mapId, ShopServiceClient shopServiceClient) {
        this.mapId = mapId;
        this.shopServiceClient = shopServiceClient;
        initializeSpawnPoints();
    }

    private void initializeSpawnPoints() {
        // Default map dimensions
        float mapWidth = 1284.0f;
        float mapHeight = 1120.0f;

        // Create spawn points based on map ID
        if ("map3".equals(mapId)) {
            // Specific spawn points for map3
            spawnPoints.add(new SpawnPoint(200, 200));
            spawnPoints.add(new SpawnPoint(1000, 200));
            spawnPoints.add(new SpawnPoint(200, 900));
            spawnPoints.add(new SpawnPoint(1000, 900));
            spawnPoints.add(new SpawnPoint(600, 500));
        } else {
            // Default spawn points for other maps
            // Create spawn points at various positions around the map
            int spawnCount = 10;
            float margin = 100;

            for (int i = 0; i < spawnCount; i++) {
                float x = margin + random.nextFloat() * (mapWidth - margin * 2);
                float y = margin + random.nextFloat() * (mapHeight - margin * 2);
                spawnPoints.add(new SpawnPoint(x, y));
            }
        }
    }

    private SpawnPoint getRandomSpawnPoint() {
        if (spawnPoints.isEmpty()) {
            // Fallback to center of map if no spawn points
            return new SpawnPoint(642, 560);
        }

        int randomIndex = random.nextInt(spawnPoints.size());
        return spawnPoints.get(randomIndex);
    }

    public synchronized boolean connect(String username, Session session) {
        boolean isExistingPlayer = playerStates.containsKey(username);

        handleExistingSession(username, session, isExistingPlayer);

        if (!validateConnection(username, isExistingPlayer)) {
            return false;
        }

        players.put(username, session);

        if (!isExistingPlayer) {
            initializeNewPlayer(username);
        } else {
            handleReconnection(username);
        }

        return true;
    }

    public synchronized void disconnect(String username) {
        Session session = players.remove(username);

        if (session != null) {
            try {
                if (session.isOpen()) {
                    session.close();
                }
            } catch (Exception e) {
                logger.error("Error closing session for {}: {}", username, e.getMessage());
            }
        }

        playerStates.remove(username);
        playerReadyStatus.remove(username);
    }

    public void forceDisconnectAll() {
        players.forEach((username, session) -> {
            try {
                if (session.isOpen()) {
                    session.close();
                }
            } catch (Exception e) {
                logger.warn("Error force closing session for {}: {}", username, e.getMessage());
            }
        });

        players.clear();
        playerStates.clear();
        playerReadyStatus.clear();
    }

    public void handleReadyToggle(String username) {
        if (gameState != GameState.WAITING) {
            return;
        }

        boolean currentReady = playerReadyStatus.getOrDefault(username, false);
        playerReadyStatus.put(username, !currentReady);
    }

    public boolean allPlayersReady() {
        return players.keySet().stream()
                .allMatch(username -> playerReadyStatus.getOrDefault(username, false));
    }

    public void updatePlayerPosition(String username, double x, double y, double vx, double vy, boolean flipX) {
        if (gameState != GameState.PLAYING) {
            return;
        }

        PlayerState state = playerStates.get(username);

        if (state != null && !state.isDead()) {
            state.setX((float) x);
            state.setY((float) y);
            state.setVx((float) vx);
            state.setVy((float) vy);
            state.setFlipX(flipX);
        }
    }

    public void resetPlayerStates() {
        playerStates.forEach((username, state) -> {
            state.reset();
            SpawnPoint spawnPoint = getRandomSpawnPoint();
            state.setPosition(
                    spawnPoint.x(),
                    spawnPoint.y()
            );
        });
    }

    public String getMapId() {
        return mapId;
    }

    // Getters

    public int getPlayerCount() {
        return players.size();
    }

    public boolean isEmpty() {
        return players.isEmpty();
    }

    public boolean isFull() {
        return players.size() >= MAX_PLAYERS;
    }

    public GameState getGameState() {
        return gameState;
    }

    public Map<String, Session> getPlayers() {
        return new HashMap<>(players);
    }

    public Map<String, PlayerState> getPlayerStates() {
        return new HashMap<>(playerStates);
    }

    public Map<String, Boolean> getPlayerReadyStatus() {
        return new HashMap<>(playerReadyStatus);
    }

    /**
     * Sets spawn points from client data
     *
     * @param spawnPointsData List of maps containing spawn point data with x and y coordinates
     */
    public void setSpawnPoints(List<Map<String, Object>> spawnPointsData) {
        if (spawnPointsData == null || spawnPointsData.isEmpty()) {
            return;
        }

        // Clear existing spawn points
        spawnPoints.clear();

        // Add new spawn points from the provided data
        for (Map<String, Object> pointData : spawnPointsData) {
            try {
                float x = ((Number) pointData.getOrDefault("x", 0.0)).floatValue();
                float y = ((Number) pointData.getOrDefault("y", 0.0)).floatValue();
                spawnPoints.add(new SpawnPoint(x, y));
            } catch (Exception e) {
                logger.error("Error processing spawn point data: {}", e.getMessage());
            }
        }

        logger.info("Updated spawn points: {} points set", spawnPoints.size());
    }

    private void handleExistingSession(String username, Session session, boolean isExistingPlayer) {
        if (isExistingPlayer && players.containsKey(username)) {
            Session existingSession = players.get(username);
            if (existingSession != null && existingSession.isOpen() && !existingSession.equals(session)) {
                logger.info("Closing existing session for reconnecting player: {}", username);
                try {
                    existingSession.close();
                } catch (IOException e) {
                    logger.warn("Error closing existing session for {}: {}", username, e.getMessage());
                }
            }
        }
    }

    private boolean validateConnection(String username, boolean isExistingPlayer) {
        if (!isExistingPlayer && players.size() >= MAX_PLAYERS) {
            logger.warn("Cannot connect {} - room is full ({}/{})", username, players.size(), MAX_PLAYERS);
            return false;
        }

        if (!isExistingPlayer && (gameState == GameState.PLAYING || gameState == GameState.COUNTDOWN)) {
            logger.warn("Cannot connect {} - game in progress (state: {})", username, gameState);
            return false;
        }

        return true;
    }

    private void initializeNewPlayer(String username) {
        playerReadyStatus.put(username, false);
        SpawnPoint spawnPoint = getRandomSpawnPoint();

        String playerSkin = shopServiceClient.getPlayerSkin(username);
        logger.info("Fetched skin for player {}: {}", username, playerSkin);

        PlayerState state = new PlayerState(
                spawnPoint.x(),
                spawnPoint.y(),
                0f, 0f, false,
                playerSkin
        );

        playerStates.put(username, state);
    }

    private void handleReconnection(String username) {
        logger.info("Player {} reconnected to room {}", username, mapId);

        PlayerState state = playerStates.get(username);
        if (state != null) {
            String playerSkin = shopServiceClient.getPlayerSkin(username);
            state.setSkin(playerSkin);
            logger.info("Updated skin for reconnected player {}: {}", username, playerSkin);
        }
    }

    private record SpawnPoint(float x, float y) {
    }
}
