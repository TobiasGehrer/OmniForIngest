package fhv.omni.gamelogic.service.game;

import fhv.omni.gamelogic.service.game.enums.NPCBehavior;

import java.util.UUID;

public class NPCState {
    private static final int MAX_HEALTH = 4;
    private static final float DEFAULT_MOVEMENT_SPEED = 90.0f;
    private static final float DEFAULT_ATTACK_RANGE = 150.0f;
    private static final float DEFAULT_DETECTION_RANGE = 250.0f;
    private static final long DEFAULT_ATTACK_COOLDOWN = 2000; // 2 seconds
    private final String id;
    private final float movementSpeed;
    private final float attackRange;
    private final float detectionRange;
    private final long attackCooldown;
    private float x;
    private float y;
    private float targetX;
    private float targetY;
    private boolean flipX;
    private int health;
    private boolean isDead;
    private NPCBehavior behavior;
    private String currentTarget; // Player username being targeted
    private long lastActionTime;
    private long lastAttackTime;

    public NPCState(float x, float y) {
        this.id = "npc_" + UUID.randomUUID().toString().substring(0, 8);
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.flipX = false;
        this.health = MAX_HEALTH;
        this.isDead = false;
        this.behavior = NPCBehavior.IDLE;
        this.currentTarget = null;
        this.lastActionTime = System.currentTimeMillis();
        this.movementSpeed = DEFAULT_MOVEMENT_SPEED;
        this.attackRange = DEFAULT_ATTACK_RANGE;
        this.detectionRange = DEFAULT_DETECTION_RANGE;
        this.attackCooldown = DEFAULT_ATTACK_COOLDOWN;
        this.lastAttackTime = 0;
    }

    public synchronized boolean takeDamage(int damage) {
        if (isDead) {
            return false;
        }

        health -= damage;

        if (health <= 0) {
            health = 0;
            isDead = true;
            behavior = NPCBehavior.IDLE;
            currentTarget = null;
            return true; // NPC died
        }

        return false; // NPC survived
    }

    public boolean canAttack() {
        if (isDead) {
            return false;
        }

        long currentTime = System.currentTimeMillis();
        return currentTime - lastAttackTime >= attackCooldown;
    }

    public void performAttack() {
        lastAttackTime = System.currentTimeMillis();
    }

    public void setTarget(float x, float y) {
        this.targetX = x;
        this.targetY = y;
    }

    public float getDistanceTo(float x, float y) {
        float dx = this.x - x;
        float dy = this.y - y;
        return (float) Math.sqrt((dx * dx) + (dy * dy));
    }

    public boolean isInRange(float x, float y, float range) {
        return getDistanceTo(x, y) <= range;
    }

    public void updateMovement() {
        if (isDead) {
            return;
        }

        float dx = targetX - x;
        float dy = targetY - y;
        float distance = (float) Math.sqrt((dx * dx) + (dy * dy));

        if (distance > 5.0f) { // Only move if not close enough to target
            float moveDistance = movementSpeed * 0.016f; // for 60 FPS

            if (moveDistance >= distance) {
                // Close enough, snap to target
                x = targetX;
                y = targetY;
            } else {
                // Move towards target
                float normalizedDx = dx / distance;
                float normalizedDy = dy / distance;

                x += normalizedDx * moveDistance;
                y += normalizedDy * moveDistance;
            }

            // Update facing direction
            flipX = dx < 0;
        }
    }

    public boolean isMoving() {
        float dx = targetX - x;
        float dy = targetY - y;
        float distance = (float) Math.sqrt((dx * dx) + (dy * dy));
        return distance > 5.0f;
    }

    public void reset() {
        this.health = MAX_HEALTH;
        this.isDead = false;
        this.behavior = NPCBehavior.IDLE;
        this.currentTarget = null;
        this.lastActionTime = System.currentTimeMillis();
        this.lastAttackTime = 0;
    }

    // Getters and setters
    public String getId() {
        return id;
    }

    public float getX() {
        return x;
    }

    public void setX(float x) {
        this.x = x;
    }

    public float getY() {
        return y;
    }

    public void setY(float y) {
        this.y = y;
    }

    public float getTargetX() {
        return targetX;
    }

    public float getTargetY() {
        return targetY;
    }

    public boolean isFlipX() {
        return flipX;
    }

    public void setFlipX(boolean flipX) {
        this.flipX = flipX;
    }

    public int getHealth() {
        return health;
    }

    public void setHealth(int health) {
        this.health = Math.clamp(health, 0, MAX_HEALTH);
    }

    public boolean isDead() {
        return isDead;
    }

    public void setDead(boolean dead) {
        isDead = dead;
    }

    public NPCBehavior getBehavior() {
        return behavior;
    }

    public void setBehavior(NPCBehavior behavior) {
        this.behavior = behavior;
    }

    public String getCurrentTarget() {
        return currentTarget;
    }

    public void setCurrentTarget(String currentTarget) {
        this.currentTarget = currentTarget;
    }

    public long getLastActionTime() {
        return lastActionTime;
    }

    public void setLastActionTime(long lastActionTime) {
        this.lastActionTime = lastActionTime;
    }

    public float getMovementSpeed() {
        return movementSpeed;
    }

    public float getAttackRange() {
        return attackRange;
    }

    public float getDetectionRange() {
        return detectionRange;
    }

    public int getMaxHealth() {
        return MAX_HEALTH;
    }

}
