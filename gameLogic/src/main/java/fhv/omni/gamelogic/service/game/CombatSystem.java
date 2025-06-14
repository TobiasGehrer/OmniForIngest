package fhv.omni.gamelogic.service.game;

import fhv.omni.gamelogic.service.game.enums.GameState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

public class CombatSystem {
    private static final float PROJECTILE_HIT_RADIUS = 12.0f;
    private final Logger logger = LoggerFactory.getLogger(CombatSystem.class);
    private final GameRoomCore core;
    private final GameRoomMessaging messaging;
    private final List<ProjectileState> projectiles = new ArrayList<>();
    private final GameStats gameStats = new GameStats();

    public CombatSystem(GameRoomCore core, GameRoomMessaging messaging) {
        this.core = core;
        this.messaging = messaging;
    }

    public void handleAttack(String username, Map<String, Object> data) {
        if (core.getGameState() != GameState.PLAYING) {
            return;
        }

        try {
            PlayerState attackerState = core.getPlayerStates().get(username);

            if (attackerState != null && !attackerState.isDead()) {
                float directionX = ((Number) data.getOrDefault("directionX", 0.0)).floatValue();
                float directionY = ((Number) data.getOrDefault("directionY", 0.0)).floatValue();

                createProjectile(username, attackerState.getX(), attackerState.getY(), directionX, directionY, false);
            }
        } catch (Exception e) {
            logger.error("Error processing attack: {}", e.getMessage());
        }
    }

    public void handleHeal(String username, Map<String, Object> data) {
        try {
            PlayerState playerState = core.getPlayerStates().get(username);

            if (playerState != null && !playerState.isDead()) {
                int healAmount = ((Number) data.getOrDefault("amount", 1)).intValue();
                boolean wasHealed = playerState.heal(healAmount);

                if (wasHealed) {
                    broadcastHealEvent(username, playerState.getHealth());
                }
            }
        } catch (Exception e) {
            logger.error("Error processing heal: {}", e.getMessage());
        }
    }

    public void handleDamage(String username, Map<String, Object> data) {
        try {
            PlayerState playerState = core.getPlayerStates().get(username);

            if (playerState != null && !playerState.isDead()) {
                int damageAmount = ((Number) data.getOrDefault("amount", 1)).intValue();
                boolean died = playerState.takeDamage(damageAmount);

                if (died) {
                    gameStats.recordDeath(username);
                }

                broadcastDamageEvent(username, playerState.getHealth(), died);
            }
        } catch (Exception e) {
            logger.error("Error processing damage: {}", e.getMessage());
        }
    }

    public void updateProjectiles() {
        if (core.getGameState() != GameState.PLAYING) {
            return;
        }

        long currentTime = System.currentTimeMillis();
        Iterator<ProjectileState> iterator = projectiles.iterator();

        while (iterator.hasNext()) {
            ProjectileState projectile = iterator.next();
            projectile.update();

            if (projectile.hasExpired(currentTime)) {
                iterator.remove();
                broadcastProjectileRemoved(projectile.getId());
                continue;
            }

            boolean hit = checkProjectileHit(projectile);

            if (hit) {
                iterator.remove();
                broadcastProjectileRemoved(projectile.getId());
            }
        }
    }

    private boolean checkProjectileHit(ProjectileState projectile) {
        String ownerId = projectile.getOwnerId();
        boolean isNPCProjectile = ownerId.startsWith("npc_");

        if (isNPCProjectile) {
            return checkNPCProjectileHitPlayers(projectile);
        } else {
            return checkPlayerProjectileHit(projectile);
        }
    }

    private boolean checkNPCProjectileHitPlayers(ProjectileState projectile) {
        for (Map.Entry<String, PlayerState> entry : core.getPlayerStates().entrySet()) {
            String targetUsername = entry.getKey();
            PlayerState targetState = entry.getValue();

            if (targetState.isDead()) {
                continue;
            }

            float playerX = targetState.getX();
            float playerY = targetState.getY() + 4.0f; // Adjust hit position

            if (projectile.isInRangeOf(playerX, playerY, PROJECTILE_HIT_RADIUS)) {
                boolean died = targetState.takeDamage(1);

                // Only record kills if killer is not an NPC
                if (died && !projectile.getOwnerId().startsWith("npc_")) {
                    gameStats.recordKill(projectile.getOwnerId(), targetUsername);
                }

                broadcastDamageEvent(targetUsername, targetState.getHealth(), died);
                return true;
            }
        }

        return false;
    }

    private boolean checkPlayerProjectileHit(ProjectileState projectile) {
        // Check hits against other players
        for (Map.Entry<String, PlayerState> entry : core.getPlayerStates().entrySet()) {
            String targetUsername = entry.getKey();
            PlayerState targetState = entry.getValue();

            if (targetUsername.equals(projectile.getOwnerId()) || targetState.isDead()) {
                continue;
            }

            float playerX = targetState.getX();
            float playerY = targetState.getY() + 4.0f; // Adjust hit position

            if (projectile.isInRangeOf(playerX, playerY, PROJECTILE_HIT_RADIUS)) {
                boolean died = targetState.takeDamage(1);

                if (died) {
                    gameStats.recordKill(projectile.getOwnerId(), targetUsername);
                }

                broadcastDamageEvent(targetUsername, targetState.getHealth(), died);
                return true;
            }
        }

        return false;
    }

    private void createProjectile(String username, float x, float y, float directionX, float directionY, boolean isNPC) {
        ProjectileState projectile = new ProjectileState(username, x, y, directionX, directionY);
        projectiles.add(projectile);
        broadcastProjectileCreated(projectile, isNPC);
    }

    public void createNPCProjectile(String npcId, float x, float y, float directionX, float directionY) {
        createProjectile(npcId, x, y, directionX, directionY, true);
    }

    private void broadcastProjectileCreated(ProjectileState projectile, boolean isNPC) {
        Map<String, Object> message = Map.of(
                "type", "projectile_created",
                "id", projectile.getId(),
                "ownerId", projectile.getOwnerId(),
                "x", projectile.getX(),
                "y", projectile.getY(),
                "directionX", projectile.getDirectionX(),
                "directionY", projectile.getDirectionY(),
                "isNPC", isNPC
        );

        messaging.broadcast(JsonUtils.toJson(message));
    }

    private void broadcastProjectileRemoved(String projectileId) {
        Map<String, Object> message = Map.of(
                "type", "projectile_removed",
                "id", projectileId
        );

        messaging.broadcast(JsonUtils.toJson(message));
    }

    private void broadcastDamageEvent(String targetUsername, int currentHealth, boolean died) {
        Map<String, Object> message = Map.of(
                "type", "player_damaged",
                "username", targetUsername,
                "currentHealth", currentHealth,
                "died", died
        );

        messaging.broadcast(JsonUtils.toJson(message));
    }

    private void broadcastHealEvent(String username, int currentHealth) {
        Map<String, Object> message = Map.of(
                "type", "player_healed",
                "username", username,
                "currentHealth", currentHealth
        );

        messaging.broadcast(JsonUtils.toJson(message));
    }

    public void reset() {
        projectiles.clear();
        gameStats.reset();
    }

    public GameStats getGameStats() {
        return gameStats;
    }

    public List<ProjectileState> getProjectiles() {
        return new ArrayList<>(projectiles);
    }
}
