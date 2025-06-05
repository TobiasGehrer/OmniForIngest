import React, {useCallback, useEffect, useState} from 'react';
import useEscapeKey from '../../../hooks/useEscapeKey';
import useHoverSound from '../../../hooks/useHoverSound';
import './EscapeMenu.css';
import eventBus from '../../../utils/eventBus.ts'

const EscapeMenu: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const playHoverSound = useHoverSound();

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

        eventBus.on('openEscapeMenu', handleOpenMenu);
        eventBus.on('closeEscapeMenu', handleCloseMenu);
        eventBus.on('gamePause', handleGamePause);

        return () => {
            eventBus.off('openEscapeMenu', handleOpenMenu);
            eventBus.off('closeEscapeMenu', handleCloseMenu);
            eventBus.off('gamePause', handleGamePause);
        };
    }, [isVisible, closeMenu, toggleMenu]);

    // Handle escape key press
    useEscapeKey(toggleMenu);

    const handleResume = () => {
        closeMenu();
    };

    const handlePlayMultiplayer = () => {
        closeMenu();
        eventBus.emit('startGame');
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

                <li>
                    <button
                        type="button"
                        className="button"
                        variant="primary"
                        buttonsize="big"
                        onClick={handlePlayMultiplayer}
                        onMouseEnter={playHoverSound}
                    >
                        Play Multiplayer
                    </button>
                </li>

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
