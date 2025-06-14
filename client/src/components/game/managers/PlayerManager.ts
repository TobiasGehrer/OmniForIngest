import Phaser from 'phaser';
import eventBus from '../../../utils/eventBus';
import {getPlayerColorHex} from '../../../utils/getPlayerColor.ts';
import WebSocketService from '../../services/WebSocketService.ts';
import AnimationManager from './AnimationManager';

interface PlayerMovementData {
    targetX: number;
    targetY: number;
    flipX: boolean;
    lastUpdateTime: number;
}

interface PlayerUpdateData {
    x: number;
    y: number;
    flipX: boolean;
    vx: number;
    vy: number;
    health: number;
    isDead: boolean;
}

export default class PlayerManager {
    private readonly scene: Phaser.Scene;
    private readonly playerSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
    private readonly playerMovementData: Map<string, PlayerMovementData> = new Map();
    private readonly playerHealthBarSprites: Map<string, Phaser.GameObjects.Image> = new Map();
    private readonly playerDeadState: Map<string, boolean> = new Map();
    private readonly playerHitAnimPlaying: Map<string, boolean> = new Map();
    private readonly movementSmoothingFactor: number = 0.2;
    private readonly username!: string;
    private collisionGroup?: Phaser.Physics.Arcade.StaticGroup;
    private readonly HEALTH_BAR_OFFSET_Y = -20;
    private readonly websocket!: WebSocketService;

    private boundHandleSkinChanged: (skinId: string) => void;

    constructor(scene: Phaser.Scene, username: string) {
        this.scene = scene;
        this.username = username;
        this.websocket = WebSocketService.getInstance();

        // Listen for skin change events
        this.boundHandleSkinChanged = this.handleSkinChanged.bind(this);
        eventBus.on('skinChanged', this.boundHandleSkinChanged);
    }

    /**
     * Get a player's sprite by ID
     * @param playerId The ID of the player
     * @returns The player's sprite or undefined if not found
     */
    getPlayerSprite(playerId: string): Phaser.GameObjects.Sprite | undefined {
        return this.playerSprites.get(playerId);
    }

    /**
     * Updates a player's skin to the specified skin ID
     * @param playerId The ID of the player to update
     * @param skinId The skin ID to use
     */
    updatePlayerSkin(playerId: string, skinId: string): void {
        // Check if scene is still active
        if (!this.scene || !this.scene.sys || !this.scene.sys.isActive()) {
            return;
        }

        const playerSprite = this.playerSprites.get(playerId);
        if (!playerSprite) {
            return;
        }

        // Create animations for the new skin before updating
        const animManager = new AnimationManager(this.scene);
        animManager.createAnimations(skinId);

        // Get current animation key and frame if they exist
        const currentAnim = playerSprite.anims?.currentAnim;
        const currentFrame = playerSprite.anims?.currentFrame;

        // Store the animation key if it exists
        const animKey = currentAnim?.key;

        // Store current position, flip state, and other properties
        const x = playerSprite.x;
        const y = playerSprite.y;
        const flipX = playerSprite.flipX;
        const depth = playerSprite.depth;

        // Remove old sprite
        playerSprite.destroy();

        // Create new sprite with the new skin
        const newSprite = this.scene.add.sprite(x, y, skinId);
        newSprite.setFlipX(flipX);
        newSprite.setDepth(depth);

        // Add physics to the new sprite
        this.scene.physics.add.existing(newSprite);

        // Set up physics body
        if (playerId === this.username) {
            const body = newSprite.body as Phaser.Physics.Arcade.Body;
            body.setSize(10, 3);
            body.setOffset(6, 20);
            body.setCollideWorldBounds(true);

            // Make camera follow the new sprite
            this.scene.cameras.main.startFollow(newSprite, true, 0.2, 0.2);
        } else {
            const body = newSprite.body as Phaser.Physics.Arcade.Body;
            body.setImmovable(true);
            body.allowGravity = false;
        }

        // Add player color glow
        const playerColorHex = getPlayerColorHex(playerId);
        newSprite.preFX?.addGlow(playerColorHex, 3);

        // Set up collision
        if (this.collisionGroup) {
            this.scene.physics.add.collider(newSprite, this.collisionGroup);
        }

        // Resume the same animation but with the skin-specific key
        if (animKey && this.scene.anims) {
            // Map the old animation key to the new skin-specific key
            let newAnimKey = '';

            if (animKey === 'idle' || animKey.startsWith('idle_')) {
                newAnimKey = `idle_${skinId}`;
            } else if (animKey === 'walk' || animKey.startsWith('walk_')) {
                newAnimKey = `walk_${skinId}`;
            } else if (animKey === 'death' || animKey.startsWith('death_')) {
                newAnimKey = `death_${skinId}`;
            } else if (animKey === 'hit' || animKey.startsWith('hit_')) {
                newAnimKey = `hit_${skinId}`;
            } else {
                // If we can't map it, use the default idle animation
                newAnimKey = `idle_${skinId}`;
            }

            newSprite.play(newAnimKey);

            // Set the current frame if available
            if (currentFrame) {
                newSprite.anims.setCurrentFrame(currentFrame);
            }
        } else {
            newSprite.play(`idle_${skinId}`);
        }

        // Update the sprite in the map
        this.playerSprites.set(playerId, newSprite);
    }

