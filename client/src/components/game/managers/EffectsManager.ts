import Phaser from 'phaser';
import PlayerManager from './PlayerManager';

export default class EffectsManager {
    private scene: Phaser.Scene;
    private playerManager: PlayerManager;
    private healingInterval?: number;
    private damageInterval?: number;
    private healingSound?: Phaser.Sound.BaseSound;
    private poisonCloudEmitters: Map<string, Phaser.GameObjects.Particles.ParticleEmitter> = new Map();
    private readonly EFFECT_INTERVAL = 500;

    constructor(scene: Phaser.Scene, playerManager: PlayerManager) {
        this.scene = scene;
        this.playerManager = playerManager;
    }

    public startHealingEffect(): void {
        // Only start the healing effect if it's not already running
        if (this.healingInterval) {
            return;
        }

        // Play healing sound effect
        if (this.scene.sound && !this.healingSound) {
            this.healingSound = this.scene.sound.add('heal_fx', {
                volume: 0.2,
                loop: true
            });
            this.healingSound.play();
        }

        // Create a healing interval that's continuously emitting particles
        this.healingInterval = window.setInterval(() => {
            // Only show effects if the player is alive
            if (!this.playerManager.isLocalPlayerDead()) {

                const localPlayerSprite = this.playerManager.getLocalPlayerSprite();
                if (localPlayerSprite) {
                    this.addHealingParticles(localPlayerSprite.x, localPlayerSprite.y);
                }
            }
        }, this.EFFECT_INTERVAL);
    }

    public stopHealingEffect(): void {
        if (this.healingInterval) {
            clearInterval(this.healingInterval);
            this.healingInterval = undefined;
        }
        // Stop and destroy healing sound effect
        if (this.healingSound) {
            this.healingSound.stop();
            this.healingSound.destroy();
            this.healingSound = undefined;
        }
    }

    /**
     * Creates a poison cloud effect at a specific zone location
     * @param zoneId Unique ID for the zone
     * @param x X coordinate of the zone center
     * @param y Y coordinate of the zone center
     * @param width Width of the zone
     * @param height Height of the zone
     */
    public createPoisonCloudEffect(zoneId: string, x: number, y: number, width: number, height: number): void {
        if (this.poisonCloudEmitters.has(zoneId)) {
            return;
        }

        const textureKey = 'poison_particle';

        // Create the poison particle texture if it doesn't exist
        if (!this.scene.textures.exists(textureKey)) {
            const graphics = this.scene.add.graphics();

            const particleSize = 8;
            graphics.fillStyle(0x88ff00, 0.7);
            graphics.fillCircle(particleSize / 2, particleSize / 2, particleSize / 2);

            graphics.generateTexture(textureKey, particleSize, particleSize);
            graphics.destroy();
        }

        // Create a particle emitter for the poison cloud
        const poisonCloudEmitter = this.scene.add.particles(x, y, textureKey, {
            speed: {
                min: 5,
                max: 15
            },
            scale: {
                start: 0.8,
                end: 0.1
            },
            alpha: {
                start: 0.5,
                end: 0
            },
            lifespan: {
                min: 2000,
                max: 4000
            },
            quantity: 3,
            frequency: 200,
            blendMode: 'ADD',
            // @ts-expect-error Phaser shit
            emitZone: {
                type: 'random',
                source: new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height)
            },
            tint: [0x88ff00, 0x66dd00, 0x99ff33, 0x77cc33],
            rotate: {
                min: 0,
                max: 360
            },
            gravityY: -2,
            deathZone: {
                type: 'onEnter',
                source: new Phaser.Geom.Rectangle(-width / 2 - 20, -height / 2 - 20, width + 40, height + 40)
            }
        });

        poisonCloudEmitter.setDepth(99999);

        // Store the emitter reference for later cleanup
        this.poisonCloudEmitters.set(zoneId, poisonCloudEmitter);
    }

    /**
     * Removes a poison cloud effect for a specific zone
     * @param zoneId Unique ID for the zone
     */
    public removePoisonCloudEffect(zoneId: string): void {
        const emitter = this.poisonCloudEmitters.get(zoneId);
        if (emitter) {
            emitter.stop();
            emitter.destroy();
            this.poisonCloudEmitters.delete(zoneId);
        }
    }

    public cleanup(): void {
        // Clear any existing effect intervals
        if (this.healingInterval) {
            clearInterval(this.healingInterval);
            this.healingInterval = undefined;
        }

        if (this.damageInterval) {
            clearInterval(this.damageInterval);
            this.damageInterval = undefined;
        }

        // Stop and destroy healing sound effect
        if (this.healingSound) {
            this.healingSound.stop();
            this.healingSound.destroy();
            this.healingSound = undefined;
        }

        // Clean up all poison cloud emitters
        this.poisonCloudEmitters.forEach(emitter => {
            emitter.stop();
            emitter.destroy();
        });
        this.poisonCloudEmitters.clear();
    }

    private addHealingParticles(x: number, y: number): void {
        const textureKey = 'heal_cross';

        // Create the cross texture if it doesn't exist
        if (!this.scene.textures.exists(textureKey)) {
            const graphics = this.scene.add.graphics();
            graphics.fillStyle(0x00ff00, 1); // Green color

            // Define cross dimensions
            const crossSize = 9; // Total width/height of the cross texture
            const barThickness = 3; // Thickness of the arms of the cross

            // Draw horizontal bar of the cross
            graphics.fillRect(
                0,
                (crossSize - barThickness) / 2,
                crossSize,
                barThickness
            );
            // Draw vertical bar of the cross
            graphics.fillRect(
                (crossSize - barThickness) / 2,
                0,
                barThickness,
                crossSize
            );

            graphics.generateTexture(textureKey, crossSize, crossSize);
            graphics.destroy();
        }

        const particleEmitter = this.scene.add.particles(x, y, textureKey, {
            speed: {
                min: 25,
                max: 50
            },
            angle: {
                min: -100,
                max: -80
            },
            gravityY: -20,
            accelerationX: {
                onUpdate: (_particle, _key, t) => {
                    return Math.sin(t * 11) * 180;
                }
            },
            lifespan: {
                min: 600,
                max: 1000
            },
            quantity: 1,
            frequency: 100,
            scale: {
                onEmit: () => Phaser.Math.FloatBetween(0.5, 1.2),
                end: 0,
                ease: 'Quad.easeOut'
            },
            alpha: {
                start: 1,
                end: 0,
                ease: 'Quad.easeOut'
            },
            tint: [0x00ff00, 0x44ff44, 0x00cc00, 0x88ff88],
            // @ts-expect-error Phaser shit
            emitZone: {
                source: new Phaser.Geom.Rectangle(-8, -12, 16, 12), // width 16, height 12
                type: 'random'
            },
            blendMode: 'ADD',
        });

        particleEmitter.setDepth(999999);

        // Duration of particle emission
        const emissionDuration = 500;
        this.scene.time.delayedCall(emissionDuration, () => {
            if (particleEmitter.active) {
                particleEmitter.stop();
            }
        });

        const totalEffectDuration = emissionDuration + 1000;
        this.scene.time.delayedCall(totalEffectDuration, () => {
            if (particleEmitter.active) {
                particleEmitter.destroy();
            }
        });
    }
}
