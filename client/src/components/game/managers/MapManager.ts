import Phaser from 'phaser';
import createStaticObjects from '../../../utils/createStaticObjects';

export default class MapManager {
    private static instance: MapManager | null = null;
    private scene: Phaser.Scene | null = null;
    private map: Phaser.Tilemaps.Tilemap | null = null;
    private collisionGroup: Phaser.Physics.Arcade.StaticGroup | null = null;

    private constructor() {
    }

    public static getInstance(): MapManager {
        if (!MapManager.instance) {
            MapManager.instance = new MapManager();
        }
        return MapManager.instance;
    }

    public setScene(scene: Phaser.Scene): void {
        this.scene = scene;
    }

    createMap(mapKey: string, tilesetKey: string): void {
        if (!this.scene) {
            console.error('Scene is not set. Call setScene before createMap.');
            return;
        }

        this.map = this.scene.make.tilemap({key: mapKey});
        const tileset = this.map.addTilesetImage('map', tilesetKey);

        if (!tileset) {
            console.warn('Tileset not found.');
            return;
        }

        const groundLayer = this.map.createLayer('Ground', tileset);
        this.map.createLayer('Foliage', tileset);

        if (groundLayer) {
            groundLayer.setDepth(0);
        }

        createStaticObjects(this.scene, this.map, 'Trees');
        createStaticObjects(this.scene, this.map, 'Environment');

        this.collisionGroup = this.scene.physics.add.staticGroup();
        this.createCollisionObjects(this.map, 'Collision', this.collisionGroup);

        this.scene.physics.world.setBounds(0, 8, this.map.widthInPixels - 700, this.map.heightInPixels - 8);
        this.scene.cameras.main.setBounds(0, 0, this.map.widthInPixels - 700, this.map.heightInPixels);
        this.scene.cameras.main.setZoom(2).setRoundPixels(true);
    }

    public switchMap(mapKey: string, tilesetKey: string = 'tiles'): void {
        // Clean up previous map
        if (this.map) {
            this.map.destroy();
        }

        // Destroy previous collision group objects
        if (this.collisionGroup) {
            this.collisionGroup.clear(true, true);
        }

        // Create the new map
        this.createMap(mapKey, tilesetKey);

        // Emit map changed event
        if (this.scene) {
            this.scene.events.emit('mapChanged', mapKey);
        }
    }

    getCollisionGroup(): Phaser.Physics.Arcade.StaticGroup | null {
        return this.collisionGroup;
    }

    getMap(): Phaser.Tilemaps.Tilemap | null {
        return this.map;
    }

    getMapDimensions(): {
        width: number;
        height: number
    } {
        if (!this.map) {
            return {
                width: 0,
                height: 0
            };
        }

        return {
            width: this.map.widthInPixels,
            height: this.map.heightInPixels
        };
    }

    getPlayableAreaDimensions(): {
        width: number;
        height: number
    } {
        if (!this.map || !this.scene) {
            return {
                width: 0,
                height: 0
            };
        }

        // Return the physics world bounds which represent the actual playable area
        const bounds = this.scene.physics.world.bounds;
        return {
            width: bounds.width,
            height: bounds.height
        };
    }

    private createCollisionObjects(
        map: Phaser.Tilemaps.Tilemap,
        objectLayerName: string,
        group: Phaser.Physics.Arcade.StaticGroup
    ): void {
        if (!this.scene) {
            console.error('Scene is not set.');
            return;
        }

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

            const rectangle = this.scene!.add.rectangle(x + width / 2, y + height / 2, width, height);
            this.scene!.physics.add.existing(rectangle, true);
            group.add(rectangle);
        });
    }
}
