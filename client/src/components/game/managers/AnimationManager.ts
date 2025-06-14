import Phaser from 'phaser';

export default class AnimationManager {
    private readonly scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    createAnimations(skinKey: string = 'player_0'): void {
        // Check if scene is still active
        if (!this.scene || !this.scene.sys || !this.scene.sys.isActive()) {
            return;
        }

        // Check if animation manager exists
        if (!this.scene.anims) {
            return;
        }

        // Create standard animations that work with all skins
        // Use the skinKey parameter to create animations for the specific skin

        // Create idle animation for this skin
        const idleKey = `idle_${skinKey}`;
        if (!this.scene.anims.exists(idleKey)) {
            this.scene.anims.create({
                key: idleKey,
                frames: this.scene.anims.generateFrameNumbers(skinKey, {
                    start: 0,
                    end: 7
                }),
                frameRate: 8,
                repeat: -1
            });
        }

        // Create walk animation for this skin
        const walkKey = `walk_${skinKey}`;
        if (!this.scene.anims.exists(walkKey)) {
            this.scene.anims.create({
                key: walkKey,
                frames: this.scene.anims.generateFrameNumbers(skinKey, {
                    start: 9,
                    end: 12
                }),
                frameRate: 8,
                repeat: -1
            });
        }

        // Create death animation for this skin
        const deathKey = `death_${skinKey}`;
        if (!this.scene.anims.exists(deathKey)) {
            this.scene.anims.create({
                key: deathKey,
                frames: this.scene.anims.generateFrameNumbers(skinKey, {
                    start: 18,
                    end: 26
                }),
                frameRate: 8
            });
        }

        // Create hit animation for this skin
        const hitKey = `hit_${skinKey}`;
        if (!this.scene.anims.exists(hitKey)) {
            this.scene.anims.create({
                key: hitKey,
                frames: this.scene.anims.generateFrameNumbers(skinKey, {
                    start: 27,
                    end: 27
                }),
                frameRate: 4,
            });
        }

        // Also create the standard animations for backward compatibility
        if (!this.scene.anims.exists('idle')) {
            this.scene.anims.create({
                key: 'idle',
                frames: this.scene.anims.generateFrameNumbers('player_0', {
                    start: 0,
                    end: 7
                }),
                frameRate: 8,
                repeat: -1
            });
        }

        if (!this.scene.anims.exists('walk')) {
            this.scene.anims.create({
                key: 'walk',
                frames: this.scene.anims.generateFrameNumbers('player_0', {
                    start: 9,
                    end: 12
                }),
                frameRate: 8,
                repeat: -1
            });
        }

        if (!this.scene.anims.exists('death')) {
            this.scene.anims.create({
                key: 'death',
                frames: this.scene.anims.generateFrameNumbers('player_0', {
                    start: 18,
                    end: 26
                }),
                frameRate: 8
            });
        }

        if (!this.scene.anims.exists('hit')) {
            this.scene.anims.create({
                key: 'hit',
                frames: this.scene.anims.generateFrameNumbers('player_0', {
                    start: 27,
                    end: 27
                }),
                frameRate: 4,
            });
        }

        if (!this.scene.anims.exists('projectile_anim')) {
            this.scene.anims.create({
                key: 'projectile_anim',
                frames: this.scene.anims.generateFrameNumbers('projectile', {
                    start: 0,
                    end: 3
                }),
                frameRate: 8,
                repeat: -1
            });
        }
    }
}
