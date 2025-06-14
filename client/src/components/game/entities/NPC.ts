import Phaser from 'phaser';

export default class NPC extends Phaser.GameObjects.Sprite {
    declare body: Phaser.Physics.Arcade.Body;
    private healthBar?: Phaser.GameObjects.Image;
    private readonly HEALTH_BAR_OFFSET_Y = -25;
    private readonly maxHealth: number = 4;
    private currentHealth: number = 4;
    private isDead: boolean = false;
    private npcId: string = '';
    private isCombatNPC: boolean = false;

    constructor(scene: Phaser.Scene, x: number, y: number, texture: string, frame?: number) {
        super(scene, x, y, texture, frame);
        scene.add.existing(this);
        this.setDepth(1);
    }

    static createCombatNPC(scene: Phaser.Scene, x: number, y: number, npcId: string): NPC {
        const npc = new NPC(scene, x, y, 'npc');
        npc.initializeCombatNPC(npcId);
        return npc;
    }

    setupAnimations(animConfig: {
        key: string,
        frames: {
            start: number,
            end: number
        },
        frameRate: number,
        repeat: number
    }) {
        this.scene.anims.create({
            key: animConfig.key,
            frames: this.scene.anims.generateFrameNumbers(this.texture.key, {
                start: animConfig.frames.start,
                end: animConfig.frames.end
            }),
            frameRate: animConfig.frameRate,
            repeat: animConfig.repeat
        });
    }

    public updateNPC(data: {
        x: number;
        y: number;
        flipX: boolean;
        health: number;
        isDead: boolean;
        behavior: string;
    }): void {
        if (!this.isCombatNPC) return;

        // Smooth movement interpolation
        this.scene.tweens.add({
            targets: this,
            x: data.x,
            y: data.y,
            duration: 200,
            ease: 'Linear'
        });

        this.setFlipX(data.flipX);
        this.setDepth(data.y);

        // Update health
        this.updateHealth(data.health, data.isDead);

        // Update animation based on behavior
        this.updateAnimation(data.behavior, data.isDead);
    }

    public takeDamage(): void {
        if (!this.isCombatNPC) return;

        // Visual feedback when NPC takes damage
        this.setTint(0xff0000);

        // Flash effect
        this.scene.tweens.add({
            targets: this,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 2,
            onComplete: () => {
                this.clearTint();
                this.setAlpha(1);
            }
        });

        // Screen shake for impact
        this.scene.cameras.main.shake(100, 0.002);
    }

    playAnim(key: string) {
        this.play(key);
    }

    public destroy(fromScene?: boolean): void {
        if (this.healthBar) {
            this.healthBar.destroy();
        }
        super.destroy(fromScene);
    }

    // Getters for combat NPCs
    public getNPCId(): string {
        return this.npcId;
    }

    public getHealth(): number {
        return this.currentHealth;
    }

    public getMaxHealth(): number {
        return this.maxHealth;
    }

    public isNPCDead(): boolean {
        return this.isDead;
    }

    public isCombatType(): boolean {
        return this.isCombatNPC;
    }

    private initializeCombatNPC(npcId: string): void {
        this.npcId = npcId;
        this.isCombatNPC = true;

        // Enable physics for combat NPCs
        this.scene.physics.world.enable(this);
        this.body.setSize(16, 8);
        this.body.setOffset(4, 16);
        this.body.setImmovable(true);
        this.body.allowGravity = false;

        this.createCombatAnimations();
        this.createHealthBar();
        this.play('npc-idle');

        // Add distinctive glow to differentiate from players
        this.preFX?.addGlow(0xff6b35, 4, 0, false, 0.1, 8);

        this.setDepth(this.y);
    }

    // Enhanced animation setup for combat NPCs
    private createCombatAnimations(): void {
        const anims = this.scene.anims;

        if (!anims.exists('npc-idle')) {
            anims.create({
                key: 'npc-idle',
                frames: anims.generateFrameNumbers('npc', {
                    start: 36,
                    end: 37
                }),
                frameRate: 2,
                repeat: -1
            });
        }

        if (!anims.exists('npc-walk')) {
            anims.create({
                key: 'npc-walk',
                frames: anims.generateFrameNumbers('npc', {
                    start: 9,
                    end: 12
                }),
                frameRate: 6,
                repeat: -1
            });
        }

        if (!anims.exists('npc-attack')) {
            anims.create({
                key: 'npc-attack',
                frames: anims.generateFrameNumbers('npc', {
                    start: 18,
                    end: 21
                }),
                frameRate: 8,
                repeat: 0
            });
        }

        if (!anims.exists('npc-death')) {
            anims.create({
                key: 'npc-death',
                frames: anims.generateFrameNumbers('npc', {
                    start: 27,
                    end: 31
                }),
                frameRate: 6,
                repeat: 0
            });
        }
    }

    private createHealthBar(): void {
        if (!this.isCombatNPC || !this.scene.textures.exists('healthbar')) {
            return;
        }

        this.healthBar = this.scene.add.image(
            this.x,
            this.y + this.HEALTH_BAR_OFFSET_Y,
            'healthbar',
            0
        );
        this.healthBar.setOrigin(0.5, 0.5);
        this.healthBar.setDepth(this.depth + 1);
    }

    private updateHealth(health: number, isDead: boolean): void {
        if (!this.isCombatNPC) return;

        this.currentHealth = health;
        this.isDead = isDead;

        if (this.healthBar) {
            if (isDead) {
                this.healthBar.setVisible(false);
            } else {
                // Calculate health frame (0 = full health, 4 = empty)
                const healthFrame = Math.max(0, Math.min(4, this.maxHealth - health));
                this.healthBar.setFrame(healthFrame);
                this.healthBar.setVisible(true);
                this.healthBar.setDepth(this.depth + 1);

                // Update health bar position
                this.healthBar.x = this.x;
                this.healthBar.y = this.y + this.HEALTH_BAR_OFFSET_Y;
            }
        }
    }

    private updateAnimation(behavior: string, isDead: boolean): void {
        if (!this.isCombatNPC) return;

        if (isDead) {
            if (this.anims.currentAnim?.key !== 'npc-death') {
                this.play('npc-death');
            }
            return;
        }

        switch (behavior) {
            case 'ATTACK':
                if (this.anims.currentAnim?.key !== 'npc-attack') {
                    this.play('npc-attack');
                    // Return to idle after attack animation
                    this.once('animationcomplete-npc-attack', () => {
                        this.play('npc-idle');
                    });
                }
                break;
            case 'CHASE':
            case 'PATROL':
                if (this.anims.currentAnim?.key !== 'npc-walk') {
                    this.play('npc-walk');
                }
                break;
            case 'IDLE':
            default:
                if (this.anims.currentAnim?.key !== 'npc-idle') {
                    this.play('npc-idle');
                }
                break;
        }
    }
}
