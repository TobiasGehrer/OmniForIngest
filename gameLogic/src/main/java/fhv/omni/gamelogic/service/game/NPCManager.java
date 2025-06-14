package fhv.omni.gamelogic.service.game;

import fhv.omni.gamelogic.service.game.enums.GameState;
import fhv.omni.gamelogic.service.game.enums.NPCBehavior;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

public class NPCManager {
    private static final String HEALTH_KEY = "health";

    private static final long UPDATE_INTERVAL = 1000 / 60; // 60 FPS
    private static final long BEHAVIOR_CHANGE_INTERVAL = 3000; // Change behavior every 3 seconds
    private static final float MAP_BOUNDARY_MARGIN = 50.0f;
    private final Logger logger = LoggerFactory.getLogger(NPCManager.class);
    private final GameRoomCore core;
    private final GameRoomMessaging messaging;
    private final CombatSystem combatSystem;
    private final Map<String, NPCState> npcs = new HashMap<>();
    private long lastUpdateTime = 0;

    public NPCManager(GameRoomCore core, GameRoomMessaging messaging, CombatSystem combatSystem) {
        this.core = core;
        this.messaging = messaging;
        this.combatSystem = combatSystem;
    }

    public void spawnNPC(float x, float y) {
        NPCState npc = new NPCState(x, y);
        npcs.put(npc.getId(), npc);

        broadcastNPCSpawn(npc);

        logger.info("Spawned NPC {} at position ({}, {})", npc.getId(), x, y);
    }

    public void update() {
        if (core.gameState != GameState.PLAYING) {
            return;
        }

        long currentTime = System.currentTimeMillis();

        if (currentTime - lastUpdateTime < UPDATE_INTERVAL) {
            return;
        }

        lastUpdateTime = currentTime;

        for (NPCState npc : npcs.values()) {
            if (npc.isDead()) {
                continue;
            }

            updateNPCBehavior(npc, currentTime);
            npc.updateMovement();
        }

        broadcastNPCStates();
    }

    private void updateNPCBehavior(NPCState npc, long currentTime) {
        Map<String, PlayerState> players = core.getPlayerStates();

        String closestPlayer = findClosestAlivePlayer(npc, players);

        if (closestPlayer != null) {
            PlayerState targetPlayer = players.get(closestPlayer);
            float distanceToPlayer = npc.getDistanceTo(targetPlayer.getX(), targetPlayer.getY());

            // Behavior decision logic
            if (distanceToPlayer <= npc.getAttackRange() && npc.canAttack()) {
                // Attack if in range and cooldown is ready
                npc.setBehavior(NPCBehavior.ATTACK);
                npc.setCurrentTarget(closestPlayer);
                performNPCAttack(npc, targetPlayer);
            } else if (distanceToPlayer <= npc.getDetectionRange()) {
                // Chase if player is detected but not in attack range
                npc.setBehavior(NPCBehavior.CHASE);
                npc.setCurrentTarget(closestPlayer);
                npc.setTarget(targetPlayer.getX(), targetPlayer.getY());
            } else if (currentTime - npc.getLastActionTime() > BEHAVIOR_CHANGE_INTERVAL) {
                // No players nearby, switch to patrol behavior
                npc.setBehavior(NPCBehavior.PATROL);
                npc.setCurrentTarget(null);
                setRandomPatrolTarget(npc);
                npc.setLastActionTime(currentTime);
            }
        } else {
            // No alive players, patrol randomly
            if (currentTime - npc.getLastActionTime() > BEHAVIOR_CHANGE_INTERVAL) {
                npc.setBehavior(NPCBehavior.PATROL);
                npc.setCurrentTarget(null);
                setRandomPatrolTarget(npc);
                npc.setLastActionTime(currentTime);
            }
        }

        // Update behavior to IDLE if NPC has stopped moving (reached target)
        if ((npc.getBehavior() == NPCBehavior.CHASE || npc.getBehavior() == NPCBehavior.PATROL) && !npc.isMoving()) {
            npc.setBehavior(NPCBehavior.IDLE);
        }
    }

