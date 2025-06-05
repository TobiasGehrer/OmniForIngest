package fhv.omni.gamelogic.service.game.dtos;

public record PlayerStateDTO(float x, float y, float vx, float vy, boolean flipX, int health, boolean isDead) {
}
