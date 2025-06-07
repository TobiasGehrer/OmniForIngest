package fhv.omni.gamelogic.service.game;

import fhv.omni.gamelogic.service.game.enums.GameState;
import jakarta.websocket.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Main GameRoom class
 */
public class GameRoom {
    private final Logger logger = LoggerFactory.getLogger(GameRoom.class);
    private final GameRoomCore core;
    private final GameRoomMessaging messaging;
    private final CombatSystem combatSystem;

    private final ScheduledExecutorService gameLoop = Executors.newSingleThreadScheduledExecutor();
    private static final long TICK_RATE_MS = 1000 / 60;
    private static final int COUNTDOWN_DURATION = 5;
    private static final long GAME_DURATION_MS = 5 * 60 * 1000;

    private int countdownSeconds = 0;
    private long gameStartTime = 0;
    private long lastCountdownUpdate = 0;
    private long lastTimeUpdate = 0;
    private long lastGameStateUpdate = 0;

    private final AtomicBoolean isShuttingDown = new AtomicBoolean(false);

    public GameRoom(String mapId) {
        this.core = new GameRoomCore(mapId);
        this.messaging = new GameRoomMessaging(core);
        this.combatSystem = new CombatSystem(core, messaging);

        gameLoop.scheduleAtFixedRate(this::update, 0, TICK_RATE_MS, TimeUnit.MILLISECONDS);
    }

    private void update() {
        if (isShuttingDown.get()) {
            return;
        }

        try {
            switch (core.getGameState()) {
                case COUNTDOWN -> updateCountdown();
                case PLAYING -> updateGame();
                default -> {} // No updates for WAITING or FINISHED
            }
        } catch (Exception e) {
            logger.error("Error in game update loop for map {}", core.getMapId(), e);
        }
    }

    private void updateCountdown() {
        long currentTime = System.currentTimeMillis();

        if (currentTime - lastCountdownUpdate >= 1000) {
            lastCountdownUpdate = currentTime;
            countdownSeconds--;
            broadcastCountdown(countdownSeconds);

            if (countdownSeconds <= 0) {
                startGame();
            }
        }
    }

    private void updateGame() {
        combatSystem.updateProjectiles();
        
        long currentTime = System.currentTimeMillis();

        if (currentTime - lastGameStateUpdate >= 100) {
            lastGameStateUpdate = currentTime;
            messaging.broadcastGameState();
        }

        if (currentTime - lastTimeUpdate >= 1000) {
            lastTimeUpdate = currentTime;
            broadcastTimeRemaining();
        }

        checkGameEndConditions();
    }

    public boolean connect(String username, Session session) {
        if (isShuttingDown.get()) {
            logger.warn("Connection rejected for {} - room {} is shutting down", username, core.getMapId());
            return false;
        }

        // Check if player exists before connecting
        boolean isExistingPlayer = core.getPlayerStates().containsKey(username);
        
        boolean connected = core.connect(username, session);

        if (connected) {
            
            // Always broadcast player_joined for all players when room is recreated
            // This ensures all clients can see each other regardless of connection order
            broadcastPlayerJoined(username);

            // Send current state to the connecting player
            sendPlayerList(username);
            sendGameState(username);
            
            // Notify all players about room status changes
            messaging.broadcastRoomStatus();
            
        } else {
            logger.warn("Connection failed for player {} to room {}", username, core.getMapId());
        }

        return connected;
    }

    public void disconnect(String username) {
        core.disconnect(username);
        messaging.cleanup(username);
        broadcastPlayerLeft(username);

        if (core.getGameState() == GameState.COUNTDOWN) {
            cancelCountdown();
        } else if (core.getGameState() == GameState.PLAYING) {
            checkGameEndConditions();
        }

        messaging.broadcastRoomStatus();

        if (core.isEmpty() && isShuttingDown.compareAndSet(false, true)) {
            logger.info("Room {} is empty, scheduling shutdown", core.getMapId());
            gameLoop.schedule(this::shutdown, 1, TimeUnit.SECONDS);
        }
    }

    public void handleMessage(String username, String messageType, Map<String, Object> data) {
        if (isShuttingDown.get()) {
            return;
        }


        switch (messageType) {
            case "join_game" -> {} // Already handled
            case "ready_toggle" -> handleReadyToggle(username);
            case "position" -> handlePositionUpdate(username, data);
            case "attack" -> combatSystem.handleAttack(username, data);
            case "chat_message" -> handleChatMessage(username, data);
            case "heal" -> combatSystem.handleHeal(username, data);
            case "damage" -> combatSystem.handleDamage(username, data);
            case "heartbeat" -> {} // No action needed
            default -> logger.warn("Unknown message type: {}", messageType);
        }
    }

    private void handleReadyToggle(String username) {
        core.handleReadyToggle(username);
        messaging.broadcastRoomStatus();

        if (core.getPlayerCount() >= 2 && core.allPlayersReady()) {
            startCountdown();
        }
    }

