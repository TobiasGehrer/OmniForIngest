import WebSocketService from '../../services/WebSocketService.ts';
import PlayerManager from './PlayerManager';
import NotificationManager from './NotificationManager';
import ProjectileManager from './ProjectileManager';
import SpawnPointManager from './SpawnPointManager.ts';
import eventBus from '../../../utils/eventBus.ts';
import NPCManager from './NPCManager.ts';

export default class WebSocketHandler {
    private readonly websocket: WebSocketService;
    private readonly playerManager: PlayerManager;
    private readonly notificationManager: NotificationManager;
    private readonly projectileManager: ProjectileManager;
    private readonly npcManager: NPCManager;
    private readonly username: string;
    private readonly scene: Phaser.Scene;

    // Store bound handlers for cleanup
    private readonly boundHandlers: Map<string, (data: any) => void> = new Map();

    constructor(
        scene: Phaser.Scene,
        websocket: WebSocketService,
        playerManager: PlayerManager,
        notificationManager: NotificationManager,
        projectileManager: ProjectileManager,
        npcManager: NPCManager,
    ) {
        this.scene = scene;
        this.websocket = websocket;
        this.playerManager = playerManager;
        this.notificationManager = notificationManager;
        this.projectileManager = projectileManager;
        this.npcManager = npcManager;

        const username = this.websocket.getUsername();
        if (!username) {
            // If no username is found, redirect to login screen
            this.redirectToLogin();
            // Set a temporary ID to prevent errors during redirection
            this.username = 'redirecting';
        } else {
            this.username = username;
        }

        // Clear any existing handlers from previous games before setting up new ones
        this.clearAllExistingHandlers();
        this.setupMessageHandler();
    }

    connect(): void {
        if (!this.websocket.isSocketConnected()) {
            this.websocket.connect();
        }
    }

    isConnected(): boolean {
        return this.websocket.isSocketConnected();
    }

    public cleanup(): void {
        // Remove all message handlers to prevent duplicate handlers
        this.boundHandlers.forEach((handler, type) => {
            this.websocket.offMessageType(type, handler);
        });
        this.boundHandlers.clear();
    }

    private redirectToLogin(): void {
        // Use setTimeout to ensure this happens after current execution context
        setTimeout(() => {
            // Check if we're in a browser environment
            if (typeof window !== 'undefined') {
                // Navigate to login page
                window.location.href = '/login';
            }
        }, 100);
    }

    private setupMessageHandler(): void {
        // Register handlers for specific message types and store bound references
        const handlers = [
            {
                type: 'player_joined',
                handler: this.handlePlayerJoined.bind(this)
            },
            {
                type: 'player_left',
                handler: this.handlePlayerLeft.bind(this)
            },
            {
                type: 'player_update',
                handler: this.handlePlayerUpdate.bind(this)
            },
            {
                type: 'game_state',
                handler: this.handleGameState.bind(this)
            },
            {
                type: 'player_list',
                handler: this.handlePlayerList.bind(this)
            },
            {
                type: 'player_damaged',
                handler: this.handlePlayerDamaged.bind(this)
            },
            {
                type: 'player_healed',
                handler: this.handlePlayerHealed.bind(this)
            },
            {
                type: 'player_skin_changed',
                handler: this.handlePlayerSkinChanged.bind(this)
            },
            {
                type: 'projectile_created',
                handler: this.handleProjectileCreated.bind(this)
            },
            {
                type: 'projectile_removed',
                handler: this.handleProjectileRemoved.bind(this)
            },
            {
                type: 'room_status',
                handler: this.handleRoomStatus.bind(this)
            },
            {
                type: 'countdown_started',
                handler: this.handleCountdownStarted.bind(this)
            },
            {
                type: 'countdown',
                handler: this.handleCountdown.bind(this)
            },
            {
                type: 'countdown_cancelled',
                handler: this.handleCountdownCancelled.bind(this)
            },
            {
                type: 'game_started',
                handler: this.handleGameStarted.bind(this)
            },
            {
                type: 'game_ended',
                handler: this.handleGameEnded.bind(this)
            },
            {
                type: 'time_remaining',
                handler: this.handleTimeRemaining.bind(this)
            },
            {
                type: 'connection_failed',
                handler: this.handleConnectionFailed.bind(this)
            },
            {
                type: 'room_shutdown',
                handler: this.handleRoomShutdown.bind(this)
            },
            {
                type: 'chat_message',
                handler: this.handleChatMessage.bind(this)
            },
            {
                type: 'growing_damage_zone_start',
                handler: this.handleGrowingDamageZoneStart.bind(this)
            },
            {
                type: 'growing_damage_zone_update',
                handler: this.handleGrowingDamageZoneUpdate.bind(this)
            },
            {
                type: 'growing_damage_zone_stop',
                handler: this.handleGrowingDamageZoneStop.bind(this)
            },
            {
                type: 'npc_spawned',
                handler: this.handleNPCSpawned.bind(this)
            },
            {
                type: 'npc_update',
                handler: this.handleNPCUpdate.bind(this)
            },
            {
                type: 'npc_damaged',
                handler: this.handleNPCDamaged.bind(this)
            },
        ];

        handlers.forEach(({
                              type,
                              handler
                          }) => {
            this.boundHandlers.set(type, handler);
            this.websocket.onMessageType(type, handler);
        });

        // Send spawn points to server after connection
        this.websocket.onMessageType('room_status', () => {
            this.sendSpawnPointsToServer();
        });
    }

