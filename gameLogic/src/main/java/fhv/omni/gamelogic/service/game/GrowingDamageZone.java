package fhv.omni.gamelogic.service.game;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

public class GrowingDamageZone {
    private static final long UPDATE_INTERVAL = 1000; // Update every 1 second
    private static final long DAMAGE_GRACE_PERIOD = 10000; // 10 seconds grace period before damage starts
    private static final float DAMAGE_PER_TICK = 1.0f;
    private final Logger logger = LoggerFactory.getLogger(GrowingDamageZone.class);
    private final GameRoomCore core;
    private final GameRoomMessaging messaging;
    private final CombatSystem combatSystem;
    private boolean isActive = false;
    private boolean isShrinking = false;
    private boolean isDamaging = false;
    private long damageStartTime = 0;
    private float centerX;
    private float centerY;
    private float currentRadius;
    private float targetRadius;
    private float shrinkRate; // units per second
    private long lastUpdate = 0;

    public GrowingDamageZone(GameRoomCore core, GameRoomMessaging messaging, CombatSystem combatSystem) {
        this.core = core;
        this.messaging = messaging;
        this.combatSystem = combatSystem;
    }

    public void start(float mapWidth, float mapHeight) {
        if (isActive) {
            return;
        }

        this.centerX = mapWidth / 2;
        this.centerY = mapHeight / 2;
        this.currentRadius = Math.min(mapWidth, mapHeight) * 0.70f; // Start at 75% of map size
        this.targetRadius = Math.min(mapWidth, mapHeight) * 0.15f; // End at 15% of map size

        float shrinkDuration = 270.0f; // 4 minutes 30 seconds of shrinking
        this.shrinkRate = (currentRadius - targetRadius) / shrinkDuration;
        this.isActive = true;
        this.isShrinking = true;
        this.isDamaging = false; // Start with no damage during grace period
        this.lastUpdate = System.currentTimeMillis();
        this.damageStartTime = this.lastUpdate + DAMAGE_GRACE_PERIOD;

        logger.info("Starting growing damage zone - Map size: {}x{}, Center: ({}, {}), Initial radius: {}, Target radius: {}",
                mapWidth, mapHeight, centerX, centerY, currentRadius, targetRadius);

        broadcastZoneStart();
        broadcastZoneUpdate();
    }

    public void update() {
        if (!isActive) {
            return;
        }

        long currentTime = System.currentTimeMillis();

        if (currentTime - lastUpdate >= UPDATE_INTERVAL) {
            float oldRadius = currentRadius;

            // Check if damage period should start
            if (!isDamaging && currentTime >= damageStartTime) {
                isDamaging = true;
                logger.info("Growing damage zone grace period ended - damage is now active");
            }

            // Only shrink if still in shrinking phase
            if (isShrinking) {
                float deltaTime = (currentTime - lastUpdate) / 1000.0f;
                currentRadius -= shrinkRate * deltaTime;

                if (currentRadius <= targetRadius) {
                    currentRadius = targetRadius;
                    isShrinking = false;
                }

                // Only broadcast if radius changed significantly (reduced threshold for smoother updates)
                if (Math.abs(currentRadius - oldRadius) > 2.0f) {
                    broadcastZoneUpdate();
                }
            }

            // Only check players for damage after grace period
            if (isDamaging) {
                checkPlayersInZone();
            }

            lastUpdate = currentTime;
        }
    }

    private void checkPlayersInZone() {
        // Double-check that we should actually be damaging players
        if (!isDamaging) {
            logger.warn("checkPlayersInZone called during grace period - this should not happen!");
            return;
        }

        core.getPlayerStates().forEach((username, playerState) -> {
            if (playerState.isDead()) {
                return;
            }

            float playerX = playerState.getX();
            float playerY = playerState.getY();

            // Calculate distance from center
            float distance = (float) Math.sqrt(Math.pow(playerX - centerX, 2) + Math.pow(playerY - centerY, 2));

            // If player is outside safe zone, damage them
            if (distance > currentRadius) {
                boolean died = playerState.takeDamage((int) DAMAGE_PER_TICK);

                // If player died from zone damage, record it in combat system for scoreboard
                if (died) {
                    combatSystem.getGameStats().recordDeath(username);
                    logger.info("Player {} eliminated by damage zone", username);
                }

                broadcastDamageEvent(username, playerState.getHealth(), died);
            }
        });
    }

    public void stopShrinking() {
        if (!isActive || !isShrinking) {
            return;
        }

        isShrinking = false;
    }

    public void stop() {
        if (!isActive) {
            return;
        }

        isActive = false;
        isShrinking = false;
        broadcastZoneStop();
    }

    public void reset() {
        isActive = false;
        isShrinking = false;
        isDamaging = false;
        currentRadius = 0;
        targetRadius = 0;
        lastUpdate = 0;
        damageStartTime = 0;
    }

    // Broadcast methods
    private void broadcastZoneStart() {
        Map<String, Object> message = Map.of(
                "type", "growing_damage_zone_start",
                "centerX", centerX,
                "centerY", centerY,
                "initialRadius", currentRadius
        );

        messaging.broadcast(JsonUtils.toJson(message));
    }

    private void broadcastZoneUpdate() {
        Map<String, Object> message = Map.of(
                "type", "growing_damage_zone_update",
                "centerX", centerX,
                "centerY", centerY,
                "radius", currentRadius,
                "targetRadius", targetRadius
        );

        messaging.broadcast(JsonUtils.toJson(message));
    }

    private void broadcastZoneStop() {
        Map<String, Object> message = Map.of(
                "type", "growing_damage_zone_stop"
        );

        messaging.broadcast(JsonUtils.toJson(message));
    }

    private void broadcastDamageEvent(String targetUsername, int currentHealth, boolean died) {
        Map<String, Object> message = Map.of(
                "type", "player_damaged",
                "username", targetUsername,
                "currentHealth", currentHealth,
                "died", died,
                "source", "zone_damage"
        );

        messaging.broadcast(JsonUtils.toJson(message));
    }

    // Getters
    public boolean isActive() {
        return isActive;
    }

    public float getCurrentRadius() {
        return currentRadius;
    }

    public float getCenterX() {
        return centerX;
    }

    public float getCenterY() {
        return centerY;
    }
}