    setCollisionGroup(group: Phaser.Physics.Arcade.StaticGroup): void {
        this.collisionGroup = group;
    }

    createPlayer(id: string, x: number, y: number, flipX: boolean = false, health: number = 4, isDead: boolean = false, skin: string = ''): void {
        // Create animations for this skin
        const animManager = new AnimationManager(this.scene);
        animManager.createAnimations(skin);

        const playerSprite = this.scene.add.sprite(x, y, skin);

        const playerColorHex = getPlayerColorHex(id);

        // Add physics to the sprite
        this.scene.physics.add.existing(playerSprite);

        // Only enable physics body for local player
        if (id === this.username) {
            const body = playerSprite.body as Phaser.Physics.Arcade.Body;
            body.setSize(10, 3);
            body.setOffset(6, 20);
            body.setCollideWorldBounds(true);
        } else {
            // For non-local players, we'll just update their position based on server data
            const body = playerSprite.body as Phaser.Physics.Arcade.Body;
            body.setImmovable(true);
            body.allowGravity = false;
        }

        // Store sprite
        this.playerSprites.set(id, playerSprite);

        // Set the flipX property
        playerSprite.setFlipX(flipX);

        // Add player color glow
        playerSprite.preFX?.addGlow(playerColorHex, 3);

        if (this.collisionGroup) {
            this.scene.physics.add.collider(playerSprite, this.collisionGroup);
        }

        this.playerMovementData.set(id, {
            targetX: x,
            targetY: y,
            flipX: flipX,
            lastUpdateTime: this.scene.time.now
        });

        this.updateHealthBar(id, health, isDead)

        // Set initial animation based on dead state
        if (isDead) {
            playerSprite.play(`death_${skin}`);
            this.playerDeadState.set(id, true);
        } else {
            playerSprite.play(`idle_${skin}`);
            this.playerDeadState.set(id, false);
        }

        if (id === this.username) {
            this.scene.cameras.main.startFollow(playerSprite, true, 0.2, 0.2);
        }
    }

    updatePlayer(id: string, playerData: PlayerUpdateData): void {
        const playerSprite = this.playerSprites.get(id);
        if (!playerSprite) return;

        this.updatePlayerMovementData(id, playerData);
        this.updatePlayerVisuals(playerSprite, playerData);
        this.updateHealthBar(id, playerData.health, playerData.isDead);
        this.handlePlayerStateChange(id, playerSprite, playerData);
    }

    private updatePlayerMovementData(id: string, playerData: PlayerUpdateData): void {
        const movementData = this.playerMovementData.get(id);
        if (movementData) {
            movementData.targetX = playerData.x;
            movementData.targetY = playerData.y;
            movementData.lastUpdateTime = this.scene.time.now;
        }
    }

    private updatePlayerVisuals(playerSprite: Phaser.GameObjects.Sprite, playerData: PlayerUpdateData): void {
        playerSprite.setFlipX(playerData.flipX);
        playerSprite.setDepth(playerData.y);
    }

    private handlePlayerStateChange(id: string, playerSprite: Phaser.GameObjects.Sprite, playerData: PlayerUpdateData): void {
        const currentDeadState = this.playerDeadState.get(id) || false;
        
        if (playerData.isDead !== currentDeadState) {
            this.handleDeathStateChange(id, playerSprite, playerData);
        } else if (!playerData.isDead) {
            this.handleAlivePlayerAnimation(id, playerSprite, playerData);
        }
    }

