package fhv.omni.gamelogic.service.game;

import fhv.omni.gamelogic.service.game.enums.GameState;
import jakarta.websocket.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import static fhv.omni.gamelogic.service.game.JsonUtils.objectMapper;

public class GameRoom {
    private final Logger logger = LoggerFactory.getLogger(GameRoom.class);
    private final String mapId;
    private final Map<String, Session> players = new ConcurrentHashMap<>();
    private final Map<String, PlayerState> playerStates = new ConcurrentHashMap<>();
    private final Map<String, Boolean> playerReadyStatus = new ConcurrentHashMap<>();
    private final List<ProjectileState> projectiles = new ArrayList<>();
    private final GameStats gameStats = new GameStats();

    private GameState gameState = GameState.WAITING;
    private int countdownSeconds = 0;
    private long gameStartTime = 0;
    private static final int MAX_PLAYERS = 4;
    private static final int COUNTDOWN_DURATION = 10;
    private static final long GAME_DURATION_MS = 5 * 60 * 1000;

    private static final long TICK_RATE_MS = 1000 / 60;
    private static final float PROJECTILE_HIT_RADIUS = 12.0f;

    private final ScheduledExecutorService gameLoop = Executors.newSingleThreadScheduledExecutor();

    public GameRoom(String mapId) {
        this.mapId = mapId;
        gameLoop.scheduleAtFixedRate(this::update, 0, TICK_RATE_MS, TimeUnit.MILLISECONDS);
        logger.info("GameRoom created for map: {}", mapId);
    }

    private void update() {
        try {
            switch(gameState) {
                case COUNTDOWN:
                    updateCountdown();
                    break;
                case PLAYING:
                    updateGame();
                    checkGameEndConditions();
                    break;
                default:
                    // No updates needed for WAITING or FINISHED
                    break;
            }
        } catch (Exception e) {
            logger.error("Error in game update loop for map {}", mapId, e);
        }
    }

    private void updateCountdown() {
        if (System.currentTimeMillis() % 1000 < TICK_RATE_MS) {
            countdownSeconds--;
            broadcastCountdown(countdownSeconds);

            if (countdownSeconds <= 0) {
                startGame();
            }
        }
    }

    private void updateGame() {
        updateProjectiles();
        broadcastGameState();
    }

    private void checkGameEndConditions() {
        if (System.currentTimeMillis() - gameStartTime > GAME_DURATION_MS) {
            endGame("Time limit reached");
            return;
        }

        long alivePlayers = playerStates.values().stream()
                .filter(state -> !state.isDead())
                .count();

        if (alivePlayers <= 1) {
            endGame("Only one player remaining");
        }
    }

    private void startGame() {
        logger.info("Starting game in room: {}", mapId);
        gameState = GameState.PLAYING;
        gameStartTime = System.currentTimeMillis();
        gameStats.reset();

        playerStates.forEach((playerId, state) -> {
            state.reset();
            state.setPosition(
                    200 + (float) (Math.random() * 400),
                    200 + (float) (Math.random() * 200)
            );
        });

        broadcastGameStarted();
    }

    private void endGame(String reason) {
        if (gameState != GameState.PLAYING) {
            return;
        }

        logger.info("Ending game in room: {}: {}", mapId, reason);
        gameState = GameState.FINISHED;

        gameStats.calculateFinalStats(playerStates);

        broadcastGameEnded(reason, gameStats);

        gameLoop.schedule(this::kickAllPlayers, 10, TimeUnit.SECONDS);
    }

    private void kickAllPlayers() {
        logger.info("Kicking all players from room: {}", mapId);
        List<String> playersToKick = new ArrayList<>(players.keySet());

        for (String playerId : playersToKick) {
            disconnect(playerId);
        }

        resetRoom();
    }

    private void resetRoom() {
        gameState = GameState.WAITING;
        countdownSeconds = 0;
        gameStartTime = 0;
        projectiles.clear();
        gameStats.reset();
        logger.info("Room {} has been reset", mapId);
    }

