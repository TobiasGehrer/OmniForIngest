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
import GameLobbyUI from '../ui/GameLobbyUI/GameLobbyUI';
import GameTimer from '../ui/GameTimer/GameTimer';
import GameScoreboard from '../ui/GameScoreboard/GameScoreboard';
import WebSocketService from '../services/WebSocketService.ts';
import Shop from '../ui/Shop/Shop.tsx';
import {getApiBaseUrl} from '../../utils/apiBaseUrl';
import GameConfig = Phaser.Types.Core.GameConfig;

interface GameProps {
    username?: string;
}

const Game: React.FC<GameProps> = () => {
    const [gameMode, setGameMode] = useState<'menu' | 'gameplay'>('menu');
    const gameInstance = useRef<Phaser.Game | null>(null);
    const [fetchedUserName, setFetchedUserName] = useState<string>('Unknown');
    const [isUsernameFetched, setIsUsernameFetched] = useState<boolean>(false);
    const [isShopOpen, setIsShopOpen] = useState<boolean>(false);
    const websocketService = useRef<WebSocketService>(WebSocketService.getInstance());

    useEffect(() => {
        const fetchUserName = async () => {
            try {
                const response = await fetch(`${getApiBaseUrl()}/me`, {
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
                        websocketService.current.setUsername(data.username);
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
                websocketService.current.setUsername('Unknown');
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
            if (data?.mapKey) {
                sessionStorage.setItem('selectedMapKey', data.mapKey);
            }
        };

        const handleBackToMenu = () => {
            console.log('Manual back to menu - disconnecting WebSocket');
            websocketService.current.shutdown();
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
        return () => {
            console.log('Game component unmounting - cleaning up websocket');
            websocketService.current.shutdown();

            if (gameInstance.current) {
                gameInstance.current.destroy(true);
            }
        }
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

        // Always set username in registry regardless of game mode
        game.registry.set('username', fetchedUserName);

        return () => {
            game.destroy(true);
        };
    }, [gameMode, fetchedUserName, isUsernameFetched]);

    useEffect(() => {
        const handleOpenShop = () => {
            console.log('handleOpenShop called, setting isShopOpen to true');
            setIsShopOpen(true);
        };

        const handleCloseShop = () => {
            console.log('handleCloseShop called, setting isShopOpen to false');
            setIsShopOpen(false);
        };

        eventBus.on('openShop', handleOpenShop);
        eventBus.on('closeShop', handleCloseShop);

        return () => {
            eventBus.off('openShop', handleOpenShop);
            eventBus.off('closeShop', handleCloseShop);
        };
    }, []);

    return (
        <>
            <div id="phaser-container"/>
            <Notification/>
            {gameMode === 'gameplay' && (
                <>
                    <GameUI/>
                    <Chat displayDuration={5000} username={fetchedUserName}/>
                    <GameLobbyUI username={fetchedUserName}/>
                    <GameTimer/>
                    <GameScoreboard username={fetchedUserName}/>
                </>
            )}
            <Shop
                username={fetchedUserName}
                isVisible={isShopOpen}
            />
        </>
    );
}

export default Game;