    private handleDeathStateChange(id: string, playerSprite: Phaser.GameObjects.Sprite, playerData: PlayerUpdateData): void {
        this.playerDeadState.set(id, playerData.isDead);
        
        if (playerData.isDead) {
            const skinKey = playerSprite.texture.key;
            playerSprite.play(`death_${skinKey}`, true);
            this.playSound('death_sound', 0.3);
        }
    }

    private handleAlivePlayerAnimation(id: string, playerSprite: Phaser.GameObjects.Sprite, playerData: PlayerUpdateData): void {
        const isHitAnimPlaying = this.playerHitAnimPlaying.get(id) || false;
        
        if (!isHitAnimPlaying) {
            const skinKey = playerSprite.texture.key;
            if (playerData.vx !== 0 || playerData.vy !== 0) {
                playerSprite.play(`walk_${skinKey}`, true);
            } else {
                playerSprite.play(`idle_${skinKey}`, true);
            }
        }
    }

    /**
     * Update only position and movement data for a player, preserving health/death status
     */
    updatePlayerPosition(id: string, positionData: {
        x: number;
        y: number;
        vx: number;
        vy: number;
        flipX: boolean
    }): void {
        const playerSprite = this.playerSprites.get(id);
        const currentDeadState = this.playerDeadState.get(id) || false;

        if (playerSprite && !currentDeadState) { // Only update if player is alive
            // Update the target position
            const movementData = this.playerMovementData.get(id);
            if (movementData) {
                movementData.targetX = positionData.x;
                movementData.targetY = positionData.y;
                movementData.lastUpdateTime = this.scene.time.now;
            }

            playerSprite.setFlipX(positionData.flipX);
            playerSprite.setDepth(positionData.y);

            // Check if hit animation is currently playing
            const isHitAnimPlaying = this.playerHitAnimPlaying.get(id) || false;

            // Only update animations if hit animation is not playing
            if (!isHitAnimPlaying) {
                // Normal animation updates for living players
                const skinKey = playerSprite.texture.key;
                if (positionData.vx !== 0 || positionData.vy !== 0) {
                    playerSprite.play(`walk_${skinKey}`, true);
                } else {
                    playerSprite.play(`idle_${skinKey}`, true);
                }
            }
        }
    }

    removePlayer(id: string): void {
        this.playerSprites.get(id)?.destroy();
        this.playerSprites.delete(id);

        this.playerHealthBarSprites.get(id)?.destroy();
        this.playerHealthBarSprites.delete(id);

        this.playerMovementData.delete(id);
        this.playerDeadState.delete(id);
    }

    /**
     * Damage the local player by the specified amount and send a damage message to the server
     * @param amount Amount to damage
     */
    damagePlayer(amount: number): void {
        // Only damage if the player is not dead
        if (this.isLocalPlayerDead()) {
            return;
        }

        // Send damage message to the server
        this.websocket.sendMessage('damage', {amount});

        // We don't update the health locally here - the server will broadcast the new health
        // and the client will update when it receives the broadcast
    }

    /**
     * Handle a damage event received from the server
     * @param username Username of the player who was damaged
     * @param currentHealth Current health after damage
     * @param died Whether the player died from this damage
     */
    handlePlayerDamage(username: string, currentHealth: number, died: boolean): void {
        const playerSprite = this.playerSprites.get(username);
        if (!playerSprite) return;

        // Update health bar to reflect new health
        this.updateHealthBar(username, currentHealth, died);

        // Flash the player red to indicate damage
        playerSprite.setTint(0xff0000);

        // Alpha flash effect (similar to NPC damage effect)
        this.scene.tweens.add({
            targets: playerSprite,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 2,
            onComplete: () => {
                if (!died) {
                    playerSprite.clearTint();
                }
                playerSprite.setAlpha(1);
            }
        });

        // Set flag that hit animation is playing
        this.playerHitAnimPlaying.set(username, true);

        // Play the hit animation with the skin-specific key
        const skinKey = playerSprite.texture.key;
        const hitAnimKey = `hit_${skinKey}`;
        playerSprite.play(hitAnimKey, true);

        // Add one-time event listener for animation complete
        playerSprite.once(`animationcomplete-${hitAnimKey}`, () => {
            this.playerHitAnimPlaying.set(username, false);
        });

        this.playSound('damage_fx', 0.6);

        // If this is the local player, add screen shake effect and flash red
        if (username === this.username) {
            this.scene.cameras.main.shake(200, 0.0005);
            this.scene.cameras.main.flash(200, 255, 0, 0, true);
        }

        // Handle death state if the player died from this damage
        if (died) {
            const currentDeadState = this.playerDeadState.get(username) || false;

            // Only update if the state is actually changing
            if (!currentDeadState) {
                // Update the player's dead state
                this.playerDeadState.set(username, true);

                // Play death animation with the skin-specific key
                const skinKey = playerSprite.texture.key;
                const deathAnimKey = `death_${skinKey}`;
                playerSprite.play(deathAnimKey, true);
                this.playSound('death_sound', 0.3);

                this.scene.time.delayedCall(1200, () => {
                    playerSprite.clearTint();
                });
            }
        }
    }