    private void updateProjectiles() {
        if (gameState != GameState.PLAYING) {
            return;
        }

        long currentTime = System.currentTimeMillis();
        Iterator<ProjectileState> iterator = projectiles.iterator();

        while (iterator.hasNext()) {
            ProjectileState projectile = iterator.next();
            projectile.update();

            if (projectile.hasExpired(currentTime)) {
                iterator.remove();
                broadcastProjectileRemoved(projectile.getId());
                continue;
            }

            boolean hit = false;
            for (Map.Entry<String, PlayerState> entry : playerStates.entrySet()) {
                String targetId = entry.getKey();
                PlayerState targetState = entry.getValue();

                if (targetId.equals(projectile.getOwnerId()) || targetState.isDead()) {
                    continue;
                }

                float playerX = targetState.getX();
                float playerY = targetState.getY();
                float playerHitY = playerY + 4.0f;

                if (projectile.isInRangeOf(playerX, playerHitY, PROJECTILE_HIT_RADIUS)) {
                    boolean died = targetState.takeDamage(1);

                    if (died) {
                        gameStats.recordKill(projectile.getOwnerId(), targetId);
                    }

                    broadcastDamageEvent(targetId, 1, died);

                    hit = true;
                    break;
                }
            }

            if (hit) {
                iterator.remove();
                broadcastProjectileRemoved(projectile.getId());
            }
        }
    }

    public boolean connect(String playerId, Session session) {
        if (players.size() >= MAX_PLAYERS) {
            logger.warn("Player {} tried to join full room {}", playerId, mapId);
            return false;
        }

        if (gameState == GameState.PLAYING ||gameState == GameState.COUNTDOWN) {
            logger.warn("Player {} tried to join room {} during game", playerId, mapId);
            return false;
        }

        logger.info("Player connected to map {}: {}", mapId, playerId);
        players.put(playerId, session);
        playerReadyStatus.put(playerId, false);

        PlayerState state = new PlayerState(
                200 + (float) (Math.random() * 400),
                200 + (float) (Math.random() * 200),
                0f, 0f, false
        );

        playerStates.put(playerId, state);
        sendPlayerList(playerId);
        broadcastPlayerJoined(playerId);
        broadcastRoomStatus();

        return true;
    }

    public void disconnect(String playerId) {
        logger.info("Player disconnected from map {}: {}", mapId, playerId);
        Session session = players.remove(playerId);

        if (session != null) {
            try {
                session.close();
            } catch (IOException e) {
                logger.error("Error closing session for player {}: {}", playerId, e.getMessage());
            }
        }

        playerStates.remove(playerId);
        playerReadyStatus.remove(playerId);
        broadcastPlayerLeft(playerId);

        if (gameState == GameState.COUNTDOWN && !allPlayersReady()) {
            cancelCountdown();
        } else if (gameState == GameState.PLAYING) {
            checkGameEndConditions();
        }

        broadcastRoomStatus();
    }

    public void handleMessage(String playerId, String messageType, Map<String, Object> data) {
        switch (messageType) {
            case "ready_toggle":
                handleReadyToggle(playerId);
                break;
            case "position":
                handlePositionUpdate(playerId, data);
                break;
            case "attack":
                handleAttack(playerId, data);
                break;
            case "chat_message":
                handleChatMessage(playerId, data);
                break;
        }
    }

    private void handleReadyToggle(String playerId) {
        if (gameState == GameState.WAITING) {
            return;
        }

        boolean currentReady = playerReadyStatus.getOrDefault(playerId, false);
        playerReadyStatus.put(playerId, !currentReady);

        logger.info("Player {} set ready status to {} in room {}", playerId, !currentReady, mapId);

        broadcastRoomStatus();

        if (players.size() >= 2 && allPlayersReady()) {
            startCountdown();
        }
    }

