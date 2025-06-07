import React, {useEffect, useState} from 'react';
import eventBus from '../../../utils/eventBus';
import './GameScoreboard.css';

interface PlayerRanking {
    playerId: string;
    rank: number;
    kills: number;
    status: 'survivor' | 'eliminated';
    deathOrder?: number;
    coinsAwarded?: number;
}

interface GameStats {
    gameDuration: number;
    playerKills: Record<string, number>;
    rankings: PlayerRanking[];
    deathOrder: Array<{
        playerId: string;
        deathOrder: number;
        deathTime: number;
    }>;
}

interface GameEndData {
    reason: string;
    stats: GameStats;
}

interface GameScoreboardProps {
    username: string;
}

const GameScoreboard: React.FC<GameScoreboardProps> = ({ username }) => {
    const [gameEndData, setGameEndData] = useState<GameEndData | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [autoReturnCountdown, setAutoReturnCountdown] = useState<number>(0);

    useEffect(() => {
        const handleGameEnded = (data: GameEndData) => {
            setGameEndData(data);
            setIsVisible(true);
            setAutoReturnCountdown(15); // 15 seconds to read the scoreboard
        };

        const handleGameStarted = () => {
            setIsVisible(false);
            setGameEndData(null);
            setAutoReturnCountdown(0);
        };

        // Register event handlers
        eventBus.on('game_ended', handleGameEnded);
        eventBus.on('game_started', handleGameStarted);

        return () => {
            eventBus.off('game_ended', handleGameEnded);
            eventBus.off('game_started', handleGameStarted);
        };
    }, []);

    // Auto-return countdown timer
    useEffect(() => {
        if (autoReturnCountdown > 0) {
            const timer = setTimeout(() => {
                setAutoReturnCountdown(autoReturnCountdown - 1);
            }, 1000);

            return () => clearTimeout(timer);
        } else if (autoReturnCountdown === 0 && isVisible && gameEndData) {
            // Auto return to menu when countdown reaches 0
            handleBackToMenu();
        }
    }, [autoReturnCountdown, isVisible, gameEndData]);

    const handleBackToMenu = () => {
        eventBus.emit('backToMenu');
        setIsVisible(false);
        setAutoReturnCountdown(0);
    };

    console.log('GameScoreboard render - isVisible:', isVisible, 'gameEndData:', gameEndData);

    if (!isVisible || !gameEndData) {
        console.log('GameScoreboard hidden - isVisible:', isVisible, 'gameEndData exists:', !!gameEndData);
        return null;
    }

    const formatDuration = (milliseconds: number): string => {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const getRankColor = (rank: number): string => {
        switch (rank) {
            case 1: return '#ffd700'; // Gold
            case 2: return '#c0c0c0'; // Silver
            case 3: return '#cd7f32'; // Bronze
            default: return '#94a3b8'; // Gray
        }
    };

    const getRankIcon = (rank: number): string => {
        switch (rank) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return `${rank}`;
        }
    };

    const getRankText = (rank: number): string => {
        switch (rank) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return `${rank}th`;
        }
    };

    const localPlayerRank = gameEndData.stats.rankings.find(r => r.playerId === username);

    return (
        <div className="game-scoreboard">
            <div className="game-scoreboard__container">
                <div className="game-scoreboard__header">
                    <h2>Game Over</h2>
                    <div className="game-scoreboard__reason">{gameEndData.reason}</div>
                    <div className="game-scoreboard__duration">
                        Game Duration: {formatDuration(gameEndData.stats.gameDuration)}
                    </div>
                </div>

                {localPlayerRank && (
                    <div className="game-scoreboard__your-result">
                        <div className="game-scoreboard__your-rank">
                            You finished {getRankText(localPlayerRank.rank)}
                        </div>
                        <div className="game-scoreboard__your-stats">
                            {localPlayerRank.kills} kills • {localPlayerRank.status}
                            {localPlayerRank.coinsAwarded && (
                                <span> • {localPlayerRank.coinsAwarded} 🪙</span>
                            )}
                        </div>
                    </div>
                )}

                <div className="game-scoreboard__rankings">
                    <h3>Final Rankings</h3>
                    <div className="game-scoreboard__ranking-list">
                        {gameEndData.stats.rankings.map((player) => (
                            <div
                                key={player.playerId}
                                className={`game-scoreboard__ranking-item ${player.playerId === username ? 'game-scoreboard__ranking-item--local' : ''}`}
                            >
                                <div className="game-scoreboard__rank" style={{ color: getRankColor(player.rank) }}>
                                    {getRankIcon(player.rank)}
                                </div>
                                <div className="game-scoreboard__player-info">
                                    <div className="game-scoreboard__player-name">
                                        {player.playerId}
                                        {player.playerId === username && <span className="game-scoreboard__you-label"> (You)</span>}
                                    </div>
                                    <div className="game-scoreboard__player-stats">
                                        {player.kills} kills • {player.status}
                                        {player.coinsAwarded && (
                                            <span> • {player.coinsAwarded} 🪙</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="game-scoreboard__actions">
                    <button
                        className="game-scoreboard__btn game-scoreboard__btn--primary"
                        onClick={handleBackToMenu}
                    >
                        <span className="game-scoreboard__btn-text">Back to Menu</span>
                        <span className="game-scoreboard__btn-countdown">
                            {autoReturnCountdown > 0 ? `(${autoReturnCountdown})` : ''}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GameScoreboard;