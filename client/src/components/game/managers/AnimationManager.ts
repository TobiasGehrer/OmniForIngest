import Phaser from 'phaser';

export default class AnimationManager {
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    createAnimations(): void {
        if (!this.scene.anims.exists('idle')) {
            this.scene.anims.create({
                key: 'idle',
                frames: this.scene.anims.generateFrameNumbers('player', {
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
                frames: this.scene.anims.generateFrameNumbers('player', {
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
                frames: this.scene.anims.generateFrameNumbers('player', {
                    start: 18,
                    end: 26
                }),
                frameRate: 8
            });
        }

        if (!this.scene.anims.exists('hit')) {
            this.scene.anims.create({
                key: 'hit',
                frames: this.scene.anims.generateFrameNumbers('player', {
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