    private void handlePositionUpdate(String playerId, Map<String, Object> data) {
        if (gameState != GameState.PLAYING) {
            return;
        }

        try {
            double x = ((Number) data.getOrDefault("x", 0.0)).doubleValue();
            double y = ((Number) data.getOrDefault("y", 0.0)).doubleValue();
            double vx = ((Number) data.getOrDefault("vx", 0.0)).doubleValue();
            double vy = ((Number) data.getOrDefault("vy", 0.0)).doubleValue();
            boolean flipX = (Boolean) data.getOrDefault("flipX", false);

            PlayerState state = playerStates.get(playerId);
            if (state != null && !state.isDead()) {
                state.setX((float) x);
                state.setY((float) y);
                state.setVx((float) vx);
                state.setVy((float) vy);
                state.setFlipX(flipX);

                broadcastPlayerUpdate(playerId);
            }
        } catch (Exception e) {
            logger.error("Error processing position update on map {}: {}", mapId, e.getMessage());
        }
    }

    private void handleAttack(String playerId, Map<String, Object> data) {
        if (gameState != GameState.PLAYING) {
            return;
        }

        try {
            PlayerState attackerState = playerStates.get(playerId);
            if (attackerState != null && !attackerState.isDead()) {
                float directionX = ((Number) data.getOrDefault("directionX", 0.0)).floatValue();
                float directionY = ((Number) data.getOrDefault("directionY", 0.0)).floatValue();

                createProjectile(playerId, attackerState.getX(), attackerState.getY(), directionX, directionY);
            }
        } catch (Exception e) {
            logger.error("Error processing attack on map {}: {}", mapId, e.getMessage());
        }
    }

    private void handleChatMessage(String playerId, Map<String, Object> data) {
        try {
            String userName = (String) data.getOrDefault("userName", "Unknown");
            String message = (String) data.getOrDefault("message", "");
            long timestamp = ((Number) data.getOrDefault("timestamp", System.currentTimeMillis())).longValue();

            if (!message.isBlank()) {
                Map<String, Object> chatPayload = new HashMap<>();
                chatPayload.put("type", "chat_message");
                chatPayload.put("userName", userName);
                chatPayload.put("message", message);
                chatPayload.put("timestamp", timestamp);
                String json = objectMapper.writeValueAsString(chatPayload);
                broadcastExcept(json, playerId);
            }
        } catch (Exception e) {
            logger.error("Error processing chat_message on map {}: {}", mapId, e.getMessage());
        }
    }

    private boolean allPlayersReady() {
        return players.keySet().stream()
                .allMatch(playerId -> playerReadyStatus.getOrDefault(playerId, false));
    }

    private void startCountdown() {
        if (gameState != GameState.WAITING) {
            return;
        }

        logger.info("Starting countdown in room {}", mapId);
        gameState = GameState.COUNTDOWN;
        countdownSeconds = COUNTDOWN_DURATION;
        broadcastCountdownStarted();
    }

    private void cancelCountdown() {
        if (gameState != GameState.COUNTDOWN) {
            return;
        }

        logger.info("Cancelling countdown in room {}", mapId);
        gameState = GameState.WAITING;
        countdownSeconds = 0;
        broadcastCountdownCancelled();
    }

    // Broadcasting methods
    private void broadcastRoomStatus() {
        Map<String, Object> message = new HashMap<>();
        message.put("type", "room_status");
        message.put("gameState", gameState.toString());
        message.put("playerCount", players.size());
        message.put("maxPlayers", MAX_PLAYERS);

        Map<String, Boolean> readyStates = new HashMap<>();
        players.keySet().forEach(playerId -> {
            readyStates.put(playerId, playerReadyStatus.getOrDefault(playerId, false));
        });
        message.put("readyStates", readyStates);

        String json = JsonUtils.toJson(message);
        broadcast(json);
    }

    private void broadcastCountdownStarted() {
        Map<String, Object> message = new HashMap<>();
        message.put("type", "countdown_started");
        message.put("duration", COUNTDOWN_DURATION);

        String json = JsonUtils.toJson(message);
        broadcast(json);
    }

