import Phaser from 'phaser';
import eventBus from '../../../utils/eventBus';
import {getPlayerColorHex} from '../../../utils/getPlayerColor.ts';
import WebSocketService from '../../services/WebSocketService.ts';

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
    private scene: Phaser.Scene;
    private playerSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
    private playerMovementData: Map<string, PlayerMovementData> = new Map();
    private playerHealthBars: Map<string, Phaser.GameObjects.Graphics> = new Map();
    private playerHealthBarSprites: Map<string, Phaser.GameObjects.Image> = new Map();
    private playerDeadState: Map<string, boolean> = new Map();
    private playerHitAnimPlaying: Map<string, boolean> = new Map();
    private movementSmoothingFactor: number = 0.2;
    private username!: string;
    private collisionGroup?: Phaser.Physics.Arcade.StaticGroup;
    private readonly HEALTH_BAR_OFFSET_Y = -20;
    private websocket!: WebSocketService;

    constructor(scene: Phaser.Scene, username: string) {
        this.scene = scene;
        this.username = username;
        this.websocket = WebSocketService.getInstance();
    }

    setCollisionGroup(group: Phaser.Physics.Arcade.StaticGroup): void {
        this.collisionGroup = group;
    }

    createPlayer(id: string, x: number, y: number, flipX: boolean = false, health: number = 4, isDead: boolean = false): void {
        const playerSprite = this.scene.add.sprite(x, y, 'player');
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

        // Create health bar
        const healthBar = this.scene.add.graphics();
        this.playerHealthBars.set(id, healthBar);
        this.updateHealthBar(id, health, isDead);

        // Set initial animation based on dead state
        if (isDead) {
            playerSprite.play('death');
            this.playerDeadState.set(id, true);
        } else {
            playerSprite.play('idle');
            this.playerDeadState.set(id, false);
        }

        if (id === this.username) {
            this.scene.cameras.main.startFollow(playerSprite, true, 0.2, 0.2);
        }

        this.getAlivePlayerCount();
    }

    updatePlayer(id: string, playerData: PlayerUpdateData): void {
        const playerSprite = this.playerSprites.get(id);
        const currentDeadState = this.playerDeadState.get(id) || false;

        if (playerSprite) {
            // Update the target position
            const movementData = this.playerMovementData.get(id);
            if (movementData) {
                movementData.targetX = playerData.x;
                movementData.targetY = playerData.y;
                movementData.lastUpdateTime = this.scene.time.now;
            }

            playerSprite.setFlipX(playerData.flipX);
            playerSprite.setDepth(playerData.y);

            // Update health bar
            this.updateHealthBar(id, playerData.health, playerData.isDead);

            // Handle death state change
            if (playerData.isDead !== currentDeadState) {
                this.playerDeadState.set(id, playerData.isDead);

                if (playerData.isDead) {
                    // Player just died
                    playerSprite.play('death', true);

                    // Play death sound if it's the local player
                    if (this.scene.sound && this.scene.sound.add) {
                        const deathSound = this.scene.sound.add('death_sound', {volume: 0.3});
                        deathSound.play();
                    }
                }
            } else if (!playerData.isDead) {
                // Check if hit animation is currently playing
                const isHitAnimPlaying = this.playerHitAnimPlaying.get(id) || false;

                // Only update animations if hit animation is not playing
                if (!isHitAnimPlaying) {
                    // Normal animation updates for living players
                    if (playerData.vx !== 0 || playerData.vy !== 0) {
                        playerSprite.play('walk', true);
                    } else {
                        playerSprite.play('idle', true);
                    }
                }
            }
        }
    }

    removePlayer(id: string): void {
        if (this.playerSprites.has(id)) {
            this.playerSprites.get(id)!.destroy();
            this.playerSprites.delete(id);
        }

        // Clean up health bar
        if (this.playerHealthBars.has(id)) {
            this.playerHealthBars.get(id)!.destroy();
            this.playerHealthBars.delete(id);
        }

        // Clean up health bar sprite
        if (this.playerHealthBarSprites.has(id)) {
            this.playerHealthBarSprites.get(id)!.destroy();
            this.playerHealthBarSprites.delete(id);
        }

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

        // Set flag that hit animation is playing
        this.playerHitAnimPlaying.set(username, true);

        // Play the hit animation
        playerSprite.play('hit', true);

        // Add one-time event listener for animation complete
        playerSprite.once('animationcomplete-hit', () => {
            this.playerHitAnimPlaying.set(username, false);
        });

        // Play damage sound
        if (this.scene.sound && this.scene.sound.add) {
            const damageSound = this.scene.sound.add('damage_fx', {volume: 0.6});
            damageSound.play();
        }

        // Reset tint after a short delay (only if player didn't die)
        if (!died) {
            this.scene.time.delayedCall(200, () => {
                playerSprite.clearTint();
            });
        }

        // If this is the local player, add screen shake effect and flash red
        if (username === this.username) {
            this.scene.cameras.main.shake(200, 0.0005);
            this.scene.cameras.main.flashEffect.alpha = 0.2;
            this.scene.cameras.main.flash(200, 255, 0, 0, true);
        }

        // Handle death state if the player died from this damage
        if (died) {
            const currentDeadState = this.playerDeadState.get(username) || false;

            // Only update if the state is actually changing
            if (!currentDeadState) {
                // Update the player's dead state
                this.playerDeadState.set(username, true);

                // Play death animation
                playerSprite.play('death', true);

                // Play death sound
                if (this.scene.sound && this.scene.sound.add) {
                    const deathSound = this.scene.sound.add('death_sound', {volume: 0.3});
                    deathSound.play();
                }

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

    /**
     * Heal the local player by the specified amount
     * @param amount Amount to heal (will be added to current health)
     */
    healLocalPlayer(amount: number): void {
        if (this.isLocalPlayerDead()) {
            return; // Can't heal a dead player
        }

        const playerSprite = this.getLocalPlayerSprite();
        if (!playerSprite) return;

        // Get the current health and calculate new health
        const currentHealth = this.getPlayerHealth(this.username);
        const maxHealth = 4;
        const newHealth = Math.min(currentHealth + amount, maxHealth);

        if (newHealth > currentHealth) {
            // Update health display
            this.updateHealthBar(this.username, newHealth, false);

            // Send health update to server if needed
            this.sendHealthUpdate(newHealth);
        }
    }

    /**
     * Damage the local player by the specified amount
     * @param amount Amount of damage to apply (will be subtracted from current health)
     */
    damageLocalPlayer(amount: number): void {
        if (this.isLocalPlayerDead()) {
            return; // Can't damage a dead player
        }

        const playerSprite = this.getLocalPlayerSprite();
        if (!playerSprite) return;

        // Get the current health and calculate new health
        const currentHealth = this.getPlayerHealth(this.username);
        const newHealth = Math.max(currentHealth - amount, 0);
        const died = newHealth <= 0;

        // Apply damage tint (red flash)
        playerSprite.setTint(0xff0000);
        if (!died) {
            this.scene.time.delayedCall(200, () => {
                playerSprite.clearTint();
            });
        }

        // Update health display
        this.updateHealthBar(this.username, newHealth, died);

        // Handle death if health dropped to zero
        if (died && !this.isLocalPlayerDead()) {
            this.playerDeadState.set(this.username, true);
            playerSprite.play('death', true);

            // Play death sound
            if (this.scene.sound && this.scene.sound.add) {
                const deathSound = this.scene.sound.add('death_sound', {volume: 0.3});
                deathSound.play();
            }
        }

        // Send health update to server if needed
        this.sendHealthUpdate(newHealth);
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

    // New helper method to update elements attached to players
    private updateAttachedElements(id: string): void {
        const playerSprite = this.playerSprites.get(id);
        if (!playerSprite) return;

        // Update health bar position
        const healthBar = this.playerHealthBars.get(id);
        if (healthBar) {
            healthBar.x = playerSprite.x;
            healthBar.y = playerSprite.y + this.HEALTH_BAR_OFFSET_Y;
        }

        // Update health bar sprite position
        const healthBarSprite = this.playerHealthBarSprites.get(id);
        if (healthBarSprite) {
            healthBarSprite.x = playerSprite.x;
            healthBarSprite.y = playerSprite.y + this.HEALTH_BAR_OFFSET_Y;
        }
    }

    /**
     * Get the current health of a player
     * @param username Username of the player
     * @returns Current health value (defaults to max health if not found)
     */
    private getPlayerHealth(username: string): number {
        // Here we'd normally get the health from a stored health map
        // For now, we'll estimate it from the health bar width
        const healthBar = this.playerHealthBars.get(username);
        if (!healthBar) return 4; // Default to max health

        // This is a simplification - in a real implementation, you'd store health values directly
        const healthBarData = healthBar.getData('health');
        return healthBarData !== undefined ? healthBarData : 4;
    }

    /**
     * Send a health update to the server for the local player
     * @param health New health value
     */
    private sendHealthUpdate(health: number): void {
        try {
            this.websocket.send(JSON.stringify({
                type: 'player_health_update',
                username: this.username,
                health: health,
                isDead: health <= 0
            }));
        } catch (error) {
            console.error('Failed to send health update to server:', error);
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
                playerSprite.play('death', true);

                // Play death sound
                if (this.scene.sound && this.scene.sound.add) {
                    const deathSound = this.scene.sound.add('death_sound', {volume: 0.3});
                    deathSound.play();
                }
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
}