    private sendSpawnPointsToServer(): void {
        const spawnPoints = SpawnPointManager.getInstance().getAllSpawnpoints();
        if (spawnPoints.length > 0) {
            this.websocket.sendMessage('spawn_points', {
                spawnPoints: spawnPoints
            });
        }
    }

    private handleProjectileCreated(data: any): void {
        // Create a projectile with the data from the server
        this.projectileManager.createProjectile(
            data.x,
            data.y,
            data.directionX,
            data.directionY,
            data.ownerId,
            data.id,
            data.isNPC ?? false
        );
    }

    private handleProjectileRemoved(data: any): void {
        // Remove the projectile with the specified ID
        if (data.id) {
            this.projectileManager.removeProjectile(data.id);
        }
    }

    private handlePlayerDamaged(data: any): void {
        const username = data.username;
        const currentHealth = data.currentHealth;
        const died = data.died;

        // Handle the damage event in the player manager
        this.playerManager.handlePlayerDamage(username, currentHealth, died);

        // Show notification if a player died
        if (died) {
            this.notificationManager.showNotification(`Player ${username} has died!`);
        }
    }

    private handlePlayerHealed(data: any): void {
        const username = data.username;
        const currentHealth = data.currentHealth;

        this.playerManager.handlePlayerHeal(username, currentHealth);
    }

    private handlePlayerJoined(data: any): void {
        if (data.username !== this.username) {
            // Only create player if they don't already exist to avoid duplicates
            if (!this.playerManager.hasPlayer(data.username)) {
                const skin = data.skin ?? 'player_0';
                this.playerManager.createPlayer(data.username, data.x, data.y, data.flipX, 4, false, skin);
                this.notificationManager.showNotification(`Player ${data.username} joined!`);
            }
        }
    }

    private handlePlayerLeft(data: any): void {
        if (data.username !== this.username) {
            this.playerManager.removePlayer(data.username);
            this.notificationManager.showNotification(`Player ${data.username} left!`);
        }
    }

    private handlePlayerUpdate(data: any): void {
        // Handle individual player movement updates
        if (data.username && data.username !== this.username) {
            if (this.playerManager.hasPlayer(data.username)) {
                // Only update position and movement data, preserving health/death status
                this.playerManager.updatePlayerPosition(data.username, {
                    x: data.x,
                    y: data.y,
                    vx: data.vx,
                    vy: data.vy,
                    flipX: data.flipX
                });
            }
        }
    }

    private handleGameState(data: any): void {
        if (data.players) {
            Object.entries(data.players).forEach(([id, playerData]: [string, any]) => {
                // Always create/update players including self from game_state
                if (this.playerManager.hasPlayer(id)) {
                    this.playerManager.updatePlayer(id, playerData);
                } else {
                    const skin = playerData.skin ?? 'player_0';
                    this.playerManager.createPlayer(
                        id,
                        playerData.x,
                        playerData.y,
                        playerData.flipX,
                        playerData.health,
                        playerData.isDead,
                        skin
                    );
                }

                // Store local player data in scene registry for other components to access
                if (id === this.username) {
                    this.scene.registry.set('playerData', playerData);
                }
            });

            // Remove players that are no longer in the game state
            const currentPlayerUsernames = new Set(Object.keys(data.players));
            for (const id of this.getPlayerUsernames()) {
                if (!currentPlayerUsernames.has(id)) {
                    this.playerManager.removePlayer(id);
                }
            }
        }
    }

