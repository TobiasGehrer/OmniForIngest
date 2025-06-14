import React, {useEffect, useState} from 'react';
import eventBus from '../../../utils/eventBus';
import './GameScoreboard.css';
import {getPlayerColorCSS} from '../../../utils/getPlayerColor.ts';

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

const GameScoreboard: React.FC<GameScoreboardProps> = ({username}) => {
    const [gameEndData, setGameEndData] = useState<GameEndData | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [autoReturnCountdown, setAutoReturnCountdown] = useState<number>(0);

    useEffect(() => {
        const handleGameEnded = (data: GameEndData) => {
            setGameEndData(data);
            setIsVisible(true);
            setAutoReturnCountdown(15);
            // Stop background music when game ends and scoreboard appears
            eventBus.emit('stopBackgroundMusic');
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

    useEffect(() => {
        if (!isVisible || !gameEndData) return;
        const localPlayerRank = gameEndData.stats.rankings.find(r => r.playerId === username);
        if (!localPlayerRank) return;

        // Delay playing sound effects to allow background music to fade out
        const soundEffectDelay = 500;

        let audio: HTMLAudioElement | null = null;
        let audio2: HTMLAudioElement | null = null;

        if (localPlayerRank.rank === 1) {
            audio = new window.Audio('/assets/audio/fx/victory.mp3');
            audio.volume = 0.3;
            audio2 = new window.Audio('/assets/audio/fx/victory_2.mp3');
            audio2.volume = 0.15;
        } else {
            audio = new window.Audio('/assets/audio/fx/defeat.mp3');
            audio.volume = 0.3;
            audio2 = new window.Audio('/assets/audio/fx/defeat_2.mp3');
            audio2.volume = 0.15;
        }

        // Use setTimeout to delay playing the sound effects
        const timer = setTimeout(() => {
            if (audio) {
                audio.play();
            }
            if (audio2) {
                audio2.play();
            }
        }, soundEffectDelay);

        return () => {
            // Clear the timeout if the component unmounts before the sounds play
            clearTimeout(timer);

            if (audio) {
                audio.pause();
            }
            if (audio2) {
                audio2.pause();
            }
        };
    }, [isVisible, gameEndData, username]);

    const handleBackToMenu = () => {
        // Stop the countdown timer immediately
        setAutoReturnCountdown(0);
        setIsVisible(false);
        eventBus.emit('backToMenu');
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
            case 1:
                return '#ffd700'; // Gold
            case 2:
                return '#f3edff'; // Silver
            case 3:
                return '#cd7f32'; // Bronze
            default:
                return '#94a3b8'; // Gray
        }
    };

    const getRankText = (rank: number): string => {
        switch (rank) {
            case 1:
                return 'First';
            case 2:
                return 'Second';
            case 3:
                return 'Third';
            default:
                return `${rank}th`;
        }
    };

    const localPlayerRank = gameEndData.stats.rankings.find(r => r.playerId === username);

    // Determine if player won or lost
    const isVictory = localPlayerRank?.rank === 1;
    const gameResultText = isVictory ? 'Victory' : 'Defeat';
    const resultClass = isVictory ? 'victory' : 'defeat';

    return (
        <div className="game-scoreboard">
            <div className={'game-scoreboard__container ' + resultClass} data-title={gameResultText}>
                <div className="game-scoreboard__content">
                    <div className="game-scoreboard__header">
                        <div className="game-scoreboard__reason">{gameEndData.reason}</div>
                        <div className="game-scoreboard__duration">
                            Duration: {formatDuration(gameEndData.stats.gameDuration)}
                        </div>
                    </div>

                    {localPlayerRank && (
                        <div className="game-scoreboard__your-result">
                            <div className="game-scoreboard__your-rank">
                                You finished <span
                                style={{color: getRankColor(localPlayerRank.rank)}}>{getRankText(localPlayerRank.rank)}</span>
                            </div>
                            <div className="game-scoreboard__your-stats">
                                {localPlayerRank.kills} kills • {localPlayerRank.status}
                                {localPlayerRank.coinsAwarded && (
                                    <span
                                        className="game-scoreboard__your-stats-inner"> • {localPlayerRank.coinsAwarded}
                                        <img src="/ui/cash.svg" alt=""/></span>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="game-scoreboard__rankings">
                        <h3>Ranking</h3>
                        <div className="game-scoreboard__ranking-list">
                            {gameEndData.stats.rankings.map((player) => (
                                <div
                                    key={player.playerId}
                                    className={`game-scoreboard__ranking-item ${player.playerId === username ? 'game-scoreboard__ranking-item--local' : ''}`}
                                >
                                    <div className="game-scoreboard__rank" style={{color: getRankColor(player.rank)}}>
                                        {player.rank}
                                    </div>
                                    <div className="game-scoreboard__player-info">
                                        <div className="game-scoreboard__player-name"
                                             style={{color: getPlayerColorCSS(player.playerId)}}>
                                            {player.playerId}
                                            {player.playerId === username &&
                                                <span className="game-scoreboard__you-label"> (You)</span>}
                                        </div>
                                        <div className="game-scoreboard__player-stats">
                                            {player.kills} Kills • {player.status}
                                            {player.coinsAwarded && (
                                                <span
                                                    className="game-scoreboard__player-stats-inner"> • {player.coinsAwarded}
                                                    <img src="/ui/cash.svg" alt=""/></span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="game-scoreboard__actions">
                        <button
                            className="button"
                            onClick={handleBackToMenu}
                            variant="primary"
                        >
                            <span className="game-scoreboard__btn-text">Back to Menu</span>
                            <span className="game-scoreboard__btn-countdown">
                            {autoReturnCountdown > 0 ? `(${autoReturnCountdown})` : ''}
                        </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameScoreboard;