    private void handlePositionUpdate(String username, Map<String, Object> data) {
        if (core.getGameState() != GameState.PLAYING) {
            return;
        }
        
        try {
            double x = ((Number) data.getOrDefault("x", 0.0)).doubleValue();
            double y = ((Number) data.getOrDefault("y", 0.0)).doubleValue();
            double vx = ((Number) data.getOrDefault("vx", 0.0)).doubleValue();
            double vy = ((Number) data.getOrDefault("vy", 0.0)).doubleValue();
            boolean flipX = (Boolean) data.getOrDefault("flipX", false);

            core.updatePlayerPosition(username, x, y, vx, vy, flipX);
            broadcastPlayerUpdate(username);
        } catch (Exception e) {
            logger.error("Error processing position update: {}", e.getMessage());
        }
    }

    private void handleChatMessage(String username, Map<String, Object> data) {
        try {
            String message = (String) data.getOrDefault("message", "");
            long timestamp = ((Number) data.getOrDefault("timestamp", System.currentTimeMillis())).longValue();

            if (!message.isEmpty()) {
                Map<String, Object> chatPayload = new HashMap<>();
                chatPayload.put("type", "chat_message");
                chatPayload.put("username", username);
                chatPayload.put("message", message);
                chatPayload.put("timestamp", timestamp);

                messaging.broadcastExcept(JsonUtils.toJson(chatPayload), username);
            }
        } catch (Exception e) {
            logger.error("Error processing chat message: {}", e.getMessage());
        }
    }

    private void startCountdown() {
        if (core.gameState != GameState.WAITING) {
            return;
        }

        core.gameState = GameState.COUNTDOWN;
        countdownSeconds = COUNTDOWN_DURATION;
        lastCountdownUpdate = System.currentTimeMillis();
        broadcastCountdownStarted();
    }

    private void cancelCountdown() {
        if (core.gameState != GameState.COUNTDOWN) {
            return;
        }

        core.gameState = GameState.WAITING;
        countdownSeconds = 0;
        broadcastCountdownCancelled();
    }

    private void startGame() {
        logger.info("Starting game in room {} - transitioning to PLAYING state", core.getMapId());
        core.gameState = GameState.PLAYING;
        gameStartTime = System.currentTimeMillis();
        combatSystem.reset();
        core.resetPlayerStates();
        broadcastGameStarted();
        logger.info("Game started in room {} - now in {} state with {} players", 
                   core.getMapId(), core.getGameState(), core.getPlayerCount());
    }

    private void checkGameEndConditions() {
        if (System.currentTimeMillis() - gameStartTime > GAME_DURATION_MS) {
            endGame("Time limit reached");
            return;
        }

        if (core.getPlayerCount() < 2) {
            endGame("Not enough players remaining");
            return;
        }

        long alivePlayers = core.getPlayerStates().values().stream()
                .filter(state -> !state.isDead())
                .count();


        if (alivePlayers <= 1 && core.getPlayerCount() > 1) {
            logger.info("Game ending - only {} alive players remaining out of {}", alivePlayers, core.getPlayerCount());
            core.getPlayerStates().forEach((username, state) -> 
                logger.info("Player {} - Health: {}, Dead: {}", username, state.getHealth(), state.isDead()));
            endGame("Only one player remaining");
        }
    }

    private void endGame(String reason) {
        if (core.gameState != GameState.PLAYING) {
            return;
        }

        core.gameState = GameState.FINISHED;
        GameStats stats = combatSystem.getGameStats();
        stats.calculateFinalStats(core.getPlayerStates());
        broadcastGameEnded(reason, stats);

        gameLoop.schedule(this::kickAllPlayersAndShutdown, 15, TimeUnit.SECONDS);
    }

    private void kickAllPlayersAndShutdown() {
        logger.info("Kicking all players and shutting down room {}", core.getMapId());

        List<String> playersToKick = new ArrayList<>(core.getPlayers().keySet());
        Map<String, Object> kickMessage = Map.of(
                "type", "room_shutdown",
                "reason", "Game ended, returning to menu"
        );

        for (String username : playersToKick) {
            try {
                messaging.sendKickMessageAndClose(username, kickMessage);
            } catch (Exception e) {
                logger.error("Error kicking player {}: {}", username, e.getMessage());
            }
        }

        gameLoop.schedule(() -> {
            core.forceDisconnectAll();
            initiateShutdown();
        }, 500, TimeUnit.MILLISECONDS);
    }

    private void initiateShutdown() {
        if (isShuttingDown.compareAndSet(false, true)) {
            logger.info("Initiating shutdown for room {}", core.getMapId());
            shutdown();
        }
    }

