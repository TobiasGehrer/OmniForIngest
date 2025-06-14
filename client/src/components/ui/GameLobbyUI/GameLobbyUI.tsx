import {useEffect, useState} from 'react';
import WebSocketService from '../../services/WebSocketService.ts';
import eventBus from '../../../utils/eventBus.ts';
import './GameLobbyUI.css';
import {getPlayerColorCSS} from '../../../utils/getPlayerColor.ts';
import useHoverSound from '../../../hooks/useHoverSound.ts';

interface RoomStatus {
    gameState: string;
    playerCount: number;
    maxPlayers: number;
    readyStates: Record<string, boolean>;
}

interface GameLobbyUIProps {
    username: string;
}

const GameLobbyUI: React.FC<GameLobbyUIProps> = ({username}) => {
    const [roomStatus, setRoomStatus] = useState<RoomStatus | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const websocketService = WebSocketService.getInstance();
    const playHoverSound = useHoverSound();

    console.log('GameLobbyUI component loaded for username:', username);

    useEffect(() => {
        const handleRoomStatus = (data: RoomStatus) => {
            setRoomStatus(data);
            setIsReady(data.readyStates[username] || false);
        };

        const handleCountdownStarted = (data: {
            duration: number
        }) => {
            setCountdown(data.duration);
        };

        const handleCountdown = (data: {
            seconds: number
        }) => {
            setCountdown(data.seconds);
        };

        const handleCountdownCancelled = () => {
            setCountdown(null);
        };

        const handleGameStarted = () => {
            setIsVisible(false);
            setCountdown(null);
        };

        const handleGameEnded = () => {
            setIsVisible(false);
            setCountdown(null);
        };

        // Register event handlers
        eventBus.on('room_status', handleRoomStatus);
        eventBus.on('countdown_started', handleCountdownStarted);
        eventBus.on('countdown', handleCountdown);
        eventBus.on('countdown_cancelled', handleCountdownCancelled);
        eventBus.on('game_started', handleGameStarted);
        eventBus.on('game_ended', handleGameEnded);

        return () => {
            eventBus.off('room_status', handleRoomStatus);
            eventBus.off('countdown_started', handleCountdownStarted);
            eventBus.off('countdown', handleCountdown);
            eventBus.off('countdown_cancelled', handleCountdownCancelled);
            eventBus.off('game_started', handleGameStarted);
            eventBus.off('game_ended', handleGameEnded);
        };
    }, [username]);

    const handleReadyToggle = () => {
        if (roomStatus?.gameState === 'WAITING') {
            websocketService.sendMessage('ready_toggle', {});
        }
    };

    console.log('GameLobbyUI render - isVisible:', isVisible, 'roomStatus:', roomStatus);

    if (!isVisible || !roomStatus) {
        console.log('GameLobbyUI hidden - isVisible:', isVisible, 'roomStatus exists:', !!roomStatus);
        return null;
    }

    const canToggleReady = roomStatus?.gameState === 'WAITING';
    const allPlayersReady = Object.values(roomStatus.readyStates).every(ready => ready);
    const readyCount = Object.values(roomStatus.readyStates).filter(ready => ready).length;

    return (
        <div className="game-lobby-ui">
            <div className="game-lobby-ui__container" data-title="Game Lobby">
                <div className="game-lobby-ui__header">
                    <div className="game-lobby-ui__player-count">
                        {roomStatus.playerCount}/{roomStatus.maxPlayers} Players
                    </div>
                </div>

                {countdown !== null ? (
                    <div className="game-lobby-ui__countdown">
                        <div className="game-lobby-ui__countdown-title">Game Starting In</div>
                        <div className="game-lobby-ui__countdown-number">{countdown}</div>
                    </div>
                ) : (
                    <div className="game-lobby-ui__content">
                        <div className="game-lobby-ui__players">
                            <h3>Ready {readyCount}/{roomStatus.playerCount}</h3>
                            <div className="game-lobby-ui__player-list">
                                {Object.entries(roomStatus.readyStates).map(([playerName, isPlayerReady]) => (
                                    <div
                                        key={playerName}
                                        className={`game-lobby-ui__player ${isPlayerReady ? 'game-lobby-ui__player--ready' : ''}`}
                                    >
                                        <span className="game-lobby-ui__player-name"
                                              style={{color: getPlayerColorCSS(playerName)}}>{playerName}</span>
                                        <span
                                            className={`game-lobby-ui__player-status ${isPlayerReady ? 'ready' : 'not-ready'}`}>
                                            {isPlayerReady ? (
                                                    <img width="16" height="16" alt="" src={'/ui/check.svg'}/>
                                                ) :
                                                <img width="16" height="16" alt="" src={'/ui/cross.svg'}/>
                                            }
                                            {isPlayerReady ? 'Ready' : 'Not Ready'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="game-lobby-ui__actions">
                            {roomStatus.playerCount < 2 && (
                                <div className="game-lobby-ui__waiting-message">
                                    Waiting for more players (minimum 2)
                                </div>
                            )}

                            <button
                                className={`button ${isReady ? 'ready' : 'not-ready'}`}
                                onClick={handleReadyToggle}
                                disabled={!canToggleReady}
                                variant="primary"
                                onMouseEnter={playHoverSound}
                            >
                                {isReady && (
                                    <img width="16" height="16" alt="" src={'/ui/check.svg'}/>
                                )}
                                {isReady ? ' Ready' : 'Ready Up'}
                            </button>

                            {roomStatus.playerCount >= 2 && allPlayersReady && (
                                <div className="game-lobby-ui__start-message">
                                    All players ready! Game starting...
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GameLobbyUI;
