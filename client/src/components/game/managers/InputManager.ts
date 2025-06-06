import Phaser from 'phaser';
import WebSocketService from '../../services/WebSocketService.ts';
import PlayerManager from './PlayerManager.ts';
import ChatInputState from '../../../services/ChatInputState';

export default class InputManager {
    private scene: Phaser.Scene;
    private keys: {
        w: Phaser.Input.Keyboard.Key;
        a: Phaser.Input.Keyboard.Key;
        s: Phaser.Input.Keyboard.Key;
        d: Phaser.Input.Keyboard.Key;
        space: Phaser.Input.Keyboard.Key;
    } | null = null;
    private cursorPosition: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0);
    private lastPositionSent: number = 0;
    private lastAttackSent: number = 0;
    private positionUpdateInterval: number = 1000 / 60; // 60 FPS
    private attackCooldown: number = 500;
    private websocket: WebSocketService;
    private playerManager: PlayerManager;
    private inputsEnabled: boolean = true;
    private playerSpeed: number = 130;

    constructor(scene: Phaser.Scene, websocket: WebSocketService, playerManager: PlayerManager) {
        this.scene = scene;
        this.websocket = websocket;
        this.playerManager = playerManager;
        this.setupKeys();
        this.setupEventListeners();
    }

    public enableInputs(): void {
        this.inputsEnabled = true;
        // Re-capture game keys when returning to game mode
        if (this.scene.input.keyboard) {
            this.scene.input.keyboard.addCapture([
                Phaser.Input.Keyboard.KeyCodes.W,
                Phaser.Input.Keyboard.KeyCodes.A,
                Phaser.Input.Keyboard.KeyCodes.S,
                Phaser.Input.Keyboard.KeyCodes.D,
                Phaser.Input.Keyboard.KeyCodes.SPACE
            ]);
        }
    }

    public disableInputs(): void {
        this.inputsEnabled = false;
        // Release game keys when in chat mode so they can be used for typing
        if (this.scene.input.keyboard) {
            this.scene.input.keyboard.removeCapture([
                Phaser.Input.Keyboard.KeyCodes.W,
                Phaser.Input.Keyboard.KeyCodes.A,
                Phaser.Input.Keyboard.KeyCodes.S,
                Phaser.Input.Keyboard.KeyCodes.D,
                Phaser.Input.Keyboard.KeyCodes.SPACE
            ]);
        }
    }

    update(time: number): void {
        if (!this.keys || ! this.inputsEnabled) return;

        const localPlayer = this.playerManager.getLocalPlayer();
        if (!localPlayer) return;

        // Get physics body from sprite
        const body = localPlayer.body as Phaser.Physics.Arcade.Body;
        if (!body) return;

        const isDead = this.playerManager.isLocalPlayerDead();

        // Only process movement if player is alive
        if (!isDead) {
            this.handleMovement(body, localPlayer);
        } else {
            // If player is dead, stop all movement
            body.setVelocity(0, 0);

            // Check if the current animation is not death before forcing it
            if (localPlayer.anims.currentAnim?.key !== 'death') {
                localPlayer.play('death', true);
            }
        }

        this.updateCursorPosition();
        this.updateSpriteDirection();

        // Send position update
        if (time - this.lastPositionSent > this.positionUpdateInterval) {
            // Only send if WebSocket is connected
            if (this.websocket.isSocketConnected()) {
                this.websocket.sendMessage('position', {
                    x: localPlayer.x,
                    y: localPlayer.y,
                    vx: isDead ? 0 : body.velocity.x / this.playerSpeed, // Normalized velocity for animation
                    vy: isDead ? 0 : body.velocity.y / this.playerSpeed, // Normalized velocity for animation
                    flipX: localPlayer.flipX
                });
            }
            this.lastPositionSent = time;
        }

        // Handle attack input
        if (this.keys.space.isDown && time - this.lastAttackSent > this.attackCooldown && !isDead) {
            this.handleAttack(localPlayer, time);
        }
    }

    private handleMovement(body: Phaser.Physics.Arcade.Body, localPlayer: Phaser.GameObjects.Sprite): void {
        let vx: number = 0;
        let vy: number = 0;

        if (this.keys!.a.isDown) vx -= 1;
        if (this.keys!.d.isDown) vx += 1;
        if (this.keys!.w.isDown) vy -= 1;
        if (this.keys!.s.isDown) vy += 1;

        // Normalize diagonal movement
        if (vx !== 0 && vy !== 0) {
            const length = Math.sqrt(vx * vx + vy * vy)
            vx = vx / length;
            vy = vy / length;
        }

        body.setVelocity(vx * this.playerSpeed, vy * this.playerSpeed)

        // Update animations
        if (vx !== 0 || vy !== 0) {
            localPlayer.play('walk', true);
        } else {
            localPlayer.play('idle', true);
        }
    }

    private handleAttack(localPlayer: Phaser.GameObjects.Sprite, time: number): void {
        const directionX = this.cursorPosition.x - localPlayer.x;
        const directionY = this.cursorPosition.y - localPlayer.y;

        const length = Math.sqrt(directionX * directionX + directionY * directionY);
        const normalizedDirectionX = directionX / length;
        const normalizedDirectionY = directionY / length;

        if (this.websocket.isSocketConnected()) {
            this.websocket.sendMessage('attack', {
                directionX: normalizedDirectionX,
                directionY: normalizedDirectionY
            });
        }
        this.lastAttackSent = time;

        if (this.scene.sound && this.scene.sound.add) {
            const attackSound = this.scene.sound.add('attack_fx', {volume: 0.3});
            attackSound.play();
        }
    }

    private setupEventListeners(): void {
        // Use ChatInputState instead of eventBus
        const chatInputState = ChatInputState.getInstance();

        // Add listener for chat input state changes
        chatInputState.addListener((isActive: boolean) => {
            if (isActive) {
                this.disableInputs();
            } else {
                this.enableInputs();
            }
        });
    }

    private setupKeys(): void {
        if (!this.scene.input.keyboard) {
            throw new Error('Keyboard not found.');
        }

        this.keys = {
            w: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            a: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            s: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            d: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            space: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        };

        // Ensure these keys don't propagate to the browser when game is active
        // This prevents them from affecting chat input when game inputs are disabled
        this.scene.input.keyboard.disableGlobalCapture();
        this.scene.input.keyboard.addCapture([
            Phaser.Input.Keyboard.KeyCodes.W,
            Phaser.Input.Keyboard.KeyCodes.A,
            Phaser.Input.Keyboard.KeyCodes.S,
            Phaser.Input.Keyboard.KeyCodes.D,
            Phaser.Input.Keyboard.KeyCodes.SPACE
        ]);
    }

    private updateSpriteDirection(): void {
        const isDead = this.playerManager.isLocalPlayerDead();

        if (isDead) {
            return;
        }

        const localPlayer = this.playerManager.getLocalPlayer();
        if (!localPlayer) {
            return
        }

        if (this.cursorPosition.x > localPlayer.x) {
            localPlayer.setFlipX(false);
        } else {
            localPlayer.setFlipX(true);
        }
    }

    private updateCursorPosition() {
        const pointer = this.scene.input.activePointer;
        pointer.updateWorldPoint(this.scene.cameras.main)
        this.cursorPosition.x = pointer.worldX;
        this.cursorPosition.y = pointer.worldY;
    }
}
