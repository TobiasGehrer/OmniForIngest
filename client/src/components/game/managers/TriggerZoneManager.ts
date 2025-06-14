import Phaser from 'phaser';
import PlayerManager from './PlayerManager';
import EffectsManager from './EffectsManager';
import eventBus from '../../../utils/eventBus.ts';

export interface TriggerZoneConfig {
    zoneType: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: number;
    alpha?: number;
    customData?: Record<string, any>;
}

export default class TriggerZoneManager {
    private readonly scene: Phaser.Scene;
    private readonly playerManager: PlayerManager;
    private effectsManager?: EffectsManager;
    private readonly triggerZones: Phaser.Physics.Arcade.Group;
    private readonly activeZoneTimers: Map<string, Phaser.Time.TimerEvent> = new Map();
    private readonly healingTimers: Map<string, Phaser.Time.TimerEvent> = new Map();
    private readonly damageTimers: Map<string, Phaser.Time.TimerEvent> = new Map();
    private readonly poisonCloudZones: Set<string> = new Set();
    private readonly HEAL_INTERVAL = 3000;
    private readonly HEAL_AMOUNT = 1;
    private readonly DAMAGE_INTERVAL = 600;
    private readonly DAMAGE_AMOUNT = 1;
    private collisionSetupTimer?: number | null = null;
    private hasLoggedWarning: boolean = false;

    constructor(scene: Phaser.Scene, playerManager: PlayerManager, effectsManager?: EffectsManager) {
        this.scene = scene;
        this.playerManager = playerManager;
        this.effectsManager = effectsManager;
        this.triggerZones = this.scene.physics.add.group();
    }

    /**
     * Sets the effects manager for this trigger zone manager
     * @param effectsManager The effects manager to use
     */
    public setEffectsManager(effectsManager: EffectsManager): void {
        this.effectsManager = effectsManager;
    }

    /**
     * Clears all existing trigger zones
     */
    public clearZones(): void {
        // Clear active timers
        this.activeZoneTimers.forEach(timer => timer.destroy());
        this.activeZoneTimers.clear();

        this.healingTimers.forEach(timer => timer.destroy());
        this.healingTimers.clear();

        this.damageTimers.forEach(timer => timer.destroy());
        this.damageTimers.clear();

        // Clean up poison cloud effects if EffectsManager is available
        if (this.effectsManager) {
            this.poisonCloudZones.forEach(zoneId => {
                this.effectsManager?.removePoisonCloudEffect(zoneId);
            });
        }
        this.poisonCloudZones.clear();

        // Clear collision setup timer if it exists
        if (this.collisionSetupTimer) {
            clearTimeout(this.collisionSetupTimer);
            this.collisionSetupTimer = null;
        }

        // Reset warning flag
        this.hasLoggedWarning = false;

        this.triggerZones.clear(true, true);
    }

    /**
     * Creates trigger zones from a map layer
     * @param mapKey The current map key
     * @param map The Phaser tilemap
     */
    public createZonesFromMap(mapKey: string, map: Phaser.Tilemaps.Tilemap): void {
        const triggerLayer = map.getObjectLayer('Trigger');
        if (!triggerLayer) {
            console.warn('Object layer "Trigger" not found for map:', mapKey);
            return;
        }

        // Process each trigger zone object
        triggerLayer.objects.forEach(object => {
            const config: TriggerZoneConfig = {
                x: object.x ?? 0,
                y: object.y ?? 0,
                width: object.width ?? 0,
                height: object.height ?? 0,
                zoneType: object.type || '',
            };

            this.createZone(config);
        });

        // Set up collision detection with the local player
        this.setupPlayerCollision();
    }

    /**
     * Creates a trigger zone and adds it to the group
     */
    private createZone(config: TriggerZoneConfig): void {
        const zone = this.scene.add.zone(config.x + config.width / 2, config.y + config.height / 2, config.width, config.height);
        this.scene.physics.add.existing(zone, false);
        this.triggerZones.add(zone);
        const zoneId = `${config.zoneType}_${config.x}_${config.y}`;
        zone.setData('zoneType', config.zoneType);
        zone.setData('zoneId', zoneId);
        zone.setData('width', config.width);
        zone.setData('height', config.height);

        // Add poison cloud effect for damage zones if EffectsManager is available
        if (config.zoneType === 'damage' && this.effectsManager) {
            this.effectsManager.createPoisonCloudEffect(
                zoneId,
                config.x + config.width / 2,
                config.y + config.height / 2,
                config.width,
                config.height
            );
            this.poisonCloudZones.add(zoneId);
        }
    }

    /**
     * Sets up collision detection with player - separated for clarity
     */
    private setupPlayerCollision(): void {
        // Store a reference to the timer so we can clear it if needed
        if (this.collisionSetupTimer) {
            clearTimeout(this.collisionSetupTimer);
            this.collisionSetupTimer = null;
        }

        const localPlayer = this.playerManager.getLocalPlayerSprite();
        if (localPlayer) {
            this.scene.physics.add.overlap(
                localPlayer,
                this.triggerZones,
                // @ts-expect-error Phaser shit
                this.handleZoneOverlap.bind(this),
                undefined,
                this
            );
            console.log('Collision detection set up successfully');
        } else {
            // Instead of a fixed number of retries, we'll keep trying until the scene is destroyed
            // or the player sprite becomes available
            if (!this.hasLoggedWarning) {
                console.warn('Local player sprite not found - will retry collision detection setup');
                this.hasLoggedWarning = true;
            }

            // Schedule another attempt in 200ms
            this.collisionSetupTimer = setTimeout(() => {
                // Only retry if the scene is still active
                if (this.scene?.scene.isActive()) {
                    this.setupPlayerCollision();
                }
            }, 200) as unknown as number;
        }
    }