    private String findClosestAlivePlayer(NPCState npc, Map<String, PlayerState> players) {
        String closestPlayer = null;
        float closestDistance = Float.MAX_VALUE;

        for (Map.Entry<String, PlayerState> entry : players.entrySet()) {
            PlayerState player = entry.getValue();

            if (player.isDead()) {
                continue;
            }

            float distance = npc.getDistanceTo(player.getX(), player.getY());

            if (distance < closestDistance) {
                closestDistance = distance;
                closestPlayer = entry.getKey();
            }
        }

        return closestPlayer;
    }

    private void setRandomPatrolTarget(NPCState npc) {
        float mapWidth = 1284.0f;
        float mapHeight = 1120.0f;

        float targetX = ThreadLocalRandom.current().nextFloat() * (mapWidth - 2 * MAP_BOUNDARY_MARGIN) + MAP_BOUNDARY_MARGIN;
        float targetY = ThreadLocalRandom.current().nextFloat() * (mapHeight - 2 * MAP_BOUNDARY_MARGIN) + MAP_BOUNDARY_MARGIN;

        npc.setTarget(targetX, targetY);
    }

    private void performNPCAttack(NPCState npc, PlayerState target) {
        if (!npc.canAttack()) {
            return;
        }

        float directionX = target.getX() - npc.getX();
        float directionY = target.getY() - npc.getY();
        float length = (float) Math.sqrt(directionX * directionX + directionY * directionY);

        if (length > 0) {
            directionX /= length;
            directionY /= length;
        }

        createNPCProjectile(npc, directionX, directionY);
        npc.performAttack();

        logger.debug("NPC {} attacked player {} at distance {}", npc.getId(), npc.getCurrentTarget(), length);
    }

    private void createNPCProjectile(NPCState npc, float directionX, float directionY) {
        combatSystem.createNPCProjectile(npc.getId(), npc.getX(), npc.getY(), directionX, directionY);
    }

    public synchronized void handleNPCDamage(String npcId, int damage) {
        NPCState npc = npcs.get(npcId);
        if (npc != null && !npc.isDead()) {
            boolean died = npc.takeDamage(damage);

            if (died) {
                logger.info("NPC {} was destroyed", npcId);
                // NPC deaths should not be recorded in player statistics
            }

            broadcastNPCDamage(npc, died);
        }
    }

    private void broadcastNPCSpawn(NPCState npc) {
        Map<String, Object> message = Map.of(
                "type", "npc_spawned",
                "id", npc.getId(),
                "x", npc.getX(),
                "y", npc.getY(),
                HEALTH_KEY, npc.getHealth(),
                "maxHealth", npc.getMaxHealth()
        );

        messaging.broadcast(JsonUtils.toJson(message));
    }

    private void broadcastNPCStates() {
        if (npcs.isEmpty()) {
            return;
        }

        Map<String, Object> message = new HashMap<>();
        message.put("type", "npc_update");

        Map<String, Object> npcStates = new HashMap<>();
        for (NPCState npc : npcs.values()) {
            Map<String, Object> npcData = Map.of(
                    "x", npc.getX(),
                    "y", npc.getY(),
                    "flipX", npc.isFlipX(),
                    HEALTH_KEY, npc.getHealth(),
                    "isDead", npc.isDead(),
                    "behavior", npc.getBehavior().toString()
            );
            npcStates.put(npc.getId(), npcData);
        }

        message.put("npcs", npcStates);
        messaging.broadcast(JsonUtils.toJson(message));
    }

    private void broadcastNPCDamage(NPCState npc, boolean died) {
        Map<String, Object> message = Map.of(
                "type", "npc_damaged",
                "id", npc.getId(),
                HEALTH_KEY, npc.getHealth(),
                "died", died
        );

        messaging.broadcast(JsonUtils.toJson(message));
    }

    public void reset() {
        npcs.clear();
        lastUpdateTime = 0;
    }

    public void cleanup() {
        npcs.clear();
    }

    // Getters
    public Map<String, NPCState> getNPCs() {
        return new HashMap<>(npcs);
    }

    public boolean hasNPCs() {
        return !npcs.isEmpty();
    }

    public int getNPCCount() {
        return npcs.size();
    }

    public int getAliveNPCCount() {
        return (int) npcs.values().stream().filter(npc -> !npc.isDead()).count();
    }
}