    // Broadcast methods
    private void broadcastCountdownStarted() {
        Map<String, Object> message = Map.of(
                "type", "countdown_started",
                "duration", COUNTDOWN_DURATION
        );

        messaging.broadcast(JsonUtils.toJson(message));
    }

    private void broadcastCountdown(int seconds) {
        Map<String, Object> message = Map.of(
                "type", "countdown",
                "seconds", seconds
        );

        messaging.broadcast(JsonUtils.toJson(message));
    }

    private void broadcastCountdownCancelled() {
        Map<String, Object> message = Map.of(
                "type", "countdown_cancelled"
        );

        messaging.broadcast(JsonUtils.toJson(message));
    }

    private void broadcastGameStarted() {
        Map<String, Object> message = Map.of(
                "type", "game_started",
                "gameStartTime", gameStartTime,
                "gameDuration", GAME_DURATION_MS
        );

        messaging.broadcast(JsonUtils.toJson(message));
    }

    private void broadcastTimeRemaining() {
        if (core.gameState != GameState.PLAYING) {
            return;
        }

        long timeElapsed = System.currentTimeMillis() - gameStartTime;
        long timeRemaining = Math.max(0, GAME_DURATION_MS - timeElapsed);

        Map<String, Object> message = Map.of(
                "type", "time_remaining",
                "timeRemaining", timeRemaining,
                "timeElapsed", timeElapsed
        );

        messaging.broadcast(JsonUtils.toJson(message));
    }

    private void broadcastGameEnded(String reason, GameStats stats) {
        Map<String, Object> message = Map.of (
                "type", "game_ended",
                "reason", reason,
                "stats", stats.getStatsAsMap()
        );

        messaging.broadcast(JsonUtils.toJson(message));
    }

    private void broadcastPlayerJoined(String username) {
        PlayerState state = core.getPlayerStates().get(username);

        if (state == null) {
            logger.warn("Cannot broadcast player_joined for {} - no PlayerState found", username);
            return;
        }

        Map<String, Object> message = Map.of(
                "type", "player_joined",
                "username", username,
                "x", state.getX(),
                "y", state.getY(),
                "flipX", state.isFlipX()
        );

        messaging.broadcastExcept(JsonUtils.toJson(message), username);
    }

    private void broadcastPlayerLeft(String username) {
        Map<String, Object> message = Map.of(
                "type", "player_left",
                "username", username
        );

        messaging.broadcast(JsonUtils.toJson(message));
    }

    private void broadcastPlayerUpdate(String username) {
        PlayerState state = core.getPlayerStates().get(username);
        if (state == null) {
            return;
        }

        Map<String, Object> message = Map.of(
                "type", "player_update",
                "username", username,
                "x", state.getX(),
                "y", state.getY(),
                "vx", state.getVx(),
                "vy", state.getVy(),
                "flipX", state.isFlipX()
        );

        messaging.broadcastExcept(JsonUtils.toJson(message), username);
    }

    private void sendPlayerList(String username) {
        List<String> playerList = new ArrayList<>(core.getPlayerStates().keySet());
        
        Map<String, Object> message = Map.of(
                "type", "player_list",
                "players", playerList
        );

        messaging.sendToPlayer(username, message);
        sendGameState(username);
    }

    private void sendGameState(String username) {
        Map<String, Object> gameState = createGameStateMessage();
        messaging.sendToPlayer(username, gameState);
    }

    private Map<String, Object> createGameStateMessage() {
        Map<String, Object> gameStateMsg = new HashMap<>();
        gameStateMsg.put("type", "game_state");

        Map<String, Object> states = new HashMap<>();
        core.getPlayerStates().forEach((username, state) -> {
            Map<String, Object> playerData = Map.of(
                    "x", state.getX(),
                    "y", state.getY(),
                    "vx", state.getVx(),
                    "vy", state.getVy(),
                    "flipX", state.isFlipX(),
                    "health", state.getHealth(),
                    "isDead", state.isDead()
            );
            states.put(username, playerData);
        });

        gameStateMsg.put("players", states);

        return gameStateMsg;
    }

    // Getters

    public String getMapId() {
        return core.getMapId();
    }

    public int getPlayerCount() {
        return core.getPlayerCount();
    }

    public boolean isEmpty() {
        return core.isEmpty();
    }

    public boolean isFull() {
        return core.isFull();
    }

    public GameState getGameState() {
        return core.getGameState();
    }

    public boolean isShuttingDown() {
        return isShuttingDown.get();
    }

    public void shutdown() {
        if (isShuttingDown.compareAndSet(false, true)) {
            logger.info("Shutting down room {}", core.getMapId());
        }

        gameLoop.shutdown();
        try {
            if (!gameLoop.awaitTermination(5, TimeUnit.SECONDS)) {
                gameLoop.shutdownNow();
            }
        } catch (InterruptedException e) {
            gameLoop.shutdownNow();
            Thread.currentThread().interrupt();
        }

        messaging.shutdown();
    }
}
