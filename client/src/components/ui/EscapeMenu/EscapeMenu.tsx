import React, {useCallback, useEffect, useState} from 'react';
import useEscapeKey from '../../../hooks/useEscapeKey';
import useHoverSound from '../../../hooks/useHoverSound';
import './EscapeMenu.css';
import eventBus from '../../../utils/eventBus.ts'
import WebSocketService from "../../services/WebSocketService.ts";

const EscapeMenu: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [isInGame, setIsInGame] = useState(false);
    const playHoverSound = useHoverSound();
    const websocketService = WebSocketService.getInstance();

    // Toggle menu visibility and emit appropriate events
    const toggleMenu = useCallback(() => {
        setIsVisible((prev) => {
            const newState = !prev;
            eventBus.emit(newState ? 'escapeMenuOpen' : 'escapeMenuClose');
            return newState;
        });
    }, []);

    // Close menu and emit appropriate event
    const closeMenu = useCallback(() => {
        setIsVisible(false);
        eventBus.emit('escapeMenuClose');
    }, []);

    // Listen for external requests to open/close the menu
    useEffect(() => {
        const handleOpenMenu = () => {
            if (!isVisible) {
                toggleMenu();
            }
        };

        const handleCloseMenu = () => {
            if (isVisible) {
                closeMenu();
            }
        };

        // Listen for game events that should toggle the menu
        const handleGamePause = () => {
            if (!isVisible) {
                toggleMenu();
            }
        };

        // Listen for game state changes to show/gide Leave Game button
        const handleRoomStatus = () => {
            setIsInGame(true);
        }

        const handleGameEnded = () => {
            setIsInGame(false);
        }

        const handleBackToMenu = () => {
            setIsInGame(false);
        }

        eventBus.on('openEscapeMenu', handleOpenMenu);
        eventBus.on('closeEscapeMenu', handleCloseMenu);
        eventBus.on('gamePause', handleGamePause);
        eventBus.on('room_status', handleRoomStatus);
        eventBus.on('game_ended', handleGameEnded);
        eventBus.on('backToMenu', handleBackToMenu);

        return () => {
            eventBus.off('openEscapeMenu', handleOpenMenu);
            eventBus.off('closeEscapeMenu', handleCloseMenu);
            eventBus.off('gamePause', handleGamePause);
            eventBus.off('room_status', handleRoomStatus);
            eventBus.off('game_ended', handleGameEnded);
            eventBus.off('backToMenu', handleBackToMenu);
        };
    }, [isVisible, closeMenu, toggleMenu]);

    // Handle escape key press
    useEscapeKey(toggleMenu);

    const handleResume = () => {
        closeMenu();
    };

    const handleLeaveGame = () => {
        closeMenu();
        websocketService.disconnect();
        eventBus.emit('backToMenu');
    };

    const handleLogout = async () => {
        closeMenu();

        try {
            await fetch('http://localhost:8080/logout', {
                method: 'POST',
                credentials: 'include',
            });

            eventBus.emit('userLogout');
            window.location.href = '/';
        } catch (error) {
            console.error('Error during logout:', error);
            eventBus.emit('userLogout');
            window.location.href = '/';
        }
    };

    if (!isVisible) return null;

    return (
        <div className="escape-menu">
            <ul className="escape-menu__list" role="list">
                <li>
                    <button
                        type="button"
                        className="button"
                        variant="primary"
                        buttonsize="big"
                        onClick={handleResume}
                        onMouseEnter={playHoverSound}
                    >
                        Resume
                    </button>
                </li>

                {isInGame && (
                    <li>
                        <button
                            type="button"
                            className="button"
                            variant="primary"
                            buttonsize="big"
                            onClick={handleLeaveGame}
                            onMouseEnter={playHoverSound}
                        >
                            Leave Game
                        </button>
                    </li>
                )}

                <li>
                    <button
                        type="button"
                        className="button"
                        variant="primary"
                        buttonsize="big"
                        onClick={handleLogout}
                        onMouseEnter={playHoverSound}
                    >
                        Logout
                    </button>
                </li>
            </ul>
        </div>
    );
};

export default EscapeMenu;
