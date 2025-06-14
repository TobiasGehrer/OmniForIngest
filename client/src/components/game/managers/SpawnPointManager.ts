import Phaser from 'phaser';

export default class SpawnPointManager {
    private static instance: SpawnPointManager | null = null;
    private mapWidth: number = 0;
    private mapHeight: number = 0;
    private spawnpoints: Phaser.Types.Math.Vector2Like[] = [];

    private constructor() {
    }

    public static getInstance(): SpawnPointManager {
        SpawnPointManager.instance ??= new SpawnPointManager();
        return SpawnPointManager.instance;
    }

    public setMapDimensions(width: number, height: number): void {
        this.mapWidth = width;
        this.mapHeight = height;
    }

    public loadSpawnpoints(spawnpointLayerName: string, map: Phaser.Tilemaps.Tilemap | null): void {
        this.spawnpoints = [];

        if (!map) {
            console.warn('Map is not loaded. Cannot load spawnpoints.');
            return;
        }

        const spawnpointLayer = map.getObjectLayer(spawnpointLayerName);

        if (!spawnpointLayer) {
            console.warn(`Spawnpoint layer "${spawnpointLayerName}" not found.`);
            this.createDefaultSpawnpoints();
            return;
        }

        spawnpointLayer.objects.forEach(spawnpoint => {
            const x = spawnpoint.x ?? 0;
            const y = spawnpoint.y ?? 0;

            this.spawnpoints.push({
                x,
                y
            });
        });

        if (this.spawnpoints.length === 0) {
            this.createDefaultSpawnpoints();
        }
    }

    public getRandomSpawnpoint(): Phaser.Types.Math.Vector2Like {
        if (this.spawnpoints.length === 0) {
            // Return center of map if no spawnpoints available
            return {
                x: this.mapWidth / 2,
                y: this.mapHeight / 2
            };
        }

        const randomIndex = Math.floor(Math.random() * this.spawnpoints.length);
        return this.spawnpoints[randomIndex];
    }

    public getAllSpawnpoints(): Phaser.Types.Math.Vector2Like[] {
        return [...this.spawnpoints];
    }

    private createDefaultSpawnpoints(): void {
        // Create some default spawn points if none were defined in the map
        const margin = 100;
        const spawnCount = 10;

        // Create spawnpoints at various positions around the map
        for (let i = 0; i < spawnCount; i++) {
            const x = margin + Math.random() * (this.mapWidth - margin * 2);
            const y = margin + Math.random() * (this.mapHeight - margin * 2);
            this.spawnpoints.push({
                x,
                y
            });
        }
    }
}
