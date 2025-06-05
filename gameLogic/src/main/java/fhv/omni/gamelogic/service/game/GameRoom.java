package fhv.omni.gamelogic.service.game;

import fhv.omni.gamelogic.service.game.enums.GameState;
import jakarta.websocket.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

import static fhv.omni.gamelogic.service.game.JsonUtils.objectMapper;

public class GameRoom {
    private final Logger logger = LoggerFactory.getLogger(GameRoom.class);
    private final String mapId;
    private final Map<String, Session> players = new ConcurrentHashMap<>();
    private final Map<String, PlayerState> playerStates = new ConcurrentHashMap<>();
    private final Map<String, Boolean> playerReadyStatus = new ConcurrentHashMap<>();
    private final List<ProjectileState> projectiles = new ArrayList<>();
    private final GameStats gameStats = new GameStats();
    
    // Message queuing per session to prevent TEXT_FULL_WRITING errors
    private final Map<String, BlockingQueue<String>> messageQueues = new ConcurrentHashMap<>();
    private final Map<String, AtomicBoolean> sendingInProgress = new ConcurrentHashMap<>();
    private final Map<String, ExecutorService> playerExecutors = new ConcurrentHashMap<>();

    private GameState gameState = GameState.WAITING;
    private int countdownSeconds = 0;
    private long gameStartTime = 0;
    private long lastCountdownUpdate = 0;
    private long lastTimeUpdate = 0;
    private long lastGameStateUpdate = 0;
    private static final int MAX_PLAYERS = 4;
    private static final int COUNTDOWN_DURATION = 5;
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
        long currentTime = System.currentTimeMillis();
        
