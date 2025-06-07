import WebSocketService from '../../services/WebSocketService.ts';
import PlayerManager from './PlayerManager';
import NotificationManager from './NotificationManager';
import ProjectileManager from './ProjectileManager';
import SpawnPointManager from './SpawnPointManager.ts';
import eventBus from "../../../utils/eventBus.ts";

export default class WebSocketHandler {
    private websocket: WebSocketService;
    private playerManager: PlayerManager;
    private notificationManager: NotificationManager;
    private projectileManager: ProjectileManager;
    private readonly username: string;
    private scene: Phaser.Scene;

    // Store bound handlers for cleanup
    private boundHandlers: Map<string, (data: any) => void> = new Map();

    constructor(
        scene: Phaser.Scene,
        websocket: WebSocketService,
        playerManager: PlayerManager,
        notificationManager: NotificationManager,
        projectileManager: ProjectileManager,
    ) {
        this.scene = scene;
        this.websocket = websocket;
        this.playerManager = playerManager;
        this.notificationManager = notificationManager;
        this.projectileManager = projectileManager;

        const username = this.websocket.getUsername();
        if (!username) {
            // If no username is found, redirect to login screen
            console.log('No username found, redirecting to login screen');
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
            { type: 'player_joined', handler: this.handlePlayerJoined.bind(this) },
            { type: 'player_left', handler: this.handlePlayerLeft.bind(this) },
            { type: 'player_update', handler: this.handlePlayerUpdate.bind(this) },
            { type: 'game_state', handler: this.handleGameState.bind(this) },
            { type: 'player_list', handler: this.handlePlayerList.bind(this) },
            { type: 'player_damaged', handler: this.handlePlayerDamaged.bind(this) },
            { type: 'player_healed', handler: this.handlePlayerHealed.bind(this) },
            { type: 'projectile_created', handler: this.handleProjectileCreated.bind(this) },
            { type: 'projectile_removed', handler: this.handleProjectileRemoved.bind(this) },
            { type: 'room_status', handler: this.handleRoomStatus.bind(this) },
            { type: 'countdown_started', handler: this.handleCountdownStarted.bind(this) },
            { type: 'countdown', handler: this.handleCountdown.bind(this) },
            { type: 'countdown_cancelled', handler: this.handleCountdownCancelled.bind(this) },
            { type: 'game_started', handler: this.handleGameStarted.bind(this) },
            { type: 'game_ended', handler: this.handleGameEnded.bind(this) },
            { type: 'time_remaining', handler: this.handleTimeRemaining.bind(this) },
            { type: 'connection_failed', handler: this.handleConnectionFailed.bind(this) },
            { type: 'room_shutdown', handler: this.handleRoomShutdown.bind(this) }
        ];

        handlers.forEach(({ type, handler }) => {
            this.boundHandlers.set(type, handler);
            this.websocket.onMessageType(type, handler);
        });
    }

    private handleProjectileCreated(data: any): void {
        // Create a projectile with the data from the server
        this.projectileManager.createProjectile(
            data.x,
            data.y,
            data.directionX,
            data.directionY,
            data.ownerId,
            data.id
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
                this.playerManager.createPlayer(data.username, data.x, data.y, data.flipX);
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
                    this.playerManager.createPlayer(
                        id,
                        playerData.x,
                        playerData.y,
                        playerData.flipX,
                        playerData.health,
                        playerData.isDead
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
            data.players.forEach((username: string) => {
                if (!this.playerManager.hasPlayer(username)) {
                    const spawnPosition = SpawnPointManager.getInstance().getRandomSpawnpoint();
                    this.playerManager.createPlayer(username, spawnPosition.x, spawnPosition.y);
                }
            });
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
        this.notificationManager.showNotification(`Connection failed: ${data.message}`);

        setTimeout(() =>{
            if (typeof window !== 'undefined') {
                window.location.href = '/';
            }
        }, 3000);
    }

    private handleRoomShutdown(data: any): void {
        this.notificationManager.showNotification(`${data.reason || 'Room is shutting down'}`);

        setTimeout(() =>{
            eventBus.emit('backToMenu');
        }, 2000);
    }

    private getPlayerUsernames(): string[] {
        return this.playerManager.getPlayerUsernames();
    }

    /**
     * Clear ALL existing handlers from WebSocketService - nuclear cleanup
     */
    private clearAllExistingHandlers(): void {
        // Clear all existing handlers from the WebSocketService
        (this.websocket as any).messageTypeHandlers.clear();
    }

    public cleanup(): void {
        // Remove all message handlers to prevent duplicate handlers
        this.boundHandlers.forEach((handler, type) => {
            this.websocket.offMessageType(type, handler);
        });
        this.boundHandlers.clear();
    }
}
