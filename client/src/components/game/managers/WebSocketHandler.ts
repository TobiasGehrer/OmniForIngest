import WebSocketService from '../../services/WebSocketService.ts';
import PlayerManager from './PlayerManager';
import NotificationManager from './NotificationManager';
import ProjectileManager from './ProjectileManager';
import SpawnPointManager from './SpawnPointManager.ts';

export default class WebSocketHandler {
    private websocket: WebSocketService;
    private playerManager: PlayerManager;
    private notificationManager: NotificationManager;
    private projectileManager: ProjectileManager;
    private readonly username: string;
    private scene: Phaser.Scene;

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

    /**
     * Redirect to the login screen
     * @private
     */
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
        // Register handlers for specific message types
        this.websocket.onMessageType('player_joined', this.handlePlayerJoined.bind(this));
        this.websocket.onMessageType('player_left', this.handlePlayerLeft.bind(this));
        this.websocket.onMessageType('game_state', this.handleGameState.bind(this));
        this.websocket.onMessageType('player_list', this.handlePlayerList.bind(this));
        this.websocket.onMessageType('player_damaged', this.handlePlayerDamaged.bind(this));
        this.websocket.onMessageType('player_healed', this.handlePlayerHealed.bind(this));
        this.websocket.onMessageType('projectile_created', this.handleProjectileCreated.bind(this));
        this.websocket.onMessageType('projectile_removed', this.handleProjectileRemoved.bind(this));
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
            console.log(`Player joined: ${data.username}`);
            this.playerManager.createPlayer(data.username, data.x, data.y, data.flipX);
            this.notificationManager.showNotification(`Player ${data.username} joined!`);
        }
    }

    private handlePlayerLeft(data: any): void {
        if (data.username !== this.username) {
            console.log(`Player left: ${data.username}`);
            this.playerManager.removePlayer(data.username);
            this.notificationManager.showNotification(`Player ${data.username} left!`);
        }
    }

    private handleGameState(data: any): void {
        if (data.players) {
            Object.entries(data.players).forEach(([id, playerData]: [string, any]) => {
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

    private getPlayerUsernames(): string[] {
        return this.playerManager.getPlayerUsernames();
    }
}
