package fhv.omni.gamelogic.service.game;

import jakarta.websocket.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Handles message queuing and broadcasting for game rooms
 */
public class GameRoomMessaging {
    private final Logger logger = LoggerFactory.getLogger(GameRoomMessaging.class);
    private final GameRoomCore core;

    private final Map<String, BlockingQueue<String>> messageQueues = new ConcurrentHashMap<>();
    private final Map<String, AtomicBoolean> sendingInProgress = new ConcurrentHashMap<>();
    private final Map<String, ExecutorService> playerExecutors = new ConcurrentHashMap<>();

    public GameRoomMessaging(GameRoomCore core) {
        this.core = core;
    }

    public void queueMessage(String username, String message) {
        messageQueues.computeIfAbsent(username, k -> new LinkedBlockingQueue<>());
        sendingInProgress.computeIfAbsent(username, k -> new AtomicBoolean(false));
        playerExecutors.computeIfAbsent(username, k -> Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "WebSocket-Sender-" + username);
            t.setDaemon(true);
            return t;
        }));

        BlockingQueue<String> queue = messageQueues.get(username);
        if (queue.offer(message)) {
            if (sendingInProgress.get(username).compareAndSet(false, true)) {
                ExecutorService executor = playerExecutors.get(username);
                if (executor != null && !executor.isShutdown()) {
                    executor.submit(() -> processMessageQueue(username));
                }
            }
        }
    }

    private void processMessageQueue(String username) {
        BlockingQueue<String> queue = messageQueues.get(username);
        Session session = core.getPlayers().get(username);

        if (queue == null || session == null) {
            sendingInProgress.get(username).set(false);
            return;
        }

        try {
            while (!queue.isEmpty() && session.isOpen()) {
                String message = queue.poll();

                if (message != null) {
                    try {
                        session.getBasicRemote().sendText(message);
                    } catch (IOException e) {
                        logger.warn("Failed to send message to player {}: {}", username, e.getMessage());
                        break;
                    }
                }
            }
        } finally {
            sendingInProgress.get(username).set(false);

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

    public void broadcast(String message) {
        Map<String, Session> currentPlayers = core.getPlayers();

        for (String username : currentPlayers.keySet()) {
            queueMessage(username, message);
        }
    }

    public void broadcastExcept(String message, String excludeUsername) {
        Map<String, Session> currentPlayers = core.getPlayers();

        for (String username : currentPlayers.keySet()) {
            if (!username.equals(excludeUsername)) {
                queueMessage(username, message);
            }
        }
    }

    public void sendToPlayer(String username, Map<String, Object> messageData) {
        String json = JsonUtils.toJson(messageData);
        queueMessage(username, json);
    }

    public void broadcastRoomStatus() {
        Map<String, Object> message = new HashMap<>();
        message.put("type", "room_status");
        message.put("gameState", core.getGameState().toString());
        message.put("playerCount", core.getPlayerCount());
        message.put("maxPlayers", GameRoomCore.MAX_PLAYERS);
        message.put("readyStates", core.getPlayerReadyStatus());

        broadcast(JsonUtils.toJson(message));
    }

    public void broadcastGameState() {
        Map<String, Object> gameStateMsg = new HashMap<>();
        gameStateMsg.put("type", "game_state");

        Map<String, Object> states = new HashMap<>();
        core.getPlayerStates().forEach((username, state) -> {
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

        broadcast(JsonUtils.toJson(gameStateMsg));
    }

    public void cleanup(String username) {
        messageQueues.remove(username);
        sendingInProgress.remove(username);

        ExecutorService executor = playerExecutors.remove(username);

        if (executor != null) {
            executor.shutdown();
        }
    }

    public void shutdown() {
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

        messageQueues.clear();
        sendingInProgress.clear();
        playerExecutors.clear();
    }
}
