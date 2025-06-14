import Phaser from 'phaser';
import eventBus from '../../../utils/eventBus';
import {getShopBaseUrl} from '../../../utils/apiBaseUrl';
import AnimationManager from '../managers/AnimationManager';

export default class Player extends Phaser.Physics.Arcade.Sprite {
    declare body: Phaser.Physics.Arcade.Body;
    private movementSpeed: number = 100;
    private readonly keys: {
        w: Phaser.Input.Keyboard.Key;
        a: Phaser.Input.Keyboard.Key;
        s: Phaser.Input.Keyboard.Key;
        d: Phaser.Input.Keyboard.Key;
    };
    private readonly cursorPosition: Phaser.Math.Vector2;
    private currentSkin: string = 'player_0';
    private readonly username: string;
    private boundHandleSkinChanged: (skinId: string) => void;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        // Check if we have a pre-fetched skin in the registry
        const selectedSkin = scene.registry.get('selectedSkin');
        const initialSkin = selectedSkin ?? 'player_0';

        // Initialize with the correct skin if available
        super(scene, x, y, initialSkin);

        // Set the current skin
        if (selectedSkin) {
            this.currentSkin = selectedSkin;
        }

        scene.add.existing(this);
        scene.physics.world.enable(this);

        // Get the username from the scene registry
        this.username = scene.registry.get('username') ?? 'Unknown';

        // Only fetch the skin if we don't have it in the registry
        if (!selectedSkin) {
            this.initializeSkinAsync();
        }

        // Listen for skin change events
        this.boundHandleSkinChanged = this.handleSkinChanged.bind(this);
        eventBus.on('skinChanged', this.boundHandleSkinChanged);

        this.setDepth(this.y);
        this.body.setSize(10, 3);
        this.body.setOffset(6, 20);
        this.body.collideWorldBounds = true;

        if (!scene.input.keyboard) {
            throw new Error('Keyboard input is not available on the scene.');
        }
        this.keys = {
            w: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            a: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            s: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            d: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
        };

        this.cursorPosition = new Phaser.Math.Vector2(0, 0);

        scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            this.cursorPosition.x = pointer.worldX;
            this.cursorPosition.y = pointer.worldY;
        });

        this.createAnimations(this.currentSkin);
        this.play(`idle_${this.currentSkin}`);
    }

    update(): boolean {
        const speed = this.movementSpeed;

        let vx = 0;
        let vy = 0;
        let isMoving = false;

        if (this.keys.w.isDown) vy -= 1;
        if (this.keys.s.isDown) vy += 1;
        if (this.keys.a.isDown) vx -= 1;
        if (this.keys.d.isDown) vx += 1;

        if (vx !== 0 || vy !== 0) {
            const vector = new Phaser.Math.Vector2(vx, vy).normalize().scale(speed);
            this.body.setVelocity(vector.x, vector.y);
            this.play(`walk_${this.currentSkin}`, true);
            isMoving = true;
        } else {
            this.body.setVelocity(0, 0);
            this.play(`idle_${this.currentSkin}`, true);
        }

        this.setDepth(this.y);
        this.updateSpriteDirection();
        return isMoving;
    }

    getMovementSpeed(): number {
        return this.movementSpeed;
    }

    setMovementSpeed(speed: number): void {
        this.movementSpeed = speed;
    }

    getCurrentSkin(): string {
        return this.currentSkin;
    }

    // Clean up event listeners when the sprite is destroyed
    destroy(fromScene?: boolean): void {
        eventBus.off('skinChanged', this.boundHandleSkinChanged);
        super.destroy(fromScene);
    }

    private createAnimations(skinKey: string = 'player_0'): void {

        // Use the AnimationManager to create animations for this skin
        const animManager = new AnimationManager(this.scene);
        animManager.createAnimations(skinKey);
    }

    private updateSpriteDirection() {
        if (this.cursorPosition.x > this.x) {
            this.setFlipX(false);
        } else {
            this.setFlipX(true);
        }
    }

    private initializeSkinAsync(): void {
        // Fire and forget - async initialization outside constructor
        this.fetchSelectedSkin().catch(error => {
            console.error('Failed to initialize skin:', error);
        });
    }

    private async fetchSelectedSkin(): Promise<void> {
        try {
            const response = await fetch(`${getShopBaseUrl()}/api/shop/preferences/${this.username}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.currentSkin = data.selectedSkin;
                this.updateSkin(this.currentSkin);

                // Force animation update to ensure the skin is visible immediately
                this.play(`idle_${this.currentSkin}`, true);
            }
        } catch (error) {
            console.error('Error fetching selected skin:', error);
        }
    }

    private handleSkinChanged(skinId: string): void {
        // Check if the scene is still active
        if (!this.scene || this.scene.sys.isActive() === false) {
            return;
        }
        this.currentSkin = skinId;
        this.updateSkin(skinId);
    }

    private updateSkin(skinId: string): void {
        // Check if the scene is still active
        if (!this.scene || !this.scene.sys || this.scene.sys.isActive() === false) {
            return;
        }

        // Store current animation state
        const wasPlaying = this.anims?.isPlaying;
        const currentAnimKey = this.anims?.currentAnim?.key;
        
        // Stop current animation
        this.anims?.stop();

        // Create animations for the new skin
        this.createAnimations(skinId);

        // Update the texture and force a frame update
        this.setTexture(skinId, 0);
        
        // Update the current skin property
        this.currentSkin = skinId;

        // Determine which animation to play
        let newAnimKey = `idle_${skinId}`;
        
        if (wasPlaying && currentAnimKey) {
            if (currentAnimKey === 'idle' || currentAnimKey.startsWith('idle_')) {
                newAnimKey = `idle_${skinId}`;
            } else if (currentAnimKey === 'walk' || currentAnimKey.startsWith('walk_')) {
                newAnimKey = `walk_${skinId}`;
            } else if (currentAnimKey === 'death' || currentAnimKey.startsWith('death_')) {
                newAnimKey = `death_${skinId}`;
            } else if (currentAnimKey === 'hit' || currentAnimKey.startsWith('hit_')) {
                newAnimKey = `hit_${skinId}`;
            }
        }
        
        // Start the new animation immediately
        this.play(newAnimKey, true);
    }
}
