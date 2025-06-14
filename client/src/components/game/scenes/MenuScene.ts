import Player from '../entities/Player';
import Shopkeeper from '../entities/Shopkeeper';
import setTilePos from '../../../utils/setTilePos.ts';
import createStaticObjects from '../../../utils/createStaticObjects.ts';
import SoundManager from '../managers/SoundManager';
import NotificationManager from '../managers/NotificationManager';
import eventBus from '../../../utils/eventBus.ts';
import ShopState from '../../../utils/ShopState';
import {getApiBaseUrl, getShopBaseUrl} from '../../../utils/apiBaseUrl';

export default class MenuScene extends Phaser.Scene {
    private player?: Player;
    // @ts-ignore
    private _shopkeeper?: Shopkeeper;
    private collisionGroup: Phaser.Physics.Arcade.StaticGroup | undefined;
    private soundManager!: SoundManager;
    private notificationManager!: NotificationManager;
    private triggerZones: Phaser.Physics.Arcade.Group | undefined;
    private selectedMap: string | null = null;
    private isShopOpen: boolean = false;

    constructor() {
        super({key: 'MenuScene'});
    }

    preload(): void {
        // Nothing to preload
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
        this._shopkeeper = new Shopkeeper(this, setTilePos(10), setTilePos(9));
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

            // Set up continuous checking for trigger zone exits
            this.time.addEvent({
                delay: 100,
                callback: this.checkTriggerExits,
                callbackScope: this,
                loop: true
            });
        }

        // Camera setup
        if (this.player) {
            this.cameras.main.startFollow(this.player, true, 0.2, 0.2);
            this.cameras.main.setZoom(2).setRoundPixels(true);
        }

        // Initialize managers
        this.soundManager = SoundManager.getInstance(this);
        this.notificationManager = new NotificationManager();

        // Play background music with lowpass filter
        this.soundManager.playBackgroundMusic('menu_music');
        this.soundManager.setGain(0.1);

