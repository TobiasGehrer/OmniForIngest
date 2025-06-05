import Phaser from 'phaser';
import React, {useEffect, useRef, useState} from 'react';
import MenuScene from './scenes/MenuScene';
import MenuLoadingScene from './scenes/MenuLoadingScene.ts';
import './Game.css'
import eventBus from '../../utils/eventBus.ts';
import GameplayScene from './scenes/GameplayScene.ts';
import GameplayLoadingScene from './scenes/GameplayLoadingScene.ts';
import Notification from '../ui/Notification/Notification';
import GameUI from '../ui/GameUI/GameUI';
import Chat from '../ui/Chat/Chat';
import WebSocketService from '../services/WebSocketService.ts';
import GameConfig = Phaser.Types.Core.GameConfig;

interface GameProps {
    username?: string;
}

const Game: React.FC<GameProps> = () => {
    const [gameMode, setGameMode] = useState<'menu' | 'gameplay'>('menu');
    const gameInstance = useRef<Phaser.Game | null>(null);
    const [fetchedUserName, setFetchedUserName] = useState<string>('Unknown');
    const [isUsernameFetched, setIsUsernameFetched] = useState<boolean>(false);

    useEffect(() => {
        const fetchUserName = async () => {
            try {
                const response = await fetch('http://localhost:8080/me', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.username) {
                        // Set username in WebSocketService
                        WebSocketService.getInstance().setUsername(data.username);
                        setFetchedUserName(data.username);
                        setIsUsernameFetched(true);
                        console.log('Username set for WebSocket:', data.username);
                    }
                } else {
                    console.error('Failed to fetch username', response.statusText);
                    // Fall back to using a default username
                    WebSocketService.getInstance().setUsername('Unknown');
                    setFetchedUserName('Unknown');
                    setIsUsernameFetched(true);
                }
            } catch (error) {
                console.error('Error fetching username:', error);
                // Fall back to using a default username
                WebSocketService.getInstance().setUsername('Unknown');
                setFetchedUserName('Unknown');
                setIsUsernameFetched(true);
            }
        };

        fetchUserName();
    }, []); // Only run once on mount

    useEffect(() => {
        const handleStartGame = (data?: any) => {
            setGameMode('gameplay');
            // Store the map key in session storage to pass it to the GameplayScene
            if (data && data.mapKey) {
                sessionStorage.setItem('selectedMapKey', data.mapKey);
            }
        };

        const handleBackToMenu = () => {
            setGameMode('menu');
        };

        eventBus.on('startGame', handleStartGame);
        eventBus.on('backToMenu', handleBackToMenu);

        return () => {
            eventBus.off('startGame', handleStartGame);
            eventBus.off('backToMenu', handleBackToMenu);
        };
    }, []);

    useEffect(() => {
        // Don't create game until username is fetched
        if (!isUsernameFetched) {
            return;
        }

        console.log(`Creating game with mode ${gameMode}`)

        if (gameInstance.current) {
            console.log('Destroy previous game instance');
            gameInstance.current.destroy(true);
        }

        const config: GameConfig = {
            type: Phaser.AUTO,
            parent: 'phaser-container',
            scene: gameMode === 'menu'
                ? [MenuLoadingScene, MenuScene]
                : [GameplayLoadingScene, GameplayScene],
            physics: {
                default: 'arcade',
                arcade: {
                    debug: false
                }
            },
            width: 1600,
            height: 900,
            scale: {
                mode: Phaser.Scale.ENVELOP,
                width: 1600,
                height: 900
            },
            pixelArt: true,
            backgroundColor: '#63ab3f'
        };

        const game = new Phaser.Game(config);

        if (gameMode === 'gameplay') {
            game.registry.set('username', fetchedUserName);
        }

        return () => {
            game.destroy(true);
        };
    }, [gameMode, fetchedUserName, isUsernameFetched]);

    return (
        <>
            <div id="phaser-container"/>
            {gameMode === 'gameplay' && (
                <>
                    <Notification/>
                    <GameUI/>
                    <Chat displayDuration={5000} username={fetchedUserName}/>
                </>
            )}
        </>
    );
}

export default Game;
