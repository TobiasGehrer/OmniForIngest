package fhv.omni.gamelogic.service.game;

/**
 * Handles game logic separate from room management
 */
public class GameLogic {
    private final GameRoomCore core;
    private final GameRoomMessaging messaging;

    public GameLogic(GameRoomCore core, GameRoomMessaging messaging) {
        this.core = core;
        this.messaging = messaging;
    }

    public boolean canStartCountdown() {
        return core.getPlayerCount() >= 2 && core.allPlayersReady();
    }

    public boolean shouldCancelCountdown() {
        return core.getPlayerCount() < 2 || !core.allPlayersReady();
    }

    public long getAlivePlayerCount() {
        return core.getPlayerStates().values().stream()
                .filter(state -> !state.isDead())
                .count();
    }

    public boolean shouldEndGame(long gameStartTime, long gameDurationMs) {
        // Time limit reached
        if (System.currentTimeMillis() - gameStartTime > gameDurationMs) {
            return true;
        }

        // Not enough players
        if (core.getPlayerCount() < 2) {
            return true;
        }

        // Only one player alive
        return getAlivePlayerCount() <= 1 && core.getPlayerCount() > 1;
    }

    public String getGameEndReason(long gameStartTime, long gameDurationMs) {
        if (System.currentTimeMillis() - gameStartTime > gameDurationMs) {
            return "Time limit reached";
        }

        if (core.getPlayerCount() < 2) {
            return "Not enough players remaining";
        }

        return "Game ended";
    }
}
