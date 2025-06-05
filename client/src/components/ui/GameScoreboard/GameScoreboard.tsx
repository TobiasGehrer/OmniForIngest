import React, {useEffect, useState} from 'react';
import eventBus from '../../../utils/eventBus';
import './GameScoreboard.css';

interface PlayerRanking {
    playerId: string;
    rank: number;
    kills: number;
    status: 'survivor' | 'eliminated';
    deathOrder?: number;
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

    useEffect(() => {
        const handleGameEnded = (data: GameEndData) => {
            setGameEndData(data);
            setIsVisible(true);
        };

        const handleGameStarted = () => {
            setIsVisible(false);
            setGameEndData(null);
        };

        // Register event handlers
        eventBus.on('game_ended', handleGameEnded);
        eventBus.on('game_started', handleGameStarted);

        return () => {
            eventBus.off('game_ended', handleGameEnded);
            eventBus.off('game_started', handleGameStarted);
        };
    }, []);

    const handleClose = () => {
        setIsVisible(false);
    };

    const handleBackToMenu = () => {
        eventBus.emit('backToMenu');
        setIsVisible(false);
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
            case 1: return '👑';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return `#${rank}`;
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
                            You finished {getRankIcon(localPlayerRank.rank)}
                        </div>
                        <div className="game-scoreboard__your-stats">
                            {localPlayerRank.kills} kills • {localPlayerRank.status}
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
                        Back to Menu
                    </button>
                    <button
                        className="game-scoreboard__btn game-scoreboard__btn--secondary"
                        onClick={handleClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GameScoreboard;