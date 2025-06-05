import NPC from './NPC.ts';

export default class Shopkeeper extends NPC {
    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'shopkeeper');

        this.setupAnimations({
            key: 'sit-idle',
            frames: {
                start: 36,
                end: 37
            },
            frameRate: 0.5,
            repeat: -1
        });

        this.playAnim('sit-idle');
    }
}
