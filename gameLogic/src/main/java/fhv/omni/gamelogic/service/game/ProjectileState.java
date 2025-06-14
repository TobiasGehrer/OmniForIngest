package fhv.omni.gamelogic.service.game;

import java.util.UUID;

public class ProjectileState {
    private static final float PROJECTILE_SPEED = 6.3f;
    private static final long PROJECTILE_LIFETIME_MS = 1000;
    private final String id;
    private final String ownerId;
    private final float directionX;
    private final float directionY;
    private final long creationTime;
    private float x;
    private float y;

    public ProjectileState(String ownerId, float x, float y, float directionX, float directionY) {
        this.id = UUID.randomUUID().toString();
        this.ownerId = ownerId;
        this.x = x;
        this.y = y;
        this.directionX = directionX;
        this.directionY = directionY;
        this.creationTime = System.currentTimeMillis();
    }

    public void update() {
        x += directionX * PROJECTILE_SPEED;
        y += directionY * PROJECTILE_SPEED;
    }

    public boolean hasExpired(long currentTime) {
        return currentTime - creationTime > PROJECTILE_LIFETIME_MS;
    }

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
