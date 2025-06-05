import Phaser from 'phaser';
import MapManager from './MapManager';
import SoundManager from './SoundManager';
import TriggerZoneManager from './TriggerZoneManager';
import EffectsManager from './EffectsManager';

export default class MapFeaturesManager {
    private scene: Phaser.Scene;
    private mapManager: MapManager;
    private soundManager: SoundManager;
    private triggerZoneManager: TriggerZoneManager;
    private effectsManager: EffectsManager;

    constructor(
        scene: Phaser.Scene,
        mapManager: MapManager,
        soundManager: SoundManager,
        triggerZoneManager: TriggerZoneManager,
        effectsManager: EffectsManager
    ) {
        this.scene = scene;
        this.mapManager = mapManager;
        this.soundManager = soundManager;
        this.triggerZoneManager = triggerZoneManager;
        this.effectsManager = effectsManager;
    }

    public setupMapSpecificFeatures(mapKey: string): void {
        console.log(`Setting up map-specific features for map: ${mapKey}`);

        // Clear any existing effects
        this.effectsManager.cleanup();

        // Clear any existing trigger zones
        this.triggerZoneManager.clearZones();

        // Get the current map
        const map = this.mapManager.getMap();
        if (!map) {
            console.warn('Map is not available to create trigger zones');
            return;
        }

        // Set up map-specific music
        this.setupMapMusic(mapKey);

        // Create trigger zones for the current map
        this.triggerZoneManager.createZonesFromMap(mapKey, map);
    }

    private setupMapMusic(mapKey: string): void {
        switch (mapKey) {
            case 'map1':
                this.soundManager.playBackgroundMusic('battle_1_music');
                this.scene.time.delayedCall(100, () => {
                    this.soundManager.setGain(0.2);
                });
                break;
            case 'map2':
                this.soundManager.playBackgroundMusic('battle_1_music');
                this.scene.time.delayedCall(100, () => {
                    this.soundManager.setGain(0.2);
                });
                break;
            case 'map3':
                this.soundManager.playBackgroundMusic('battle_1_music');
                this.scene.time.delayedCall(100, () => {
                    this.soundManager.setGain(0.2);
                });
                break;
            default:
                this.soundManager.playBackgroundMusic('battle_1_music');
        }
    }
}
