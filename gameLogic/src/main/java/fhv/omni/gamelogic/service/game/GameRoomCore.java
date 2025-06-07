package fhv.omni.gamelogic.service.game;

import fhv.omni.gamelogic.service.game.enums.GameState;
import jakarta.websocket.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Core game room functionality - handles player state and basic room operations
 */
public class GameRoomCore {
    private final Logger logger = LoggerFactory.getLogger(GameRoomCore.class);
    private final String mapId;
    private final Map<String, Session> players = new ConcurrentHashMap<>();
    private final Map<String, PlayerState> playerStates = new ConcurrentHashMap<>();
    private final Map<String, Boolean> playerReadyStatus = new ConcurrentHashMap<>();

    protected GameState gameState = GameState.WAITING;
    protected static final int MAX_PLAYERS = 4;

    public GameRoomCore(String mapId) {
        this.mapId = mapId;
    }

    public synchronized boolean connect(String username, Session session) {
        boolean isExistingPlayer = playerStates.containsKey(username);
        

        if (!isExistingPlayer && players.size() >= MAX_PLAYERS) {
            logger.warn("Cannot connect {} - room is full ({}/{})", username, players.size(), MAX_PLAYERS);
            return false;
        }

        if (!isExistingPlayer && (gameState == GameState.PLAYING || gameState == GameState.COUNTDOWN)) {
            logger.warn("Cannot connect {} - game in progress (state: {})", username, gameState);
            return false;
        }

        players.put(username, session);

        if (!isExistingPlayer) {
            playerReadyStatus.put(username, false);
            PlayerState state = new PlayerState(
                    200 + (float) (Math.random() * 400),
                    200 + (float) (Math.random() * 200),
                    0f, 0f, false
            );

            playerStates.put(username, state);
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
            state.setPosition(
                    200 + (float) (Math.random() * 400),
                    200 + (float) (Math.random() * 200)
            );
        });
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

    public Map<String, Session> getPlayers() {
        return new HashMap<>(players);
    }

    public Map<String, PlayerState> getPlayerStates() {
        return new HashMap<>(playerStates);
    }

    public Map<String, Boolean> getPlayerReadyStatus() {
        return new HashMap<>(playerReadyStatus);
    }
}
