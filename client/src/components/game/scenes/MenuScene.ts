import Player from '../entities/Player';
import Shopkeeper from '../entities/Shopkeeper';
import setTilePos from '../../../utils/setTilePos.ts';
import createStaticObjects from '../../../utils/createStaticObjects.ts';
import SoundManager from '../managers/SoundManager';
import eventBus from '../../../utils/eventBus.ts';
import NotificationManager from "../managers/NotificationManager.ts";

export default class MenuScene extends Phaser.Scene {
    private player?: Player;
    private collisionGroup: Phaser.Physics.Arcade.StaticGroup | undefined;
    private soundManager!: SoundManager;
    private notificationManager!: NotificationManager;
    private triggerZones: Phaser.Physics.Arcade.Group | undefined;
    private selectedMap: string | null = null;

    constructor() {
        super({key: 'MenuScene'});
    }

    preload(): void {
    }

    create(): void {
        const map = this.make.tilemap({key: 'menu'});
        const tileset = map.addTilesetImage('map', 'tiles');

        if (!tileset) {
            console.warn('Tileset not found.');
            return;
        }

        // Create map layers
        const groundLayer = map.createLayer('Ground', tileset);
        map.createLayer('Foliage', tileset);

        // Set layer depths for rendering order
        groundLayer?.setDepth(0);

        createStaticObjects(this, map, 'Trees');
        createStaticObjects(this, map, 'Environment');

        // Create static collision objects from the 'Collision' object layer
        this.collisionGroup = this.physics.add.staticGroup();
        this.createCollisionObjects(map, 'Collision', this.collisionGroup);

        // Create trigger zones
        this.triggerZones = this.physics.add.group();
        this.createTriggerZones(map);

        // Enable collision on the world bounds
        this.physics.world.setBounds(0, 8, map.widthInPixels - 700, map.heightInPixels - 8);
        this.cameras.main.setBounds(0, 0, map.widthInPixels - 700, map.heightInPixels);

        // Create entities
        new Shopkeeper(this, setTilePos(10), setTilePos(9));
        this.player = new Player(this, setTilePos(30), setTilePos(15));
        this.physics.add.collider(this.player, this.collisionGroup);

        // Add overlap with trigger zones
        if (this.player && this.triggerZones) {
            this.physics.add.overlap(
                this.player,
                this.triggerZones,
                // @ts-expect-error Phaser expects a function with GameObject parameters (but this still works)
                this.handleTriggerOverlap,
                undefined,
                this
            );
        }

        // Camera setup
        if (this.player) {
            this.cameras.main.startFollow(this.player, true, 0.2, 0.2);
            this.cameras.main.setZoom(2).setRoundPixels(true);
        }

        // Initialize sound manager
        this.soundManager = new SoundManager(this);

        this.notificationManager = new NotificationManager();

        // Play background music with lowpass filter
        this.soundManager.playBackgroundMusic('menu_music');
        this.soundManager.setGain(0.1);

        eventBus.on('backToMenu', this.handleBackToMenu.bind(this));
    }

    update(): void {
        this.player?.update();
    }

    shutdown(): void {
        // Clean up resources when scene is shut down
        if (this.soundManager) {
            this.soundManager.destroy();
        }

        eventBus.off('backToMenu', this.handleBackToMenu.bind(this));
    }

    // Create static collision object group
    private createCollisionObjects(
        map: Phaser.Tilemaps.Tilemap,
        objectLayerName: string,
        group: Phaser.Physics.Arcade.StaticGroup
    ): void {
        const collisionLayer = map.getObjectLayer(objectLayerName);

        if (!collisionLayer) {
            console.warn(`Object layer "${objectLayerName}" not found.`);
            return;
        }

        collisionLayer.objects.forEach(object => {
            const x = object.x ?? 0;
            const y = object.y ?? 0;
            const width = object.width ?? 0;
            const height = object.height ?? 0;

            const rectangle = this.add.rectangle(x + width / 2, y + height / 2, width, height);
            this.physics.add.existing(rectangle, true);
            group.add(rectangle);
        });
    }