        eventBus.on('backToMenu', this.handleBackToMenu.bind(this));
        eventBus.on('openShop', this.handleOpenShop, this);
        eventBus.on('closeShop', this.handleCloseShop, this);
    }

    update(): void {
        if (this.isShopOpen) return;
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
                const textColor = '#ffffff';

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
                    const text = this.add.text(x + width / 2, y - 2, difficultyText, {
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
            } else if (className === 'shop') {
                // Add SHOP label above the shop trigger zone
                const text = this.add.text(x + width / 2, y + 5, 'SHOP', {
                    fontFamily: 'gameovercre',
                    fontSize: '24px',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 4
                });
                text.setOrigin(0.5, 1);
                text.setDepth(10);
                text.setScale(0.5);
            }

            // Add to trigger zones group
            this.triggerZones?.add(zone);
        });
    }

    // Handle player overlap with trigger zones
    private handleTriggerOverlap(
        player: Phaser.GameObjects.GameObject,
        trigger: Phaser.GameObjects.GameObject
    ): void {
        const triggerType = trigger.getData('triggerType');

        switch (triggerType) {
            case 'shop':
                // Only trigger once per entry
                if (!trigger.getData('triggered')) {
                    trigger.setData('triggered', true);
                    eventBus.emit('openShop');
                }
                break;

            case 'map1':
            case 'map2':
            case 'map3':
                // Only trigger once per entry
                if (!trigger.getData('triggered')) {
                    console.log(`Entering ${triggerType} trigger zone`);
                    trigger.setData('triggered', true);
                    this.selectedMap = triggerType;

                    this.setupTriggerExit(player, trigger as Phaser.GameObjects.Zone, () => {
                        console.log(`Exiting ${triggerType} trigger zone`);
                        this.selectedMap = null;
                        trigger.setData('triggered', false);
                    })

                    if (this.selectedMap === triggerType) {
                        console.log(`Attempting to load ${triggerType}`);
                        this.loadGameplayScene(triggerType);
                    }
                } else {
                    console.log(`${triggerType} trigger already triggered`);
                }
                break;

            default:
                console.log(`Unknown trigger type: ${triggerType}`);
        }
    }

    // Check if player has exited any trigger zones
    private checkTriggerExits(): void {
        if (!this.player || !this.triggerZones) return;

        const playerBounds = this.player.getBounds();

        this.triggerZones.children.entries.forEach((trigger) => {
            const triggerZone = trigger as Phaser.GameObjects.Zone;
            const triggerType = triggerZone.getData('triggerType');
            const wasTriggered = triggerZone.getData('triggered');

            if (wasTriggered) {
                const triggerBounds = triggerZone.getBounds();
                const stillOverlapping = Phaser.Geom.Rectangle.Overlaps(triggerBounds, playerBounds);

                if (!stillOverlapping) {
                    console.log(`Left ${triggerType} area`);
                    triggerZone.setData('triggered', false);

                    if (triggerType === 'shop') {
                        eventBus.emit('closeShop');
                    } else if (triggerType.startsWith('map')) {
                        this.selectedMap = null;
                    }
                }
            }
        });
    }

    private setupTriggerExit(
        player: Phaser.GameObjects.GameObject,
        trigger: Phaser.GameObjects.Zone,
        exitCallback: () => void
    ): void {
        const playerSprite = player as Phaser.Physics.Arcade.Sprite;
        const triggerZone = trigger;

        const exitTimer = this.time.addEvent({
            delay: 100,
            callback: () => {
                if (!playerSprite.body || !triggerZone.body) {
                    console.log('Exit callback triggered - no bodies');
                    exitCallback();
                    exitTimer.destroy();
                    return;
                }

                const triggerBounds = triggerZone.getBounds();
                const playerBounds = playerSprite.getBounds();

                const stillOverlapping = Phaser.Geom.Rectangle.Overlaps(triggerBounds, playerBounds);

                if (!stillOverlapping) {
                    console.log('Exit callback triggered - no longer overlapping');
                    exitCallback();
                    exitTimer.destroy();
                }
            },
            loop: true
        });
    }

    private async checkMapUnlock(mapKey: string, username: string): Promise<boolean> {
        // Map1 is always unlocked by default
        if (mapKey === 'map1') {
            return true;
        }

        try {
            const url = `${getShopBaseUrl()}/api/shop/check-map/${username}/${mapKey}`;
            console.log('Checking map unlock:', url);
            const response = await fetch(url, {
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                },
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Map unlock response:', data);
                return data.unlocked;
            } else {
                console.log('Map unlock check failed:', response.status);
            }
        } catch (error) {
            console.error('Error checking map unlock:', error);
        }

        // Default to locked for maps other than map1
        return false;
    }

    // Load the GameplayScene with the specified map
    private async loadGameplayScene(mapKey: string): Promise<void> {
        const username = await this.getCurrentUsername();

        const isUnlocked = await this.checkMapUnlock(mapKey, username);

        if (!isUnlocked) {
            const mapNumber = mapKey.replace('map', '');
            this.notificationManager.showNotification(`Map ${mapNumber} is locked. Purchase access in the shop!`);
            return;
        }

        console.log(`Loading gameplay scene with map: ${mapKey}`);

        // Clean up current scene
        this.shutdown();

        // Store the selected map for the Websocket connection
        sessionStorage.setItem('selectedMapKey', mapKey);

        // Use the event bus to signal game mode change and pass map data
        eventBus.emit('startGame', {mapKey});
    }

    private async getCurrentUsername(): Promise<string> {
        // First check if username is in the game registry
        const usernameFromRegistry = this.registry.get('username');
        if (usernameFromRegistry) {
            console.log('Using username from registry:', usernameFromRegistry);
            return usernameFromRegistry;
        }

        try {
            const response = await fetch(`${getApiBaseUrl()}/me`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
            });

            if (response.ok) {
                const data = await response.json();
                const username = data.username ?? 'Unknown';
                // Store username in registry for future use
                this.registry.set('username', username);
                return username;
            }
        } catch (error) {
            console.error('Error fetching username:', error);
        }

        return 'Unknown';
    }

    private async handleBackToMenu(): Promise<void> {
        console.log('Back to menu event received');

        this.selectedMap = null;

        try {
            sessionStorage.removeItem('selectedMapKey');
        } catch (error) {
            console.warn('Could not clear sessionStorage', error);
        }

        // Fetch and store the current selected skin
        const username = await this.getCurrentUsername();
        if (username && username !== 'Unknown') {
            try {
                const response = await fetch(`${getShopBaseUrl()}/api/shop/preferences/${username}`, {
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    const selectedSkin = data.selectedSkin;
                    // Store the selected skin in the registry for the next Player instance
                    this.registry.set('selectedSkin', selectedSkin);
                }
            } catch (error) {
                console.error('Error fetching selected skin:', error);
            }
        }
    }

    private readonly handleOpenShop = () => {
        this.isShopOpen = true;
        ShopState.instance.isShopOpen = true;
        if (this.player?.body) {
            this.player.body.setVelocity(0, 0);
            // Use the skin-specific idle animation key
            const currentSkin = this.player.getCurrentSkin();
            this.player.play(`idle_${currentSkin}`, true);
        }
    };

    private readonly handleCloseShop = () => {
        this.isShopOpen = false;
        ShopState.instance.isShopOpen = false;
    };
}
