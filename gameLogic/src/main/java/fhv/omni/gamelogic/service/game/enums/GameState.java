package fhv.omni.gamelogic.service.game.enums;

public enum GameState {
    WAITING,        // Waiting for players to join and ready up
    COUNTDOWN,      // All players ready, countdown started
    PLAYING,        // Game in progress
    FINISHED        // Game ended
}
