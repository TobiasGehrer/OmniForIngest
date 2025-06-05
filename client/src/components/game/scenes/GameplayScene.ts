import Phaser from 'phaser';
import WebSocketService from '../../services/WebSocketService';
import PlayerManager from '../managers/PlayerManager';
import InputManager from '../managers/InputManager';
import WebSocketHandler from '../managers/WebSocketHandler';
import MapManager from '../managers/MapManager';
import AnimationManager from '../managers/AnimationManager';
import SoundManager from '../managers/SoundManager';
import UIManager from '../managers/UIManager';
import ProjectileManager from '../managers/ProjectileManager';
import SpawnPointManager from '../managers/SpawnPointManager.ts';
import TriggerZoneManager from '../managers/TriggerZoneManager';
import SceneInitializer from '../managers/SceneInitializer';
import EffectsManager from '../managers/EffectsManager';
import MapFeaturesManager from '../managers/MapFeaturesManager';

export default class GameplayScene extends Phaser.Scene {
    private playerManager!: PlayerManager;
    private inputManager!: InputManager;
    private webSocketHandler!: WebSocketHandler;
    private mapManager!: MapManager;
    private animationManager!: AnimationManager;
    private soundManager!: SoundManager;
    private uiManager!: UIManager;
    private projectileManager!: ProjectileManager;
    private spawnpointManager!: SpawnPointManager;
    private triggerZoneManager!: TriggerZoneManager;
    private effectsManager!: EffectsManager;
    private mapFeaturesManager!: MapFeaturesManager;
    private readonly websocket!: WebSocketService;
    private readonly username!: string;

    constructor() {
        super({key: 'GameplayScene'});
        this.websocket = WebSocketService.getInstance();
        this.username = this.websocket.getUsername();
    }

    preload(): void {
    }

    create(): void {
        // Initialize all managers through the SceneInitializer
        const sceneInitializer = new SceneInitializer(this, this.websocket, this.username);
        const managers = sceneInitializer.initialize();

        // Assign all managers from the initializer
        this.playerManager = managers.playerManager;
        this.inputManager = managers.inputManager;
        this.webSocketHandler = managers.webSocketHandler;
        this.mapManager = managers.mapManager;
        this.animationManager = managers.animationManager;
        this.soundManager = managers.soundManager;
        this.uiManager = managers.uiManager;
        this.projectileManager = managers.projectileManager;
        this.spawnpointManager = managers.spawnpointManager;
        this.triggerZoneManager = managers.triggerZoneManager;

        // Create additional managers
        this.effectsManager = new EffectsManager(this, this.playerManager);

        // Connect the effects manager to the trigger zone manager
        this.triggerZoneManager.setEffectsManager(this.effectsManager);

        this.mapFeaturesManager = new MapFeaturesManager(
            this,
            this.mapManager,
            this.soundManager,
            this.triggerZoneManager,
            this.effectsManager
        );

        // Get the initial map key
        const mapKey = sceneInitializer.setupInitialMap();

        // Create map and set up the game world using the provided mapKey
        this.mapManager.createMap(mapKey, 'tiles');

        // Get map dimensions and set up spawnpoints
        const mapDimensions = this.mapManager.getMapDimensions();
        this.spawnpointManager.setMapDimensions(mapDimensions.width, mapDimensions.height);

        // Load spawnpoints from the "Spawnpoints" layer
        if (this.mapManager.getMap()) {
            this.spawnpointManager.loadSpawnpoints('Spawnpoints', this.mapManager.getMap());
        }

        // Set up map-specific features for the initial map
        this.mapFeaturesManager.setupMapSpecificFeatures(mapKey);

        // Create animations
        this.animationManager.createAnimations();

        // Set up UI
        this.uiManager.createConnectionText();

        // Connect to WebSocket if not already connected
        this.webSocketHandler.connect();

        // Set collision group for player manager
        const collisionGroup = this.mapManager.getCollisionGroup();
        if (collisionGroup) {
            this.playerManager.setCollisionGroup(collisionGroup);
        }

        // Add listener for map changes
        this.events.on('mapChanged', (mapKey: string) => {
            // Reset player positions to a random spawnpoint
            const spawnpoint = this.spawnpointManager.getRandomSpawnpoint();
            this.playerManager.teleportLocalPlayer(spawnpoint.x, spawnpoint.y);

            // Reload spawnpoints from the new map
            if (this.mapManager.getMap()) {
                this.spawnpointManager.loadSpawnpoints('Spawnpoints', this.mapManager.getMap());
            }

            // Set up map-specific features
            this.mapFeaturesManager.setupMapSpecificFeatures(mapKey);

            // Set collision group for player manager with the new collision group
            const collisionGroup = this.mapManager.getCollisionGroup();
            if (collisionGroup) {
                this.playerManager.setCollisionGroup(collisionGroup);
            }
        });
    }

    update(time: number): void {
        // Update UI
        this.uiManager.updateConnectionText(this.playerManager.getAlivePlayerCount());

        // Update player positions
        this.playerManager.updatePlayerPositions();

        // Update projectiles
        this.projectileManager.updateProjectiles(time);

        // Update input handling
        this.inputManager.update(time);
    }

    shutdown(): void {
        // Clean up resources when scene is shut down
        if (this.soundManager) {
            this.soundManager.destroy();
        }

        // Clean up effects
        if (this.effectsManager) {
            this.effectsManager.cleanup();
        }
    }

    // Public methods for TriggerZoneManager to access
    public startHealingEffect(): void {
        this.effectsManager.startHealingEffect();
    }

    public stopHealingEffect(): void {
        this.effectsManager.stopHealingEffect();
    }
}