    private void broadcastCountdown(int seconds) {
        Map<String, Object> message = new HashMap<>();
        message.put("type", "countdown");
        message.put("seconds", seconds);

        String json = JsonUtils.toJson(message);
        broadcast(json);
    }

    private void broadcastCountdownCancelled() {
        Map<String, Object> message = new HashMap<>();
        message.put("type", "countdown_cancelled");

        String json = JsonUtils.toJson(message);
        broadcast(json);
    }

    private void broadcastGameStarted() {
        Map<String, Object> message = new HashMap<>();
        message.put("type", "game_started");
        message.put("gameStartTime", gameStartTime);
        message.put("gameDuration", GAME_DURATION_MS);

        String json = JsonUtils.toJson(message);
        broadcast(json);
    }

    private void broadcastGameEnded(String reason, GameStats stats) {
        Map<String, Object> message = new HashMap<>();
        message.put("type", "game_ended");
        message.put("reason", reason);
        message.put("stats", stats.getStatsAsMap());

        String json = JsonUtils.toJson(message);
        broadcast(json);
    }

    private void sendPlayerList(String playerId) {
        Session session = players.get(playerId);
        if (session == null) {
            return;
        }

        try {
            List<String> playerList = new ArrayList<>(players.keySet());

            Map<String, Object> message = new HashMap<>();
            message.put("type", "player_list");
            message.put("players", playerList);

            String json = JsonUtils.toJson(message);
            session.getBasicRemote().sendText(json);

            sendGameState(playerId);
        } catch (IOException e) {
            logger.error("Error sending player list to {} on map {}: {}", playerId, mapId, e.getMessage());
        }
    }

    private void sendGameState(String playerId) {
        Session session = players.get(playerId);
        if (session == null) {
            return;
        }

        try {
            Map<String, Object> gameState = createGameStateMessage();
            String json = JsonUtils.toJson(gameState);
            session.getBasicRemote().sendText(json);
        } catch (IOException e) {
            logger.error("Error sending game state to {} on map {}: {}", playerId, mapId, e.getMessage());
        }
    }

    private void broadcastGameState() {
        try {
            Map<String, Object> gameState = createGameStateMessage();
            String json = JsonUtils.toJson(gameState);

            for (Session session : players.values()) {
                try {
                    session.getBasicRemote().sendText(json);
                } catch (IOException e) {
                    logger.error("Error sending game state to player on map {}: {}", mapId, e.getMessage());
                }
            }
        } catch (Exception e) {
            logger.error("Error broadcasting game state on map {}: {}", mapId, e.getMessage());
        }
    }

    private Map<String, Object> createGameStateMessage() {
        Map<String, Object> gameStateMsg = new HashMap<>();
        gameStateMsg.put("type", "game_state");

        Map<String, Object> states = new HashMap<>();
        playerStates.forEach((id, state) -> {
            Map<String, Object> playerData = new HashMap<>();
            playerData.put("x", state.getX());
            playerData.put("y", state.getY());
            playerData.put("vx", state.getVx());
            playerData.put("vy", state.getVy());
            playerData.put("flipX", state.isFlipX());
            playerData.put("health", state.getHealth());
            playerData.put("isDead", state.isDead());

            states.put(id, playerData);
        });
        gameStateMsg.put("players", states);

        return gameStateMsg;
    }

    private void broadcastPlayerJoined(String playerId) {
        PlayerState state = playerStates.get(playerId);
        if (state == null) {
            return;
        }

        Map<String, Object> message = new HashMap<>();
        message.put("type", "player_joined");
        message.put("playerId", playerId);
        message.put("x", state.getX());
        message.put("y", state.getY());
        message.put("flipX", state.isFlipX());

        String json = JsonUtils.toJson(message);

        broadcastExcept(json, playerId);
    }

