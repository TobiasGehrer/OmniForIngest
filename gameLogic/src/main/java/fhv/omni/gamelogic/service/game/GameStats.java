package fhv.omni.gamelogic.service.game;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class GameStats {
    private static final String DEATH_ORDER_KEY = "deathOrder";
    private static final String PLAYER_ID_KEY = "playerId";

    private final Map<String, Integer> playerKills = new ConcurrentHashMap<>();
    private final List<String> deathOrder = new ArrayList<>();
    private final Map<String, Integer> playerCoinsAwarded = new ConcurrentHashMap<>();
    private long gameStartTime = 0;
    private long gameEndTime = 0;

    public void reset() {
        playerKills.clear();
        deathOrder.clear();
        playerCoinsAwarded.clear();
        gameStartTime = System.currentTimeMillis();
        gameEndTime = 0;
    }

    public void recordKill(String killerId, String victimId) {
        playerKills.put(killerId, playerKills.getOrDefault(killerId, 0) + 1);
        recordDeath(victimId);
    }

    public void recordDeath(String victimId) {
        if (!deathOrder.contains(victimId)) {
            deathOrder.add(victimId);
        }
    }

    public void calculateFinalStats(Map<String, PlayerState> playerStates) {
        gameEndTime = System.currentTimeMillis();

        for (String playerId : playerStates.keySet()) {
            playerKills.putIfAbsent(playerId, 0);
        }
    }

    public void setCoinsAwarded(Map<String, Integer> coinsAwarded) {
        this.playerCoinsAwarded.clear();
        this.playerCoinsAwarded.putAll(coinsAwarded);
    }

    public Map<String, Object> getStatsAsMap() {
        Map<String, Object> stats = new HashMap<>();

        long gameDuration = gameEndTime > 0 ? gameEndTime - gameStartTime : 0;
        stats.put("gameDuration", gameDuration);
        stats.put("playerKills", new HashMap<>(playerKills));
        stats.put("playerCoinsAwarded", new HashMap<>(playerCoinsAwarded));

        List<Map<String, Object>> deathOrderList = new ArrayList<>();

        for (int i = 0; i < deathOrder.size(); i++) {
            Map<String, Object> deathInfo = new HashMap<>();
            deathInfo.put(PLAYER_ID_KEY, deathOrder.get(i));
            deathInfo.put(DEATH_ORDER_KEY, i + 1);
            deathInfo.put("deathTime", gameStartTime + (i * 10000)); // Placeholder
            deathOrderList.add(deathInfo);
        }

        stats.put(DEATH_ORDER_KEY, deathOrderList);
        stats.put("rankings", calculateRankings());
        return stats;
    }

    private List<Map<String, Object>> calculateRankings() {
        List<Map<String, Object>> rankings = new ArrayList<>();
        Set<String> allPlayers = playerKills.keySet();
        Set<String> deadPlayers = new HashSet<>(deathOrder);

        List<String> survivors = new ArrayList<>();
        for (String player : allPlayers) {
            if (!deadPlayers.contains(player)) {
                survivors.add(player);
            }
        }
        survivors.sort((a, b) -> Integer.compare(playerKills.get(b), playerKills.get(a)));

        int rank = 1;

        for (String survivor : survivors) {
            Map<String, Object> playerRank = new HashMap<>();
            playerRank.put(PLAYER_ID_KEY, survivor);
            playerRank.put("rank", rank++);
            playerRank.put("kills", playerKills.get(survivor));
            playerRank.put("status", "survivor");
            playerRank.put("coinsAwarded", playerCoinsAwarded.getOrDefault(survivor, 0));
            rankings.add(playerRank);
        }

        for (int i = deathOrder.size() - 1; i >= 0; i--) {
            String deadPlayer = deathOrder.get(i);
            Map<String, Object> playerRank = new HashMap<>();
            playerRank.put(PLAYER_ID_KEY, deadPlayer);
            playerRank.put("rank", rank++);
            playerRank.put("kills", playerKills.get(deadPlayer));
            playerRank.put("status", "eliminated");
            playerRank.put(DEATH_ORDER_KEY, i + 1);
            playerRank.put("coinsAwarded", playerCoinsAwarded.getOrDefault(deadPlayer, 0));
            rankings.add(playerRank);
        }

        return rankings;
    }

    public Map<String, Integer> getPlayerKills() {
        return new HashMap<>(playerKills);
    }

    public List<String> getDeathOrder() {
        return new ArrayList<>(deathOrder);
    }

    public long getGameDuration() {
        return gameEndTime > 0 ? gameEndTime - gameStartTime : 0;
    }
}