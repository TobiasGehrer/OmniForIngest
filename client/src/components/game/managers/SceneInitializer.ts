import Phaser from 'phaser';
import PlayerManager from './PlayerManager';
import NotificationManager from './NotificationManager';
import InputManager from './InputManager';
import WebSocketHandler from './WebSocketHandler';
import MapManager from './MapManager';
import AnimationManager from './AnimationManager';
import SoundManager from './SoundManager';
import UIManager from './UIManager';
import ProjectileManager from './ProjectileManager';
import SpawnPointManager from './SpawnPointManager';
import TriggerZoneManager from './TriggerZoneManager';
import WebSocketService from '../../services/WebSocketService';
import NPCManager from './NPCManager.ts';

export default class SceneInitializer {
    private readonly scene: Phaser.Scene;
    private readonly username: string;
    private readonly websocket: WebSocketService;

    private playerManager!: PlayerManager;
    private notificationManager!: NotificationManager;
    private inputManager!: InputManager;
    private webSocketHandler!: WebSocketHandler;
    private mapManager!: MapManager;
    private animationManager!: AnimationManager;
    private soundManager!: SoundManager;
    private uiManager!: UIManager;
    private projectileManager!: ProjectileManager;
    private spawnpointManager!: SpawnPointManager;
    private triggerZoneManager!: TriggerZoneManager;
    private npcManager!: NPCManager;

    constructor(scene: Phaser.Scene, websocket: WebSocketService, username: string) {
        this.scene = scene;
        this.websocket = websocket;
        this.username = username;
    }

    public initialize(): {
        playerManager: PlayerManager,
        notificationManager: NotificationManager,
        inputManager: InputManager,
        webSocketHandler: WebSocketHandler,
        mapManager: MapManager,
        animationManager: AnimationManager,
        soundManager: SoundManager,
        uiManager: UIManager,
        projectileManager: ProjectileManager,
        spawnpointManager: SpawnPointManager,
        triggerZoneManager: TriggerZoneManager,
        npcManager: NPCManager
    } {
        // Initialize all managers
        this.playerManager = new PlayerManager(this.scene, this.username);
        this.notificationManager = new NotificationManager();
        this.inputManager = new InputManager(this.scene, this.websocket, this.playerManager);
        this.mapManager = MapManager.getInstance();
        this.mapManager.setScene(this.scene);
        this.spawnpointManager = SpawnPointManager.getInstance();
        this.animationManager = new AnimationManager(this.scene);
        this.soundManager = SoundManager.getInstance(this.scene);
        this.uiManager = new UIManager(this.websocket, this.username);
        this.projectileManager = new ProjectileManager(this.scene);
        this.triggerZoneManager = new TriggerZoneManager(this.scene, this.playerManager);
        this.npcManager = new NPCManager(this.scene);

        (this.scene as any).npcManager = this.npcManager;

        // WebSocketHandler needs to be initialized after playerManager and notificationManager
        this.webSocketHandler = new WebSocketHandler(
            this.scene,
            this.websocket,
            this.playerManager,
            this.notificationManager,
            this.projectileManager,
            this.npcManager
        );

        return {
            playerManager: this.playerManager,
            notificationManager: this.notificationManager,
            inputManager: this.inputManager,
            webSocketHandler: this.webSocketHandler,
            mapManager: this.mapManager,
            animationManager: this.animationManager,
            soundManager: this.soundManager,
            uiManager: this.uiManager,
            projectileManager: this.projectileManager,
            spawnpointManager: this.spawnpointManager,
            triggerZoneManager: this.triggerZoneManager,
            npcManager: this.npcManager
        };
    }

    public setupInitialMap(): string {
        // Get the map key from session storage, defaulting to 'menu' if not provided
        let mapKey = 'menu';
        try {
            const storedMapKey = sessionStorage.getItem('selectedMapKey');
            if (storedMapKey) {
                mapKey = storedMapKey;
            }
        } catch (e) {
            console.warn('Could not access sessionStorage:', e);
        }

        console.log(`Loading map: ${mapKey}`);
        return mapKey;
    }
}