    // Create trigger zones from the 'Trigger' object layer
    private createTriggerZones(map: Phaser.Tilemaps.Tilemap): void {
        const triggerLayer = map.getObjectLayer('Trigger');

        if (!triggerLayer) {
            console.warn('Object layer "Trigger" not found.');
            return;
        }

        triggerLayer.objects.forEach(object => {
            const x = object.x ?? 0;
            const y = object.y ?? 0;
            const width = object.width ?? 0;
            const height = object.height ?? 0;
            const className = object.type || ''; // Get the class property

            // Create a zone game object
            const zone = this.add.zone(x + width / 2, y + height / 2, width, height);

            this.physics.add.existing(zone, false);
            const body = zone.body as Phaser.Physics.Arcade.Body;
            body.setImmovable(true);

            // Store the trigger type in the game object
            zone.setData('triggerType', className);

            if (className.startsWith('map')) {
                let difficultyText = '';
                let textColor = '#ffffff';

                switch (className) {
                    case 'map1':
                        difficultyText = 'EASY';
                        break;
                    case 'map2':
                        difficultyText = 'MEDIUM';
                        break;
                    case 'map3':
                        difficultyText = 'HARD';
                        break;
                }

                if (difficultyText) {
                    const text = this.add.text(x + width / 2, y - 10, difficultyText, {
                        fontFamily: 'gameovercre',
                        fontSize: '24px',
                        color: textColor,
                        stroke: '#000000',
                        strokeThickness: 4
                    });
                    text.setOrigin(0.5, 1);
                    text.setDepth(10);
                    text.setScale(0.5);
                }
            }

            // Add to trigger zones group
            this.triggerZones?.add(zone);
        });
    }

    // Handle player overlap with trigger zones
    private handleTriggerOverlap(
        // @ts-expect-error Phaser passes the player even though we don't need it here
        player: Phaser.GameObjects.GameObject,
        trigger: Phaser.GameObjects.GameObject
    ): void {
        const triggerType = trigger.getData('triggerType');

        switch (triggerType) {
            case 'shop':
                console.log('Entered shop area');
                break;

            case 'map1':
            case 'map2':
            case 'map3':
                this.selectedMap = triggerType;

                this.setupTriggerExit(player, trigger, () => {
                    this.selectedMap = null;
                })

                // Add a small delay before allowing map loading to prevent accidental triggers
                this.time.delayedCall(500, () => {
                    if (this.selectedMap === triggerType) {
                        this.loadGameplayScene(triggerType);
                    }
                });
                break;

            default:
                console.log(`Unknown trigger type: ${triggerType}`);
        }
    }

    private setupTriggerExit(
        player: Phaser.GameObjects.GameObject,
        trigger: Phaser.GameObjects.Zone,
        exitCallback: () => void
    ): void {
        const playerSprite = player as Phaser.Physics.Arcade.Sprite;
        const triggerZone = trigger as Phaser.GameObjects.Zone;

        const exitTimer = this.time.addEvent({
            delay: 100,
            callback: () => {
                if (!playerSprite.body || !triggerZone.body) {
                    exitCallback();
                    exitTimer.destroy();
                    return;
                }

                const triggerBounds = triggerZone.getBounds();
                const playerBounds = playerSprite.getBounds();

                const stillOverlapping = Phaser.Geom.Rectangle.Overlaps(triggerBounds, playerBounds);

                if (!stillOverlapping) {
                    exitCallback();
                    exitTimer.destroy();
                }
            },
            loop: true
        });
    }

    // Load the GameplayScene with the specified map
    private loadGameplayScene(mapKey: string): void {
        console.log(`Loading gamplay scene with map: ${mapKey}`);

        // Clean up current scene
        this.shutdown();

        // Store the selected map for the Websocket connection
        sessionStorage.setItem('selectedMapKey', mapKey);

        // Use the event bus to signal game mode change and pass map data
        eventBus.emit('startGame', {mapKey});
    }

    private handleBackToMenu(): void {
        console.log('Back to menu event received');

        this.selectedMap = null;

        try {
            sessionStorage.removeItem('selectedMapKey');
        } catch (error) {
            console.warn('Could not clear sessionStorage', error);
        }
    }
}
