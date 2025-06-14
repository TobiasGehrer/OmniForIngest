package fhv.omni.gamelogic.service.game;

import fhv.omni.gamelogic.service.game.enums.GameState;
import fhv.omni.gamelogic.service.shop.ShopServiceClient;
import fhv.omni.gamelogic.service.wallet.CoinService;
import jakarta.websocket.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public class GameRoom {
    private static final String FLIP_X_KEY = "flipX";
    private static final String USERNAME_KEY = "username";
    private static final String MESSAGE_KEY = "message";
    private static final String TIMESTAMP_KEY = "timestamp";
    private static final String CHAT_MESSAGE_KEY = "chat_message";
    private static final String SYSTEM_USER = "SYSTEM";

    private static final long TICK_RATE_MS = 1000 / 60;
    private static final int COUNTDOWN_DURATION = 5;
    private static final long GAME_DURATION_MS = 5L * 60 * 1000;
    private final Logger logger = LoggerFactory.getLogger(GameRoom.class);
    private final GameRoomCore core;
    private final GameRoomMessaging messaging;
    private final CombatSystem combatSystem;
    private final CoinService coinService;
    private final GrowingDamageZone growingDamageZone;
    private final NPCManager npcManager;
    private final ScheduledExecutorService gameLoop = Executors.newSingleThreadScheduledExecutor();
    private final AtomicBoolean isShuttingDown = new AtomicBoolean(false);
    private int countdownSeconds = 0;
    private long gameStartTime = 0;
    private long lastCountdownUpdate = 0;
    private long lastTimeUpdate = 0;
    private long lastGameStateUpdate = 0;

    public GameRoom(String mapId, CoinService coinService, ShopServiceClient shopServiceClient) {
        this.core = new GameRoomCore(mapId, shopServiceClient);
        this.messaging = new GameRoomMessaging(core);
        this.combatSystem = new CombatSystem(core, messaging);
        this.growingDamageZone = new GrowingDamageZone(core, messaging, combatSystem);
        this.npcManager = new NPCManager(core, messaging, combatSystem);
        this.coinService = coinService;

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
                case WAITING, FINISHED -> {
                    // No updates neede for WAITING or FINISHED states
                    // These states are handled by user interactions and game end conditions
                }
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
        npcManager.update();

        if ("map3".equals(core.getMapId())) {
            growingDamageZone.update();
        }

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

        boolean connected = core.connect(username, session);

        if (connected) {
            broadcastPlayerJoined(username);
            sendPlayerList(username);
            sendGameState(username);

            if ("map3".equals(core.getMapId()) && npcManager.hasNPCs()) {
                sendNPCState(username);
            }

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
            case "join_game" -> {
                // Join game is handled in the connect() method
            }
            case "ready_toggle" -> handleReadyToggle(username);
            case "position" -> handlePositionUpdate(username, data);
            case "attack" -> combatSystem.handleAttack(username, data);
            case CHAT_MESSAGE_KEY -> handleChatMessage(username, data);
            case "heal" -> combatSystem.handleHeal(username, data);
            case "damage" -> combatSystem.handleDamage(username, data);
            case "npc_damage" -> handleNPCDamage(data);
            case "spawn_points" -> handleSpawnPoints(data);
            case "heartbeat" -> {
                // Heartbeat/keep-alive message - no action needed
            }
            default -> logger.warn("Unknown message type: {}", messageType);
        }
    }

    private void handleSpawnPoints(Map<String, Object> data) {
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> spawnPoints = (List<Map<String, Object>>) data.get("spawnPoints");

            if (spawnPoints != null && !spawnPoints.isEmpty()) {
                logger.info("Received {} spawn points from client", spawnPoints.size());
                core.setSpawnPoints(spawnPoints);
            }
        } catch (Exception e) {
            logger.error("Error processing spawn points: {}", e.getMessage());
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
            boolean flipX = (Boolean) data.getOrDefault(FLIP_X_KEY, false);

            core.updatePlayerPosition(username, x, y, vx, vy, flipX);
            broadcastPlayerUpdate(username);
        } catch (Exception e) {
            logger.error("Error processing position update: {}", e.getMessage());
        }
    }

    private void handleChatMessage(String username, Map<String, Object> data) {
        try {
            String message = (String) data.getOrDefault(MESSAGE_KEY, "");
            long timestamp = ((Number) data.getOrDefault(TIMESTAMP_KEY, System.currentTimeMillis())).longValue();

            if (!message.isEmpty()) {
                // Check for "/dinero" command
                if ("/dinero".equals(message.trim())) {
                    handleDineroCommand(username);
                    return;
                }

                Map<String, Object> chatPayload = new HashMap<>();
                chatPayload.put("type", CHAT_MESSAGE_KEY);
                chatPayload.put(USERNAME_KEY, username);
                chatPayload.put(MESSAGE_KEY, message);
                chatPayload.put(TIMESTAMP_KEY, timestamp);

                messaging.broadcastExcept(JsonUtils.toJson(chatPayload), username);
            }
        } catch (Exception e) {
            logger.error("Error processing chat message: {}", e.getMessage());
        }
    }

    private void handleDineroCommand(String username) {
        try {
            // Add 9999 coins to the player's wallet
            coinService.addCoins(username, 9999).thenAccept(totalCoins -> {
                if (totalCoins != null) {
                    // Send confirmation message to the player
                    Map<String, Object> responsePayload = new HashMap<>();
                    responsePayload.put("type", CHAT_MESSAGE_KEY);
                    responsePayload.put(USERNAME_KEY, SYSTEM_USER);
                    responsePayload.put(MESSAGE_KEY, "Added 9999 coins to your wallet! Total coins: " + totalCoins);
                    responsePayload.put(TIMESTAMP_KEY, System.currentTimeMillis());

                    messaging.sendToPlayer(username, responsePayload);

                    logger.info("Added 9999 coins to player {}'s wallet via /dinero command", username);
                } else {
                    // Send error message to player
                    Map<String, Object> errorPayload = new HashMap<>();
                    errorPayload.put("type", CHAT_MESSAGE_KEY);
                    errorPayload.put(USERNAME_KEY, SYSTEM_USER);
                    errorPayload.put(MESSAGE_KEY, "Error adding coins to your wallet");
                    errorPayload.put(TIMESTAMP_KEY, System.currentTimeMillis());

                    messaging.sendToPlayer(username, errorPayload);

                    logger.error("Failed to add coins to player {}'s wallet via /dinero command", username);
                }
            });
        } catch (Exception e) {
            logger.error("Error processing /dinero command for {}: {}", username, e.getMessage());

            // Send error message to player
            Map<String, Object> errorPayload = new HashMap<>();
            errorPayload.put("type", CHAT_MESSAGE_KEY);
            errorPayload.put(USERNAME_KEY, SYSTEM_USER);
            errorPayload.put(MESSAGE_KEY, "Error adding coins: " + e.getMessage());
            errorPayload.put(TIMESTAMP_KEY, System.currentTimeMillis());

            messaging.sendToPlayer(username, errorPayload);
        }
    }

    private void handleNPCDamage(Map<String, Object> data) {
        try {
            String npcId = (String) data.get("npcId");
            int damage = ((Number) data.getOrDefault("damage", 0)).intValue();

            if (npcId != null) {
                npcManager.handleNPCDamage(npcId, damage);
            }
        } catch (Exception e) {
            logger.error("Error processing npc damage: {}", e.getMessage());
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
        growingDamageZone.reset();
        npcManager.reset();
        core.resetPlayerStates();

        // Start growing damage zone for map3 after a delay
        if ("map3".equals(core.getMapId())) {
            spawnMap3NPCs();

            // Start growing damage zone after delay
            gameLoop.schedule(() -> {
                if (core.getGameState() == GameState.PLAYING) {
                    float mapWidth = 1284.0f; // Playable area width
                    float mapHeight = 1120.0f; // Playable area height
                    logger.info("Starting damage zone with playable area dimensions: {}x{}", mapWidth, mapHeight);
                    growingDamageZone.start(mapWidth, mapHeight);
                }
            }, 5, TimeUnit.SECONDS);

            gameLoop.schedule(() -> {
                if (core.getGameState() == GameState.PLAYING) {
                    growingDamageZone.stopShrinking();
                }
            }, 275, TimeUnit.SECONDS); // 4 minutes 30 seconds + 5 second initial delay
        }

        broadcastGameStarted();
        logger.info("Game started in room {} - now in {} state with {} players",
                core.getMapId(), core.getGameState(), core.getPlayerCount());
    }

    private void spawnMap3NPCs() {
        float mapWidth = 1284.0f;
        float mapHeight = 1120.0f;

        npcManager.spawnNPC(mapWidth / 2, mapHeight / 2);

        logger.info("Spawned NPCs for map3");
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
            endGame("Only one player remaining");
        }
    }

    private void endGame(String reason) {
        if (core.gameState != GameState.PLAYING) {
            return;
        }

        growingDamageZone.stop();
        npcManager.cleanup();

        core.gameState = GameState.FINISHED;
        GameStats stats = combatSystem.getGameStats();
        stats.calculateFinalStats(core.getPlayerStates());

        Map<String, Integer> playerRanks = extractPlayerRanks(stats);
        Map<String, Integer> coinsAwarded = coinService.awardCoinsToPlayer(playerRanks);
        stats.setCoinsAwarded(coinsAwarded);

        broadcastGameEnded(reason, stats);

        gameLoop.schedule(this::kickAllPlayersAndShutdown, 15, TimeUnit.SECONDS);
    }

    private Map<String, Integer> extractPlayerRanks(GameStats stats) {
        Map<String, Integer> playerRanks = new HashMap<>();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rankings = (List<Map<String, Object>>) stats.getStatsAsMap().get("rankings");

        for (Map<String, Object> ranking : rankings) {
            String playerId = (String) ranking.get("playerId");
            Integer rank = (Integer) ranking.get("rank");
            playerRanks.put(playerId, rank);
        }

        return playerRanks;
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
        Map<String, Object> message = Map.of(
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
                USERNAME_KEY, username,
                "x", state.getX(),
                "y", state.getY(),
                FLIP_X_KEY, state.isFlipX(),
                "skin", state.getSkin()
        );

        messaging.broadcastExcept(JsonUtils.toJson(message), username);
    }

    private void broadcastPlayerLeft(String username) {
        Map<String, Object> message = Map.of(
                "type", "player_left",
                USERNAME_KEY, username
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
                USERNAME_KEY, username,
                "x", state.getX(),
                "y", state.getY(),
                "vx", state.getVx(),
                "vy", state.getVy(),
                FLIP_X_KEY, state.isFlipX()
        );

        messaging.broadcastExcept(JsonUtils.toJson(message), username);
    }

    private void sendPlayerList(String username) {
        // Create a list of player objects with username and skin
        List<Map<String, String>> playerList = new ArrayList<>();
        core.getPlayerStates().forEach((playerUsername, state) -> {
            Map<String, String> playerData = new HashMap<>();
            playerData.put(USERNAME_KEY, playerUsername);
            playerData.put("skin", state.getSkin());
            playerList.add(playerData);
        });

        Map<String, Object> message = new HashMap<>();
        message.put("type", "player_list");
        message.put("players", playerList);

        messaging.sendToPlayer(username, message);
        sendGameState(username);
    }

    private void sendGameState(String username) {
        Map<String, Object> gameState = createGameStateMessage();
        messaging.sendToPlayer(username, gameState);
    }

    private void sendNPCState(String username) {
        if (!npcManager.hasNPCs()) {
            return;
        }

        npcManager.getNPCs().forEach((npcId, npc) -> {
            Map<String, Object> message = Map.of(
                    "type", "npc_spawned",
                    "id", npc.getId(),
                    "x", npc.getX(),
                    "y", npc.getY(),
                    "health", npc.getHealth(),
                    "maxHealth", npc.getMaxHealth()
            );

            messaging.sendToPlayer(username, message);
        });
    }

    private Map<String, Object> createGameStateMessage() {
        Map<String, Object> gameStateMsg = new HashMap<>();
        gameStateMsg.put("type", "game_state");

        Map<String, Object> states = new HashMap<>();
        core.getPlayerStates().forEach((username, state) -> {
            Map<String, Object> playerData = new HashMap<>();
            playerData.put("x", state.getX());
            playerData.put("y", state.getY());
            playerData.put("vx", state.getVx());
            playerData.put("vy", state.getVy());
            playerData.put(FLIP_X_KEY, state.isFlipX());
            playerData.put("health", state.getHealth());
            playerData.put("isDead", state.isDead());
            playerData.put("skin", state.getSkin());

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
