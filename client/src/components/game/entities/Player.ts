import Phaser from 'phaser';

export default class Player extends Phaser.Physics.Arcade.Sprite {
    declare body: Phaser.Physics.Arcade.Body;
    private movementSpeed: number = 100;
    private keys: {
        w: Phaser.Input.Keyboard.Key;
        a: Phaser.Input.Keyboard.Key;
        s: Phaser.Input.Keyboard.Key;
        d: Phaser.Input.Keyboard.Key;
    };
    private cursorPosition: Phaser.Math.Vector2;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'player');

        scene.add.existing(this);
        scene.physics.world.enable(this);

        this.setDepth(this.y);
        this.body = this.body as Phaser.Physics.Arcade.Body;
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

        this.createAnimations();
        this.play('idle');
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
            this.play('walk', true);
            isMoving = true;
        } else {
            this.body.setVelocity(0, 0);
            this.play('idle', true);
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

    private createAnimations(): void {
        const anims = this.scene.anims;

        if (!anims.exists('idle')) {
            anims.create({
                key: 'idle',
                frames: anims.generateFrameNumbers('player', {
                    start: 0,
                    end: 7
                }),
                frameRate: 8,
                repeat: -1
            });

            anims.create({
                key: 'walk',
                frames: anims.generateFrameNumbers('player', {
                    start: 9,
                    end: 12
                }),
                frameRate: 8,
                repeat: -1
            });
        }
    }

    private updateSpriteDirection() {
        if (this.cursorPosition.x > this.x) {
            this.setFlipX(false);
        } else {
            this.setFlipX(true);
        }
    }
}