    private handlePlayerList(data: any): void {
        if (data.players) {
            data.players.forEach((player: any) => {
                const username = typeof player === 'string' ? player : player.username;
                const skin = typeof player === 'object' && player.skin ? player.skin : '';

                if (!this.playerManager.hasPlayer(username)) {
                    const spawnPosition = SpawnPointManager.getInstance().getRandomSpawnpoint();
                    this.playerManager.createPlayer(username, spawnPosition.x, spawnPosition.y, false, 4, false, skin);
                }
            });
        }
    }

    private handleNPCSpawned(data: any): void {
        this.npcManager.spawnNPC({
            id: data.id,
            x: data.x,
            y: data.y,
            health: data.health,
            maxHealth: data.maxHealth,
        });
        this.notificationManager.showNotification('A hostile NPC has appeared!');
    }

    private handleNPCUpdate(data: any): void {
        if (data.npcs) {
            this.npcManager.updateNPCs(data)
        }
    }

    private handleNPCDamaged(data: any): void {
        this.npcManager.damageNPC(data);

        if (data.died) {
            this.notificationManager.showNotification('NPC died!')
        }
    }

    private handleRoomStatus(data: any): void {
        eventBus.emit('room_status', data);
    }

    private handleCountdownStarted(data: any): void {
        eventBus.emit('countdown_started', data);
    }

    private handleCountdown(data: any): void {
        eventBus.emit('countdown', data);
    }

    private handleCountdownCancelled(data: any): void {
        this.notificationManager.showNotification(`Game start cancelled - waiting for players`);
        eventBus.emit('countdown_cancelled', data);
    }

    private handleGameStarted(data: any): void {
        eventBus.emit('game_started', data);
    }

    private handleTimeRemaining(data: any): void {
        eventBus.emit('time_remaining', data);
    }

    private handleGameEnded(data: any): void {
        eventBus.emit('game_ended', data);
    }

    private handleConnectionFailed(data: any): void {
        console.error('Connection failed:', data);

        let notificationMessage: string;

        if (data.reason === 'room_full') {
            notificationMessage = 'Room is full! Please try again later.';
        } else if (data.reason === 'game_in_progress') {
            notificationMessage = 'A game is currently in progress. Please wait for it to finish.';
        } else {
            notificationMessage = data.message ?? 'Unable to connect to game room';
        }

        this.notificationManager.showNotification(notificationMessage);

        setTimeout(() => {
            eventBus.emit('backToMenu');
        }, 2000);
    }

    private handleRoomShutdown(data: any): void {
        this.notificationManager.showNotification(`${data.reason ?? 'Room is shutting down'}`);

        setTimeout(() => {
            eventBus.emit('backToMenu');
        }, 3000);
    }

    private handleChatMessage(data: any): void {
        // Emit chat message event for the Chat component to handle
        eventBus.emit('chat_message', data);
    }

    private handlePlayerSkinChanged(data: any): void {
        // Update the skin of the player who changed it
        if (data.username && data.username !== this.username && data.skin) {

            // Check if the player exists
            if (this.playerManager.hasPlayer(data.username)) {
                // Get the current player sprite
                const playerSprite = this.playerManager.getPlayerSprite(data.username);
                if (playerSprite) {
                    // Update the player's skin
                    this.playerManager.updatePlayerSkin(data.username, data.skin);
                }
            }
        }
    }

    private getPlayerUsernames(): string[] {
        return this.playerManager.getPlayerUsernames();
    }

    private handleGrowingDamageZoneStart(data: any): void {
        eventBus.emit('growing_damage_zone_start', data);
    }

    private handleGrowingDamageZoneUpdate(data: any): void {
        eventBus.emit('growing_damage_zone_update', data);
    }

    private handleGrowingDamageZoneStop(data: any): void {
        eventBus.emit('growing_damage_zone_stop', data);
    }

    /**
     * Clear ALL existing handlers from WebSocketService - nuclear cleanup
     */
    private clearAllExistingHandlers(): void {
        // Clear all existing handlers from the WebSocketService
        (this.websocket as any).messageTypeHandlers.clear();
    }
}
