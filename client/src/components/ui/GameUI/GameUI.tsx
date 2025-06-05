import React, {useEffect, useState} from 'react';
import eventBus from '../../../utils/eventBus';
import {getPlayerColorCSS} from '../../../utils/getPlayerColor.ts';
import './GameUI.css';

interface ConnectionInfo {
    username: string;
    isConnected: boolean;
    playerCount: number;
}

interface PlayerHealthInfo {
    health: number;
    isDead: boolean;
}

const GameUI: React.FC = () => {
    const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null);
    const [playerHealth, setPlayerHealth] = useState<PlayerHealthInfo>({
        health: 4,
        isDead: false
    });

    useEffect(() => {
        const handleConnectionUpdate = (info: ConnectionInfo) => {
            setConnectionInfo(info);
        };

        const handleHealthUpdate = (info: PlayerHealthInfo) => {
            setPlayerHealth(info);
        };

        eventBus.on('updateConnectionInfo', handleConnectionUpdate);
        eventBus.on('updatePlayerHealth', handleHealthUpdate);

        return () => {
            eventBus.off('updateConnectionInfo', handleConnectionUpdate);
            eventBus.off('updatePlayerHealth', handleHealthUpdate);
        };
    }, []);

    if (!connectionInfo) {
        return null;
    }

    // Determine which health bar image to show based on health
    const healthBarImage = `/assets/sprites/ui/healthbar.png`;
    const healthFrame = Math.max(0, Math.min(4, playerHealth.health));

    // Don't show health bar if player is dead
    const showHealthBar = !playerHealth.isDead;
    const healthbarScale = 4; // Keep in sync with the CSS --healthbar-scale

    return (
        <div className="game-ui">
            <div className="game-ui__connection-info">
                <div>Name:
                    <span style={{color: getPlayerColorCSS(connectionInfo.username)}}>
                        {' ' + connectionInfo.username}
                    </span>
                </div>
                <div>Status:
                    <span className={`game-ui__ping${connectionInfo.isConnected ? ' game-ui__ping--active' : ''}`}>
                        {connectionInfo.isConnected ? ' Connected' : ' Disconnected'}
                    </span>
                </div>
                <div>Players: {connectionInfo.playerCount}</div>
            </div>

            {showHealthBar && (
                <div className="game-ui__player-health">
                    <span className="game-ui__player-health-label">Health</span>
                    <div
                        className="game-ui__player-health-bar"
                        style={{
                            backgroundImage: `url(${healthBarImage})`,
                            backgroundPosition: `-${(4 - healthFrame) * (42 * healthbarScale)}px 0`,
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default GameUI;
