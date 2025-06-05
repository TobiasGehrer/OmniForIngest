import Phaser from 'phaser';

export default class NPC extends Phaser.GameObjects.Sprite {
    constructor(scene: Phaser.Scene, x: number, y: number, texture: string, frame?: number) {
        super(scene, x, y, texture, frame);
        scene.add.existing(this);
        this.setDepth(1);
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

    playAnim(key: string) {
        this.play(key);
    }
}