    private void broadcastPlayerLeft(String playerId) {
        Map<String, Object> message = new HashMap<>();
        message.put("type", "player_left");
        message.put("playerId", playerId);

        String json = JsonUtils.toJson(message);
        broadcast(json);
    }

    private void broadcast(String message) {
        for (Session session : players.values()) {
            try {
                session.getBasicRemote().sendText(message);
            } catch (IOException e) {
                logger.error("Error broadcasting player on map {}: {}", mapId, e.getMessage());
            }
        }
    }

    private void broadcastExcept(String message, String excludePlayerId) {
        for (Map.Entry<String, Session> entry : players.entrySet()) {
            if (!entry.getKey().equals(excludePlayerId)) {
                Session session = entry.getValue();
                if (session.isOpen()) {
                    try {
                        entry.getValue().getBasicRemote().sendText(message);
                    } catch (IOException e) {
                        logger.error("Error broadcasting message on map {}: {}", mapId, e.getMessage());
                    } catch (IllegalStateException e) {
                        logger.warn("Session is closed for player {} on map {}", entry.getKey(), mapId);
                        handleBrokenSession(entry.getKey());
                    }
                } else {
                    logger.debug("Skipping closed session for player {} on map {}", entry.getKey(), mapId);
                    handleBrokenSession(entry.getKey());
                }
            }
        }
    }

    private void handleBrokenSession(String playerId) {
        players.remove(playerId);
        playerStates.remove(playerId);
        playerReadyStatus.remove(playerId);

        if (gameState == GameState.COUNTDOWN && !allPlayersReady()) {
            cancelCountdown();
        } else if (gameState == GameState.PLAYING) {
            checkGameEndConditions();
        }

        broadcastRoomStatus();
    }

    private void broadcastDamageEvent(String targetId, int amount, boolean died) {
        Map<String, Object> message = new HashMap<>();
        message.put("type", "player_damaged");
        message.put("playerId", targetId);
        message.put("damage", amount);
        message.put("died", died);

        String json = JsonUtils.toJson(message);
        broadcast(json);
    }

    private void createProjectile(String ownerId, float x, float y, float directionX, float directionY) {
        ProjectileState projectile = new ProjectileState(ownerId, x, y, directionX, directionY);
        projectiles.add(projectile);
        broadcastProjectileCreated(projectile);
    }

    private void broadcastProjectileCreated(ProjectileState projectile) {
        Map<String, Object> message = new HashMap<>();
        message.put("type", "projectile_created");
        message.put("id", projectile.getId());
        message.put("ownerId", projectile.getOwnerId());
        message.put("x", projectile.getX());
        message.put("y", projectile.getY());
        message.put("directionX", projectile.getDirectionX());
        message.put("directionY", projectile.getDirectionY());

        String json = JsonUtils.toJson(message);
        broadcast(json);
    }

    private void broadcastProjectileRemoved(String projectileId) {
        Map<String, Object> message = new HashMap<>();
        message.put("type", "projectile_removed");
        message.put("id", projectileId);

        String json = JsonUtils.toJson(message);
        broadcast(json);
    }

    private void broadcastPlayerUpdate(String playerId) {
        PlayerState state = playerStates.get(playerId);
        if (state == null) {
            return;
        }

        Map<String, Object> message = new HashMap<>();
        message.put("type", "player_update");
        message.put("playerId", playerId);
        message.put("x", state.getX());
        message.put("y", state.getY());
        message.put("vx", state.getVx());
        message.put("vy", state.getVy());
        message.put("flipX", state.isFlipX());

        String json = JsonUtils.toJson(message);
        broadcastExcept(json, playerId);
    }

    // Getters
    public String getMapId() {
        return mapId;
    }

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

    public void shutdown() {
        logger.info("Shutting down GameRoom for map: {}", mapId);
        gameLoop.shutdown();
        try {
            if (!gameLoop.awaitTermination(5, TimeUnit.SECONDS)) {
                gameLoop.shutdownNow();
            }
        } catch (InterruptedException e) {
            gameLoop.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}
