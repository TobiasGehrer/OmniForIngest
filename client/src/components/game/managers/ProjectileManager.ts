import Phaser from 'phaser';
import {getPlayerColorHex} from '../../../utils/getPlayerColor';
import WebSocketService from '../../services/WebSocketService.ts';

export default class ProjectileManager {
    private readonly scene: Phaser.Scene;
    private projectiles: Phaser.GameObjects.Sprite[] = [];
    private readonly websocket: WebSocketService;
    // Match server speed: 6.3f per update (60fps) = 6.3 * 60 = 378 pixels per second
    private readonly projectileSpeed: number = 378;
    private readonly projectileLifetime: number = 1000;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.websocket = WebSocketService.getInstance();
    }

    /**
     * Creates a projectile at the specified position and direction
     * @param x Starting X position
     * @param y Starting Y position
     * @param directionX X component of direction vector (normalized)
     * @param directionY Y component of direction vector (normalized)
     * @param username Username of the player who fired the projectile
     * @param id Optional unique ID for the projectile
     * @param isNPC Whether this projectile was fired by an NPC
     */
    createProjectile(x: number, y: number, directionX: number, directionY: number, username: string, id?: string, isNPC: boolean = false): void {
        // Create projectile sprite
        const projectile = this.scene.add.sprite(x, y, 'projectile');

        // Set projectile properties
        projectile.setData('directionX', directionX);
        projectile.setData('directionY', directionY);
        projectile.setData('username', username);
        projectile.setData('createdAt', this.scene.time.now);
        projectile.setData('id', id ?? `proj_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`);
        projectile.setData('isNPC', isNPC);

        // Calculate rotation angle based on direction
        const angle = Math.atan2(directionY, directionX);
        projectile.setRotation(angle);

        // Apply different colors for NPC vs player projectiles
        if (isNPC) {
            projectile.setTint(0xff6b35) // Orange tint for NPC projectiles
        } else {
            // Apply player color tint to the projectile
            const playerColor = getPlayerColorHex(username);
            projectile.setTint(playerColor);
        }

        // Add to projectiles array
        this.projectiles.push(projectile);

        projectile.play('projectile_anim');

        // Set depth to be above the ground but below players
        projectile.setDepth(y - 1);
    }

    /**
     * Updates all projectiles (movement and lifetime)
     * @param time Current game time
     */
    updateProjectiles(time: number): void {
        const deltaTime = this.scene.game.loop.delta / 1000; // Convert to seconds

        // Update each projectile
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];

            // Move projectile in its direction
            const directionX = projectile.getData('directionX');
            const directionY = projectile.getData('directionY');

            projectile.x += directionX * this.projectileSpeed * deltaTime;
            projectile.y += directionY * this.projectileSpeed * deltaTime;

            // Update depth based on y position
            projectile.setDepth(projectile.y - 1);

            // Check if projectile has exceeded its lifetime
            const createdAt = projectile.getData('createdAt');
            if (time - createdAt > this.projectileLifetime) {
                // Remove projectile
                projectile.destroy();
                this.projectiles.splice(i, 1);
                continue;
            }

            // Check for NPC collisions if this is a player projectile
            const isNPC = projectile.getData('isNPC');
            if (!isNPC) {
                const wasDestroyed = this.checkNPCCollisions(projectile, i);
                if (wasDestroyed) {
                    // Skip to next iteration if projectile was destroyed
                }
            }
        }
    }

    /**
     * Removes a projectile by its ID
     * @param projectileId The unique ID of the projectile to remove
     */
    removeProjectile(projectileId: string): void {
        const index = this.projectiles.findIndex(p => p.getData('id') === projectileId);
        if (index !== -1) {
            // Destroy the sprite and remove from array
            this.projectiles[index].destroy();
            this.projectiles.splice(index, 1);
        }
    }

    /**
     * Clean up all projectiles when transitioning between games
     */
    public cleanup(): void {
        // Destroy all projectile sprites
        this.projectiles.forEach((projectile) => {
            projectile.destroy();
        });

        // Clear the projectiles array
        this.projectiles = [];
    }

    /**
     * Check if a player projectile hits any NPCs
     * @param projectile The projectile to check
     * @param projectileIndex Index of the projectile in the array
     * @returns true if projectile was destroyed due to collision
     */
    private checkNPCCollisions(projectile: Phaser.GameObjects.Sprite, projectileIndex: number): boolean {
        // Get NPCManager from scene if available
        const npcManager = (this.scene as any).npcManager;
        if (!npcManager) {
            return false;
        }

        const allNPCs = npcManager.getAllNPCs();

        for (const npc of allNPCs) {
            if (npc.isNPCDead()) {
                continue;
            }

            const distance = Phaser.Math.Distance.Between(
                projectile.x, projectile.y,
                npc.x, npc.y
            );

            if (distance <= 15) { // Hit radius
                const projectileOwner = projectile.getData('username');
                const currentUsername = this.websocket.getUsername();

                // Only send damage message if this client owns the projectile
                if (projectileOwner === currentUsername) {
                    this.websocket.sendMessage('npc_damage', {
                        npcId: npc.getNPCId(),
                        damage: 1
                    });
                }

                // Remove the projectile
                projectile.destroy();
                this.projectiles.splice(projectileIndex, 1);

                // Visual feedback
                this.createHitEffect(npc.x, npc.y);

                return true;
            }
        }
        return false;
    }

    /**
     * Creates a hit effect at the specified location
     * @param x X position
     * @param y Y position
     */
    private createHitEffect(x: number, y: number): void {
        // Create a simple hit particle effect
        const hitEffect = this.scene.add.circle(x, y, 8, 0xffff00, 0.8);
        hitEffect.setDepth(999);

        // Animate the hit effect
        this.scene.tweens.add({
            targets: hitEffect,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 200,
            ease: 'Power2.easeOut',
            onComplete: () => {
                hitEffect.destroy();
            }
        });

        // Play hit sound
        if (this.scene.sound?.add) {
            const hitSound = this.scene.sound.add('damage_fx', {volume: 0.3});
            hitSound.play();
        }
    }
}
