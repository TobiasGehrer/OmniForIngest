import Phaser from 'phaser';
import WebSocketService from '../../services/WebSocketService.ts';
import PlayerManager from './PlayerManager.ts';
import ChatInputState from '../../../services/ChatInputState';
import eventBus from '../../../utils/eventBus.ts';

export default class InputManager {
    private readonly scene: Phaser.Scene;
    private keys: {
        w: Phaser.Input.Keyboard.Key;
        a: Phaser.Input.Keyboard.Key;
        s: Phaser.Input.Keyboard.Key;
        d: Phaser.Input.Keyboard.Key;
        space: Phaser.Input.Keyboard.Key;
    } | null = null;
    private readonly cursorPosition: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0);
    private lastPositionSent: number = 0;
    private lastAttackSent: number = 0;
    private readonly positionUpdateInterval: number = 1000 / 60; // 60 FPS
    private readonly attackCooldown: number = 500;
    private readonly websocket: WebSocketService;
    private readonly playerManager: PlayerManager;
    private inputsEnabled: boolean = false;
    private readonly playerSpeed: number = 130;
    private chatInputState: ChatInputState | null = null;

    constructor(scene: Phaser.Scene, websocket: WebSocketService, playerManager: PlayerManager) {
        this.scene = scene;
        this.websocket = websocket;
        this.playerManager = playerManager;
        this.setupKeys();
        this.setupEventListeners();
    }

    public enableInputs(): void {
        this.inputsEnabled = true;
        try {
            // Re-capture game keys when returning to game mode
            if (this.scene?.input?.keyboard) {
                this.scene.input.keyboard.addCapture([
                    Phaser.Input.Keyboard.KeyCodes.W,
                    Phaser.Input.Keyboard.KeyCodes.A,
                    Phaser.Input.Keyboard.KeyCodes.S,
                    Phaser.Input.Keyboard.KeyCodes.D,
                    Phaser.Input.Keyboard.KeyCodes.SPACE
                ]);
            }
        } catch (error) {
            console.warn(error)
        }
    }

    public disableInputs(): void {
        this.inputsEnabled = false;
        // Release game keys when in chat mode so they can be used for typing
        try {
            if (this.scene?.input?.keyboard) {
                this.scene.input.keyboard.removeCapture([
                    Phaser.Input.Keyboard.KeyCodes.W,
                    Phaser.Input.Keyboard.KeyCodes.A,
                    Phaser.Input.Keyboard.KeyCodes.S,
                    Phaser.Input.Keyboard.KeyCodes.D,
                    Phaser.Input.Keyboard.KeyCodes.SPACE
                ]);
            }
        } catch (error) {
            console.warn(error);
        }
    }

    update(time: number): void {
        if (!this.validateUpdatePreconditions()) return;

        const localPlayer = this.playerManager.getLocalPlayer()!;
        const body = localPlayer.body as Phaser.Physics.Arcade.Body;
        this.processPlayerMovement(body, localPlayer);
        this.updateCursorPosition();
        this.updateSpriteDirection();
        this.sendPositionUpdate(time, localPlayer, body);
        this.processAttackInput(time, localPlayer);
    }

    /**
     * Clean up event listeners to prevent memory leaks
     */
    public cleanup(): void {
        // Remove event bus listeners
        eventBus.off('countdown_started');
        eventBus.off('countdown');
        eventBus.off('game_started');
        eventBus.off('countdown_cancelled');
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

        // Update animations using skin-specific keys
        const skinKey = localPlayer.texture.key;
        if (vx !== 0 || vy !== 0) {
            localPlayer.play(`walk_${skinKey}`, true);
        } else {
            localPlayer.play(`idle_${skinKey}`, true);
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

        if (this.scene.sound?.add) {
            const attackSound = this.scene.sound.add('attack_fx', {volume: 0.3});
            attackSound.play();
        }
    }

    private setupEventListeners(): void {
        // Use ChatInputState instead of eventBus for chat input
        this.chatInputState = ChatInputState.getInstance();

        // Add listener for chat input state changes
        this.chatInputState.addListener(this.dispatchChatStateAction.bind(this));

        // Disable player input during ready up phase (when countdown starts)
        eventBus.on('countdown_started', () => {
            this.disableInputs();
        });

        // Keep inputs disabled during countdown
        eventBus.on('countdown', () => {
            if (this.inputsEnabled) {
                this.disableInputs();
            }
        });

        // Re-enable player input when the game starts (countdown reaches zero)
        eventBus.on('game_started', () => {
            this.enableInputs();
        });

        // If countdown is cancelled, re-enable inputs
        eventBus.on('countdown_cancelled', () => {
            this.enableInputs();
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

    private dispatchChatStateAction(isActive: boolean): void {
        const actions = new Map([
            [true, () => this.onChatActivated()],
            [false, () => this.onChatDeactivated()]
        ]);
        
        const action = actions.get(isActive);
        if (action) {
            action();
        }
    }

    private onChatActivated(): void {
        this.disableInputs();
    }

    private onChatDeactivated(): void {
        this.enableInputs();
    }

    private validateUpdatePreconditions(): boolean {
        if (!this.keys || !this.inputsEnabled) return false;
        
        const localPlayer = this.playerManager.getLocalPlayer();
        if (!localPlayer) return false;
        
        const body = localPlayer.body as Phaser.Physics.Arcade.Body;
        return !!body;
    }

    private processPlayerMovement(body: Phaser.Physics.Arcade.Body, localPlayer: Phaser.GameObjects.Sprite): void {
        if (this.playerManager.isLocalPlayerDead()) {
            this.processDeadPlayer(body, localPlayer);
        } else {
            this.processAlivePlayer(body, localPlayer);
        }
    }

    private processAlivePlayer(body: Phaser.Physics.Arcade.Body, localPlayer: Phaser.GameObjects.Sprite): void {
        this.handleMovement(body, localPlayer);
    }

    private processDeadPlayer(body: Phaser.Physics.Arcade.Body, localPlayer: Phaser.GameObjects.Sprite): void {
        this.handleDeadPlayerState(body, localPlayer);
    }

    private handleDeadPlayerState(body: Phaser.Physics.Arcade.Body, localPlayer: Phaser.GameObjects.Sprite): void {
        body.setVelocity(0, 0);
        
        const skinKey = localPlayer.texture.key;
        const deathAnimKey = `death_${skinKey}`;
        if (localPlayer.anims.currentAnim?.key !== deathAnimKey) {
            localPlayer.play(deathAnimKey, true);
        }
    }

    private sendPositionUpdate(time: number, localPlayer: Phaser.GameObjects.Sprite, body: Phaser.Physics.Arcade.Body): void {
        if (time - this.lastPositionSent <= this.positionUpdateInterval) return;
        if (!this.websocket.isSocketConnected()) return;
        
        const isDead = this.playerManager.isLocalPlayerDead();
        this.websocket.sendMessage('position', {
            x: localPlayer.x,
            y: localPlayer.y,
            vx: isDead ? 0 : body.velocity.x / this.playerSpeed,
            vy: isDead ? 0 : body.velocity.y / this.playerSpeed,
            flipX: localPlayer.flipX
        });
        this.lastPositionSent = time;
    }

    private processAttackInput(time: number, localPlayer: Phaser.GameObjects.Sprite): void {
        const isDead = this.playerManager.isLocalPlayerDead();
        if (this.keys!.space.isDown && time - this.lastAttackSent > this.attackCooldown && !isDead) {
            this.handleAttack(localPlayer, time);
        }
    }

    private updateCursorPosition() {
        const pointer = this.scene.input.activePointer;
        pointer.updateWorldPoint(this.scene.cameras.main)
        this.cursorPosition.x = pointer.worldX;
        this.cursorPosition.y = pointer.worldY;
    }
}
