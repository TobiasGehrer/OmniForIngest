package fhv.omni.gamelogic.service.game;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class GameStats {
    private final Map<String, Integer> playerKills = new ConcurrentHashMap<>();
    private final List<DeathRecord> deathOrder = new ArrayList<>();
    private long gameStartTime = 0;
    private long gameEndTime = 0;

    public static class DeathRecord {
        private final String playerId;
        private final long deathTime;
        private final int deathOrder;

        public DeathRecord(String playerId, long deathTime, int deathOrder) {
            this.playerId = playerId;
            this.deathTime = deathTime;
            this.deathOrder = deathOrder;
        }

        public String getPlayerId() {
            return playerId;
        }

        public long getDeathTime() {
            return deathTime;
        }

        public int getDeathOrder() {
            return deathOrder;
        }
    }

    public void reset() {
        playerKills.clear();
        deathOrder.clear();
        gameStartTime = System.currentTimeMillis();
        gameEndTime = 0;
    }

    public void recordKill(String killerId, String victimId) {
        playerKills.put(killerId, playerKills.getOrDefault(killerId, 0) + 1);

        DeathRecord deathRecord = new DeathRecord(
                victimId,
                System.currentTimeMillis(),
                deathOrder.size() + 1
        );

        deathOrder.add(deathRecord);
    }

    public void calculateFinalStats(Map<String, PlayerState> playerStates) {
        gameEndTime = System.currentTimeMillis();

        for (Map.Entry<String, PlayerState> entry : playerStates.entrySet()) {
            String playerId = entry.getKey();
            PlayerState state = entry.getValue();

            if (state.isDead() && deathOrder.stream().noneMatch(d -> d.getPlayerId().equals(playerId))) {
                DeathRecord deathRecord = new DeathRecord(
                        playerId,
                        gameEndTime,
                        deathOrder.size() + 1
                );

                deathOrder.add(deathRecord);
            }
        }
    }

    public Map<String, Object> getStatsAsMap() {
        Map<String, Object> stats = new HashMap<>();

        long gameDuration = gameEndTime > 0 ? gameEndTime - gameStartTime : 0;
        stats.put("gameDuration", gameDuration);
        stats.put("playerKills", new HashMap<>(playerKills));

        List<Map<String, Object>> deathOrderList = new ArrayList<>();
        for (DeathRecord record : deathOrder) {
            Map<String, Object> deathInfo = new HashMap<>();
            deathInfo.put("playerId", record.getPlayerId());
            deathInfo.put("deathOrder", record.getDeathOrder());
            deathInfo.put("deathTime", record.getDeathTime());
            deathOrderList.add(deathInfo);
        }

        stats.put("deathOrder", deathOrderList);

        List<Map<String, Object>> rankings = calculateRankings();
        stats.put("rankings", rankings);

        return stats;
    }

    private List<Map<String, Object>> calculateRankings() {
        List<Map<String, Object>> rankings = new ArrayList<>();

        List<DeathRecord> reversedDeaths = new ArrayList<>(deathOrder);
        Collections.reverse(reversedDeaths);

        int rank = 1;
        for (DeathRecord record : reversedDeaths) {
            Map<String, Object> playerRank = new HashMap<>();
            playerRank.put("playerId", record.getPlayerId());
            playerRank.put("rank", rank++);
            playerRank.put("kills", playerKills.getOrDefault(record.getPlayerId(), 0));
            playerRank.put("status", "eliminated");
            playerRank.put("deathOrder", record.getDeathOrder());
            rankings.add(playerRank);
        }

        // Survivors get rank 1 or tie for rank 1 if multiple survivors
        Set<String> deadPlayers = new HashSet<>();
        deathOrder.forEach(record -> {deadPlayers.add(record.getPlayerId());});

        List<String> survivors = new ArrayList<>();
        for (String playerId : playerKills.keySet()) {
            if (!deadPlayers.contains(playerId)) {
                survivors.add(playerId);
            }
        }

        survivors.sort((a, b) -> Integer.compare(
                playerKills.getOrDefault(b, 0),
                playerKills.getOrDefault(a, 0)
        ));

        List<Map<String, Object>> survivorRankings = new ArrayList<>();
        for (String survivor : survivors) {
            Map<String, Object> playerRank = new HashMap<>();
            playerRank.put("playerId", survivor);
            playerRank.put("rank", 1);
            playerRank.put("kills", playerKills.getOrDefault(survivor, 0));
            playerRank.put("status", "survivor");
            survivorRankings.add(playerRank);
        }

        survivorRankings.addAll(rankings);

        return survivorRankings;
    }

    public Map<String, Integer> getPlayerKills() {
        return new HashMap<>(playerKills);
    }

    public List<DeathRecord> getDeathOrder() {
        return new ArrayList<>(deathOrder);
    }

    public long getGameDuration() {
        return gameEndTime > 0 ? gameEndTime - gameStartTime : 0;
    }
}