        // Only update countdown once per second
        if (currentTime - lastCountdownUpdate >= 1000) {
            lastCountdownUpdate = currentTime;
            countdownSeconds--;
            logger.debug("Countdown update: {} seconds remaining", countdownSeconds);
            broadcastCountdown(countdownSeconds);

            if (countdownSeconds <= 0) {
                logger.info("Countdown reached 0, triggering game start...");
                startGame();
            }
        }
    }

    private void updateGame() {
        updateProjectiles();
        
        long currentTime = System.currentTimeMillis();
        
        // Only broadcast game state every 100ms (10 FPS instead of 60 FPS)
        if (currentTime - lastGameStateUpdate >= 100) {
            lastGameStateUpdate = currentTime;
            broadcastGameState();
        }

        // Only broadcast time remaining once per second
        if (currentTime - lastTimeUpdate >= 1000) {
            lastTimeUpdate = currentTime;
            broadcastTimeRemaining();
        }
    }

    private void checkGameEndConditions() {
        if (System.currentTimeMillis() - gameStartTime > GAME_DURATION_MS) {
            endGame("Time limit reached");
            return;
        }

        // Check if less than 2 players are connected (not just alive)
        if (players.size() < 2) {
            endGame("Not enough players remaining");
            return;
        }

        // Check if only one player is alive (others are dead but still connected)
        long alivePlayers = playerStates.values().stream()
                .filter(state -> !state.isDead())
                .count();

        if (alivePlayers <= 1 && players.size() > 1) {
            endGame("Only one player remaining");
        }
    }

    private void startGame() {
        logger.info("Starting game in room: {} with {} players", mapId, players.size());
        logger.info("Connected players: {}", players.keySet());
        
        gameState = GameState.PLAYING;
        gameStartTime = System.currentTimeMillis();
        gameStats.reset();

        logger.info("Resetting player states...");
        playerStates.forEach((username, state) -> {
            logger.debug("Resetting state for player: {}", username);
            state.reset();
            state.setPosition(
                    200 + (float) (Math.random() * 400),
                    200 + (float) (Math.random() * 200)
            );
        });

        logger.info("Broadcasting game started message...");
        broadcastGameStarted();
        logger.info("Game start process completed for room: {}", mapId);
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

        for (String username : playersToKick) {
            disconnect(username);
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
                String targetUsername = entry.getKey();
                PlayerState targetState = entry.getValue();

                if (targetUsername.equals(projectile.getOwnerId()) || targetState.isDead()) {
                    continue;
                }

                float playerX = targetState.getX();
                float playerY = targetState.getY();
                float playerHitY = playerY + 4.0f;

                if (projectile.isInRangeOf(playerX, playerHitY, PROJECTILE_HIT_RADIUS)) {
                    boolean died = targetState.takeDamage(1);

                    if (died) {
                        gameStats.recordKill(projectile.getOwnerId(), targetUsername);
                    }

                    broadcastDamageEvent(targetUsername, targetState.getHealth(), died);

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

    public boolean connect(String username, Session session) {
        boolean isExistingPlayer = playerStates.containsKey(username);
        
        if (!isExistingPlayer && players.size() >= MAX_PLAYERS) {
            logger.warn("Player {} tried to join full room {}", username, mapId);
            return false;
        }

        if (!isExistingPlayer && (gameState == GameState.PLAYING || gameState == GameState.COUNTDOWN)) {
            logger.warn("New player {} tried to join room {} during game", username, mapId);
            return false;
        }

        if (isExistingPlayer) {
            logger.info("Existing player {} reconnecting to room {}", username, mapId);
        }

        logger.info("Player connected to map {}: {}", mapId, username);
        players.put(username, session);
        
        if (!isExistingPlayer) {
            // New player - initialize everything
            playerReadyStatus.put(username, false);
            PlayerState state = new PlayerState(
                    200 + (float) (Math.random() * 400),
                    200 + (float) (Math.random() * 200),
                    0f, 0f, false
            );
            playerStates.put(username, state);
            broadcastPlayerJoined(username);
        } else {
            // Existing player reconnecting - keep their state but update session
            logger.info("Preserving existing state for reconnecting player: {}", username);
        }

        sendPlayerList(username);
        sendGameState(username);  // Send current game state to reconnecting player
        broadcastRoomStatus();

        return true;
    }

    public void disconnect(String username) {
        logger.info("Player disconnected from map {}: {} (Game state: {})", mapId, username, gameState);
        logger.info("Players before disconnect: {}", players.keySet());
        Session session = players.remove(username);

        if (session != null) {
            try {
                session.close();
            } catch (IOException e) {
                logger.error("Error closing session for player {}: {}", username, e.getMessage());
            }
        }

        playerStates.remove(username);
        playerReadyStatus.remove(username);
        
        // Clean up message queue resources
        messageQueues.remove(username);
        sendingInProgress.remove(username);
        
        // Shutdown player-specific executor
        ExecutorService executor = playerExecutors.remove(username);
        if (executor != null) {
            executor.shutdown();
        }
        
        broadcastPlayerLeft(username);

        if (gameState == GameState.COUNTDOWN) {
            // During countdown, always cancel if someone leaves
            logger.info("Player left during countdown, canceling countdown");
            cancelCountdown();
        } else if (gameState == GameState.PLAYING) {
            checkGameEndConditions();
        }

        broadcastRoomStatus();
    }

    public void handleMessage(String username, String messageType, Map<String, Object> data) {
        switch (messageType) {
            case "join_game":
                // Already handled in connect method
                break;
            case "ready_toggle":
                handleReadyToggle(username);
                break;
            case "position":
                handlePositionUpdate(username, data);
                break;
            case "attack":
                handleAttack(username, data);
                break;
            case "chat_message":
                handleChatMessage(username, data);
                break;
            case "heal":
                handleHeal(username, data);
                break;
            case "damage":
                handleDamage(username, data);
                break;
            case "heartbeat":
                // Heartbeat to keep connection alive - no action needed
                logger.debug("Heartbeat received from player: {}", username);
                break;
            default:
                logger.warn("Unknown message type: {} for player: {}", messageType, username);
        }
    }

    private void handleReadyToggle(String username) {
        if (gameState != GameState.WAITING) {
            return;
        }

        boolean currentReady = playerReadyStatus.getOrDefault(username, false);
        playerReadyStatus.put(username, !currentReady);

        logger.info("Player {} set ready status to {} in room {}", username, !currentReady, mapId);

        broadcastRoomStatus();

        if (players.size() >= 2 && allPlayersReady()) {
            startCountdown();
        }
    }

    private void handlePositionUpdate(String username, Map<String, Object> data) {
        if (gameState != GameState.PLAYING) {
            return;
        }

        try {
            double x = ((Number) data.getOrDefault("x", 0.0)).doubleValue();
            double y = ((Number) data.getOrDefault("y", 0.0)).doubleValue();
            double vx = ((Number) data.getOrDefault("vx", 0.0)).doubleValue();
            double vy = ((Number) data.getOrDefault("vy", 0.0)).doubleValue();
            boolean flipX = (Boolean) data.getOrDefault("flipX", false);

            PlayerState state = playerStates.get(username);
            if (state != null && !state.isDead()) {
                state.setX((float) x);
                state.setY((float) y);
                state.setVx((float) vx);
                state.setVy((float) vy);
                state.setFlipX(flipX);

                broadcastPlayerUpdate(username);
            }
        } catch (Exception e) {
            logger.error("Error processing position update on map {}: {}", mapId, e.getMessage());
        }
    }

    private void handleAttack(String username, Map<String, Object> data) {
        if (gameState != GameState.PLAYING) {
            return;
        }

        try {
            PlayerState attackerState = playerStates.get(username);
            if (attackerState != null && !attackerState.isDead()) {
                float directionX = ((Number) data.getOrDefault("directionX", 0.0)).floatValue();
                float directionY = ((Number) data.getOrDefault("directionY", 0.0)).floatValue();

                createProjectile(username, attackerState.getX(), attackerState.getY(), directionX, directionY);
            }
        } catch (Exception e) {
            logger.error("Error processing attack on map {}: {}", mapId, e.getMessage());
        }
    }

    private void handleChatMessage(String username, Map<String, Object> data) {
        try {
            String message = (String) data.getOrDefault("message", "");
            long timestamp = ((Number) data.getOrDefault("timestamp", System.currentTimeMillis())).longValue();

            if (!message.isBlank()) {
                Map<String, Object> chatPayload = new HashMap<>();
                chatPayload.put("type", "chat_message");
                chatPayload.put("username", username);
                chatPayload.put("message", message);
                chatPayload.put("timestamp", timestamp);
                String json = objectMapper.writeValueAsString(chatPayload);
                broadcastExcept(json, username);
            }
        } catch (Exception e) {
            logger.error("Error processing chat_message on map {}: {}", mapId, e.getMessage());
        }
    }

    private void handleHeal(String username, Map<String, Object> data) {
        try {
            PlayerState playerState = playerStates.get(username);
            if (playerState != null && !playerState.isDead()) {
                int healAmount = ((Number) data.getOrDefault("amount", 1)).intValue();
                boolean wasHealed = playerState.heal(healAmount);
                if (wasHealed) {
                    broadcastHealEvent(username, playerState.getHealth());
                }
            }
        } catch (Exception e) {
            logger.error("Error processing heal: {}", e.getMessage());
        }
    }

    private void handleDamage(String username, Map<String, Object> data) {
        try {
            PlayerState playerState = playerStates.get(username);
            if (playerState != null && !playerState.isDead()) {
                int damageAmount = ((Number) data.getOrDefault("amount", 1)).intValue();
                boolean died = playerState.takeDamage(damageAmount);
                broadcastDamageEvent(username, playerState.getHealth(), died);
            }
        } catch (Exception e) {
            logger.error("Error processing damage: {}", e.getMessage());
        }
    }

    private boolean allPlayersReady() {
        return players.keySet().stream()
                .allMatch(username -> playerReadyStatus.getOrDefault(username, false));
    }

    private void startCountdown() {
        if (gameState != GameState.WAITING) {
            return;
        }

        logger.info("Starting countdown in room {}", mapId);
        gameState = GameState.COUNTDOWN;
        countdownSeconds = COUNTDOWN_DURATION;
        lastCountdownUpdate = System.currentTimeMillis();
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
        players.keySet().forEach(username -> {
            readyStates.put(username, playerReadyStatus.getOrDefault(username, false));
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
        logger.info("Broadcasting game_started to {} players", players.size());
        Map<String, Object> message = new HashMap<>();
        message.put("type", "game_started");
        message.put("gameStartTime", gameStartTime);
        message.put("gameDuration", GAME_DURATION_MS);

        String json = JsonUtils.toJson(message);
        logger.debug("Game started message: {}", json);
        broadcast(json);
        logger.info("Game started broadcast completed");
    }

    private void broadcastTimeRemaining() {
        if (gameState != GameState.PLAYING) {
            return;
        }

        long timeElapsed = System.currentTimeMillis() - gameStartTime;
        long timeRemaining = Math.max(0, GAME_DURATION_MS - timeElapsed);

        Map<String, Object> message = new HashMap<>();
        message.put("type", "time_remaining");
        message.put("timeRemaining", timeRemaining);
        message.put("timeElapsed", timeElapsed);

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

    private void sendPlayerList(String username) {
        Session session = players.get(username);
        if (session == null) {
            return;
        }

        try {
            List<String> playerList = new ArrayList<>(players.keySet());

            Map<String, Object> message = new HashMap<>();
            message.put("type", "player_list");
            message.put("players", playerList);

            String json = JsonUtils.toJson(message);
            queueMessage(username, json);
            
            sendGameState(username);
        } catch (Exception e) {
            logger.error("Error preparing player list for {} on map {}: {}", username, mapId, e.getMessage());
        }
    }

    private void sendGameState(String username) {
        Session session = players.get(username);
        if (session == null) {
            return;
        }

        try {
            Map<String, Object> gameState = createGameStateMessage();
            String json = JsonUtils.toJson(gameState);
            queueMessage(username, json);
        } catch (Exception e) {
            logger.error("Error preparing game state for {} on map {}: {}", username, mapId, e.getMessage());
        }
    }

    private void broadcastGameState() {
        try {
            Map<String, Object> gameState = createGameStateMessage();
            String json = JsonUtils.toJson(gameState);
            // Use our message queue system instead of direct sending
            broadcast(json);
        } catch (Exception e) {
            logger.error("Error broadcasting game state on map {}: {}", mapId, e.getMessage());
        }
    }

    private Map<String, Object> createGameStateMessage() {
        Map<String, Object> gameStateMsg = new HashMap<>();
        gameStateMsg.put("type", "game_state");

        Map<String, Object> states = new HashMap<>();
        playerStates.forEach((username, state) -> {
            Map<String, Object> playerData = new HashMap<>();
            playerData.put("x", state.getX());
            playerData.put("y", state.getY());
            playerData.put("vx", state.getVx());
            playerData.put("vy", state.getVy());
            playerData.put("flipX", state.isFlipX());
            playerData.put("health", state.getHealth());
            playerData.put("isDead", state.isDead());

            states.put(username, playerData);
        });
        gameStateMsg.put("players", states);

        return gameStateMsg;
    }

    private void broadcastPlayerJoined(String username) {
        PlayerState state = playerStates.get(username);
        if (state == null) {
            return;
        }

        Map<String, Object> message = new HashMap<>();
        message.put("type", "player_joined");
        message.put("username", username);
        message.put("x", state.getX());
        message.put("y", state.getY());
        message.put("flipX", state.isFlipX());

        String json = JsonUtils.toJson(message);
        broadcastExcept(json, username);
    }

    private void broadcastPlayerLeft(String username) {
        Map<String, Object> message = new HashMap<>();
        message.put("type", "player_left");
        message.put("username", username);

        String json = JsonUtils.toJson(message);
        broadcast(json);
    }

    private void broadcastDamageEvent(String targetUsername, int currentHealth, boolean died) {
        Map<String, Object> message = new HashMap<>();
        message.put("type", "player_damaged");
        message.put("username", targetUsername);
        message.put("currentHealth", currentHealth);
        message.put("died", died);

        String json = JsonUtils.toJson(message);
        broadcast(json);
    }

    private void broadcastHealEvent(String username, int currentHealth) {
        Map<String, Object> message = new HashMap<>();
        message.put("type", "player_healed");
        message.put("username", username);
        message.put("currentHealth", currentHealth);

        String json = JsonUtils.toJson(message);
        broadcast(json);
    }

    private void createProjectile(String ownerUsername, float x, float y, float directionX, float directionY) {
        ProjectileState projectile = new ProjectileState(ownerUsername, x, y, directionX, directionY);
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

    private void broadcastPlayerUpdate(String username) {
        PlayerState state = playerStates.get(username);
        if (state == null) {
            return;
        }

        Map<String, Object> message = new HashMap<>();
        message.put("type", "player_update");
        message.put("username", username);
        message.put("x", state.getX());
        message.put("y", state.getY());
        message.put("vx", state.getVx());
        message.put("vy", state.getVy());
        message.put("flipX", state.isFlipX());

        String json = JsonUtils.toJson(message);
        broadcastExcept(json, username);
    }

    private void queueMessage(String username, String message) {
        // Get or create resources for this user
        messageQueues.computeIfAbsent(username, k -> new LinkedBlockingQueue<>());
        sendingInProgress.computeIfAbsent(username, k -> new AtomicBoolean(false));
        playerExecutors.computeIfAbsent(username, k -> Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "WebSocket-Sender-" + username);
            t.setDaemon(true);
            return t;
        }));
        
        // Add message to queue
        BlockingQueue<String> queue = messageQueues.get(username);
        if (queue.offer(message)) {
            // Start processing if not already in progress
            if (sendingInProgress.get(username).compareAndSet(false, true)) {
                ExecutorService executor = playerExecutors.get(username);
                if (executor != null && !executor.isShutdown()) {
                    executor.submit(() -> processMessageQueue(username));
                }
            }
        } else {
            logger.warn("Message queue full for player {}, dropping message", username);
        }
    }
    
    private void processMessageQueue(String username) {
        BlockingQueue<String> queue = messageQueues.get(username);
        Session session = players.get(username);
        
        if (queue == null || session == null) {
            sendingInProgress.get(username).set(false);
            return;
        }
        
        try {
            while (!queue.isEmpty() && session.isOpen()) {
                String message = queue.poll();
                if (message != null) {
                    try {
                        // Use synchronous sending for guaranteed order
                        session.getBasicRemote().sendText(message);
                        logger.debug("Message sent to player: {}", username);
                    } catch (IOException e) {
                        logger.warn("Failed to send message to player {}: {}", username, e.getMessage());
                        handleBrokenSession(username);
                        break;
                    } catch (IllegalStateException e) {
                        logger.warn("Session in invalid state for player {}: {}", username, e.getMessage());
                        handleBrokenSession(username);
                        break;
                    }
                }
            }
        } finally {
            sendingInProgress.get(username).set(false);
            
            // Check if more messages arrived while we were processing
            if (!queue.isEmpty() && session.isOpen()) {
                if (sendingInProgress.get(username).compareAndSet(false, true)) {
                    ExecutorService executor = playerExecutors.get(username);
                    if (executor != null && !executor.isShutdown()) {
                        executor.submit(() -> processMessageQueue(username));
                    }
                }
            }
        }
    }

    private synchronized void broadcast(String message) {
        logger.debug("Broadcasting to {} sessions: {}", players.size(), message.substring(0, Math.min(50, message.length())));
        
        // Create a copy of the players map to avoid concurrent modification
        Map<String, Session> currentPlayers = new HashMap<>(players);
        
        for (String username : currentPlayers.keySet()) {
            queueMessage(username, message);
        }
    }

    private synchronized void broadcastExcept(String message, String excludeUsername) {
        // Create a copy of the players map to avoid concurrent modification
        Map<String, Session> currentPlayers = new HashMap<>(players);
        
        for (String username : currentPlayers.keySet()) {
            if (!username.equals(excludeUsername)) {
                queueMessage(username, message);
            }
        }
    }

    private void handleBrokenSession(String username) {
        players.remove(username);
        playerStates.remove(username);
        playerReadyStatus.remove(username);
        
        // Clean up message queue resources
        messageQueues.remove(username);
        sendingInProgress.remove(username);
        
        // Shutdown player-specific executor
        ExecutorService executor = playerExecutors.remove(username);
        if (executor != null) {
            executor.shutdown();
        }

        if (gameState == GameState.COUNTDOWN && !allPlayersReady()) {
            cancelCountdown();
        } else if (gameState == GameState.PLAYING) {
            checkGameEndConditions();
        }

        broadcastRoomStatus();
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
        
        // Shutdown game loop
        gameLoop.shutdown();
        try {
            if (!gameLoop.awaitTermination(5, TimeUnit.SECONDS)) {
                gameLoop.shutdownNow();
            }
        } catch (InterruptedException e) {
            gameLoop.shutdownNow();
            Thread.currentThread().interrupt();
        }
        
        // Shutdown all player executors
        for (ExecutorService executor : playerExecutors.values()) {
            executor.shutdown();
            try {
                if (!executor.awaitTermination(1, TimeUnit.SECONDS)) {
                    executor.shutdownNow();
                }
            } catch (InterruptedException e) {
                executor.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
        
        // Clear all message queues and executors
        messageQueues.clear();
        sendingInProgress.clear();
        playerExecutors.clear();
    }
}