    /**
     * Heal the local player by the specified amount and send a heal message to the server
     * @param amount Amount to heal
     */
    healPlayer(amount: number): void {
        // Only heal if the player is not dead
        if (this.isLocalPlayerDead()) {
            return;
        }

        // Send heal message to the server
        this.websocket.sendMessage('heal', {amount});

        // We don't update the health locally here - the server will broadcast the new health
        // and the client will update when it receives the broadcast
    }

    /**
     * Handle a heal event received from the server
     * @param username Username of the player who was healed
     * @param currentHealth Current health after healing
     */
    handlePlayerHeal(username: string, currentHealth: number): void {
        const playerSprite = this.playerSprites.get(username);
        if (!playerSprite) return;

        // Update health bar to reflect new health
        this.updateHealthBar(username, currentHealth, false);
    }

    updatePlayerPositions(): void {
        this.playerMovementData.forEach((movementData, id) => {
            // Skip the local player - its movement is handled by physics now
            if (id === this.username) {
                return;
            }

            const playerSprite = this.playerSprites.get(id);

            if (playerSprite) {
                // Calculate how far to move this frame
                const positionDifferenceX = movementData.targetX - playerSprite.x;
                const positionDifferenceY = movementData.targetY - playerSprite.y;

                // Move player smoothly toward target position
                playerSprite.x += positionDifferenceX * this.movementSmoothingFactor;
                playerSprite.y += positionDifferenceY * this.movementSmoothingFactor;

                // Update depth to match the current y position for proper sprite sorting
                playerSprite.setDepth(playerSprite.y);

                // Update position of health bar and other attachments
                this.updateAttachedElements(id);
            }
        });
    }

    hasPlayer(id: string): boolean {
        return this.playerSprites.has(id);
    }

    /**
     * Get the local player's sprite
     * @returns The local player's Phaser sprite or undefined if not found
     */
    getLocalPlayerSprite(): Phaser.GameObjects.Sprite | undefined {
        return this.playerSprites.get(this.username);
    }

    /**
     * Check if the local player is currently dead
     * @returns True if the local player is dead, false otherwise
     */
    isLocalPlayerDead(): boolean {
        return this.playerDeadState.get(this.username) || false;
    }

    getPlayerCount(): number {
        return this.playerSprites.size;
    }

    getAlivePlayerCount(): number {
        let count = 0;

        for (const [id] of this.playerSprites) {
            const isDead = this.playerDeadState.get(id);
            if (!isDead) {
                count++;
            }
        }

        return count;
    }

    getLocalPlayer(): Phaser.GameObjects.Sprite | undefined {
        return this.playerSprites.get(this.username);
    }

    getPlayerUsernames(): string[] {
        return Array.from(this.playerSprites.keys());
    }

    /**
     * Teleport the local player to a new (x, y) position instantly.
     */
    teleportLocalPlayer(x: number, y: number): void {
        const playerSprite = this.playerSprites.get(this.username);
        if (!playerSprite) return;

        playerSprite.setPosition(x, y);
        // If the sprite has a physics body, update its position as well
        const body = playerSprite.body as Phaser.Physics.Arcade.Body | undefined;
        if (body) {
            body.reset(x, y);
        }
        // Optionally, update the camera follow position
        this.scene.cameras.main.startFollow(playerSprite, true, 0.2, 0.2);
    }