    /**
     * Handles player overlap with a trigger zone
     */
    private handleZoneOverlap(player: Phaser.GameObjects.GameObject, trigger: Phaser.GameObjects.GameObject): void {
        const zoneType = trigger.getData('zoneType');
        const zoneId = trigger.getData('zoneId');
        // Prevent duplicate effect triggers
        if (this.activeZoneTimers.has(zoneId)) return;

        if (zoneType === 'shop') {
            eventBus.emit('openShop')
        }

        if (zoneType === 'healing') {
            if (typeof (this.scene as any).startHealingEffect === 'function') {
                (this.scene as any).startHealingEffect();
            }

            // Start healing timer
            this.startHealingTimer(zoneId);
        } else if (zoneType === 'damage') {
            if (typeof (this.scene as any).startDamageEffect === 'function') {
                (this.scene as any).startDamageEffect();
            }

            // Start damage timer
            this.startDamageTimer(zoneId);
        }

        // Set up exit detection for this zone
        this.setupZoneExitDetection(player, trigger, () => {
            if (zoneType === 'healing') {
                if (typeof (this.scene as any).stopHealingEffect === 'function') {
                    (this.scene as any).stopHealingEffect();
                }

                // Stop healing timer
                this.stopHealingTimer(zoneId);
            } else if (zoneType === 'damage') {
                if (typeof (this.scene as any).stopDamageEffect === 'function') {
                    (this.scene as any).stopDamageEffect();
                }

                // Stop damage timer
                this.stopDamageTimer(zoneId);
            }
        });
    }

    /**
     * Starts a healing timer for the specified zone
     */
    private startHealingTimer(zoneId: string): void {
        if (this.healingTimers.has(zoneId)) {
            this.healingTimers.get(zoneId)?.destroy();
        }

        const healingTimer = this.scene.time.addEvent({
            delay: this.HEAL_INTERVAL,
            callback: () => {
                this.playerManager.healPlayer(this.HEAL_AMOUNT);
            },
            loop: true
        });

        this.healingTimers.set(zoneId, healingTimer);
    }

    /**
     * Stops the healing timer for the specified zone
     */
    private stopHealingTimer(zoneId: string): void {
        if (this.healingTimers.has(zoneId)) {
            this.healingTimers.get(zoneId)?.destroy();
            this.healingTimers.delete(zoneId);
        }
    }

    /**
     * Starts a damage timer for the specified zone
     */
    private startDamageTimer(zoneId: string): void {
        if (this.damageTimers.has(zoneId)) {
            this.damageTimers.get(zoneId)?.destroy();
        }

        const damageTimer = this.scene.time.addEvent({
            delay: this.DAMAGE_INTERVAL,
            callback: () => {
                this.playerManager.damagePlayer(this.DAMAGE_AMOUNT);
            },
            loop: true
        });

        this.damageTimers.set(zoneId, damageTimer);
    }

    /**
     * Stops the damage timer for the specified zone
     */
    private stopDamageTimer(zoneId: string): void {
        if (this.damageTimers.has(zoneId)) {
            this.damageTimers.get(zoneId)?.destroy();
            this.damageTimers.delete(zoneId);
        }
    }

    /**
     * Sets up detection for when a player exits a specific zone
     */
    private setupZoneExitDetection(
        player: Phaser.GameObjects.GameObject,
        trigger: Phaser.GameObjects.GameObject,
        exitCallback: () => void
    ): void {
        const playerSprite = player as Phaser.Physics.Arcade.Sprite;
        const zoneId = trigger.getData('zoneId');

        // Clear any existing timer for this zone
        if (this.activeZoneTimers.has(zoneId)) {
            this.activeZoneTimers.get(zoneId)?.destroy();
        }

        // Create a timer that checks if the player is still in this specific zone
        const exitCheck = this.scene.time.addEvent({
            delay: 100, // Check every 100ms
            callback: () => {
                if (!playerSprite.body || !trigger.body) {
                    // Clean up if objects are destroyed
                    exitCallback();
                    this.activeZoneTimers.delete(zoneId);
                    exitCheck.destroy();
                    return;
                }

                const triggerBody = trigger.body as Phaser.Physics.Arcade.Body;
                const playerBody = playerSprite.body as Phaser.Physics.Arcade.Body;

                // Check if player is still overlapping with this specific trigger
                const stillOverlapping = Phaser.Geom.Rectangle.Overlaps(
                    new Phaser.Geom.Rectangle(
                        triggerBody.x,
                        triggerBody.y,
                        triggerBody.width,
                        triggerBody.height
                    ),
                    new Phaser.Geom.Rectangle(
                        playerBody.x,
                        playerBody.y,
                        playerBody.width,
                        playerBody.height
                    )
                );

                // If player is no longer in this zone, call the exit callback and clean up
                if (!stillOverlapping) {
                    exitCallback();
                    this.activeZoneTimers.delete(zoneId);
                    exitCheck.destroy();
                }
            },
            loop: true
        });

        // Store the timer reference
        this.activeZoneTimers.set(zoneId, exitCheck);
    }
}
