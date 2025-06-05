package fhv.omni.gamelogic.service.game;

import java.util.UUID;

/**
 * Represents the state of a projectile in the game
 */
public class ProjectileState {
    private final String id;
    private final String ownerId;
    private float x;
    private float y;
    private final float directionX;
    private final float directionY;
    private final long creationTime;
    private static final float PROJECTILE_SPEED = 6.3f;
    private static final long PROJECTILE_LIFETIME_MS = 1000;

    /**
     * Creates a new projectile
     * @param ownerId ID of the player who fired the projectile
     * @param x Starting X position
     * @param y Starting Y position
     * @param directionX X component of direction vector (normalized)
     * @param directionY Y component of direction vector (normalized)
     */
    public ProjectileState(String ownerId, float x, float y, float directionX, float directionY) {
        this.id = UUID.randomUUID().toString();
        this.ownerId = ownerId;
        this.x = x;
        this.y = y;
        this.directionX = directionX;
        this.directionY = directionY;
        this.creationTime = System.currentTimeMillis();
    }

    /**
     * Updates the projectile position based on its direction and speed
     */
    public void update() {
        x += directionX * PROJECTILE_SPEED;
        y += directionY * PROJECTILE_SPEED;
    }

    /**
     * Checks if the projectile has exceeded its lifetime
     * @param currentTime Current system time in milliseconds
     * @return true if the projectile has expired, false otherwise
     */
    public boolean hasExpired(long currentTime) {
        return currentTime - creationTime > PROJECTILE_LIFETIME_MS;
    }

    /**
     * Checks if the projectile is within range of a target
     * @param targetX X position of the target
     * @param targetY Y position of the target
     * @param hitRadius Radius within which a hit is registered
     * @return true if the projectile is within range of the target, false otherwise
     */
    public boolean isInRangeOf(float targetX, float targetY, float hitRadius) {
        float dx = targetX - x;
        float dy = targetY - y;
        float distanceSquared = dx * dx + dy * dy;
        return distanceSquared <= hitRadius * hitRadius;
    }

    // Getters
    public String getId() {
        return id;
    }

    public String getOwnerId() {
        return ownerId;
    }

    public float getX() {
        return x;
    }

    public float getY() {
        return y;
    }

    public float getDirectionX() {
        return directionX;
    }

    public float getDirectionY() {
        return directionY;
    }

    public long getCreationTime() {
        return creationTime;
    }
}