    /**
     * Clean up all player data when transitioning between games
     */
    public cleanup(): void {
        // Remove event listener
        eventBus.off('skinChanged', this.boundHandleSkinChanged);

        // Destroy all player sprites
        this.playerSprites.forEach((sprite) => {
            sprite.destroy();
        });

        // Destroy all health bar sprites
        this.playerHealthBarSprites.forEach((healthBar) => {
            healthBar.destroy();
        });

        // Clear all data maps
        this.playerSprites.clear();
        this.playerMovementData.clear();
        this.playerHealthBarSprites.clear();
        this.playerDeadState.clear();
        this.playerHitAnimPlaying.clear();
    }

    private handleSkinChanged(skinId: string): void {
        // Check if scene is still active
        if (!this.scene || !this.scene.sys || !this.scene.sys.isActive()) {
            return;
        }

        // Update the local player's sprite if it exists
        const playerSprite = this.playerSprites.get(this.username);
        if (playerSprite) {
            this.updatePlayerSkin(this.username, skinId);

            // Broadcast the skin change to other players
            this.websocket.sendMessage('player_skin_changed', {
                username: this.username,
                skin: skinId
            });
        }
    }

    // New helper method to update elements attached to players
    private updateAttachedElements(id: string): void {
        const playerSprite = this.playerSprites.get(id);
        if (!playerSprite) return;

        // Update health bar position
        const healthBarSprite = this.playerHealthBarSprites.get(id);
        if (healthBarSprite) {
            healthBarSprite.x = playerSprite.x;
            healthBarSprite.y = playerSprite.y + this.HEALTH_BAR_OFFSET_Y;
        }
    }

    /**
     * Updates the health bar for a player
     * @param id Player ID
     * @param health Current health value
     * @param isDead Whether the player is dead
     */
    private updateHealthBar(id: string, health: number, isDead: boolean): void {
        // For local player, emit an event to update the React UI
        if (id === this.username) {
            eventBus.emit('updatePlayerHealth', {
                health: health,
                isDead: isDead
            });

            // Ensure death animation plays for local player if health is zero
            const playerSprite = this.playerSprites.get(id);
            if (playerSprite && health <= 0 && !this.playerDeadState.get(id)) {
                this.playerDeadState.set(id, true);
                const skinKey = playerSprite.texture.key;
                const deathAnimKey = `death_${skinKey}`;
                playerSprite.play(deathAnimKey, true);
                this.playSound('death_sound', 0.3)
            }

            return;
        }

        const playerSprite = this.playerSprites.get(id);

        if (playerSprite) {
            // Don't show health bar if player is dead
            if (isDead) {
                // Remove health bar sprite if it exists
                const existingSprite = this.playerHealthBarSprites.get(id);
                if (existingSprite) {
                    existingSprite.setVisible(false);
                }
                return;
            }

            // The sprite sheet has 5 frames (0-4) corresponding to health levels
            const healthFrame = Math.max(0, Math.min(4, health));

            // Create a sprite if it doesn't exist
            if (!this.scene.textures.exists('healthbar')) {
                console.warn('Healthbar texture not loaded');
                return;
            }

            // Get or create the health bar sprite
            let healthBarSprite = this.playerHealthBarSprites.get(id);

            if (!healthBarSprite) {
                // Create a new health bar sprite
                healthBarSprite = this.scene.add.image(
                    playerSprite.x,
                    playerSprite.y + this.HEALTH_BAR_OFFSET_Y,
                    'healthbar',
                    4 - healthFrame // Frames are 0-4, with 0 being full health and 4 being empty
                );
                healthBarSprite.setOrigin(0.5, 0.5);
                healthBarSprite.setDepth(playerSprite.depth + 1);

                // Store the sprite for future updates
                this.playerHealthBarSprites.set(id, healthBarSprite);
            } else {
                const targetX = playerSprite.x;
                const targetY = playerSprite.y + this.HEALTH_BAR_OFFSET_Y;

                // Update the existing sprite
                healthBarSprite.setFrame(4 - healthFrame);
                healthBarSprite.x = Phaser.Math.Linear(healthBarSprite.x, targetX, 0.8);
                healthBarSprite.y = Phaser.Math.Linear(healthBarSprite.y, targetY, 0.8);
                healthBarSprite.setVisible(true);
                healthBarSprite.setDepth(playerSprite.depth + 1);
            }
        }
    }

    private playSound(key: string, volume: number): void {
        if (this.scene.sound?.add) {
            const sound = this.scene.sound.add(key, {volume});
            sound.play();
        }
    }
}
