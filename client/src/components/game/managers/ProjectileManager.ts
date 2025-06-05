import Phaser from 'phaser';
import {getPlayerColorHex} from '../../../utils/getPlayerColor';

export default class ProjectileManager {
    private scene: Phaser.Scene;
    private projectiles: Phaser.GameObjects.Sprite[] = [];
    private readonly projectileSpeed: number = 400;
    private readonly projectileLifetime: number = 1000;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    /**
     * Creates a projectile at the specified position and direction
     * @param x Starting X position
     * @param y Starting Y position
     * @param directionX X component of direction vector (normalized)
     * @param directionY Y component of direction vector (normalized)
     * @param username Username of the player who fired the projectile
     * @param id Optional unique ID for the projectile
     */
    createProjectile(x: number, y: number, directionX: number, directionY: number, username: string, id?: string): void {
        // Create projectile sprite
        const projectile = this.scene.add.sprite(x, y, 'projectile');

        // Set projectile properties
        projectile.setData('directionX', directionX);
        projectile.setData('directionY', directionY);
        projectile.setData('username', username);
        projectile.setData('createdAt', this.scene.time.now);
        projectile.setData('id', id || `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

        // Calculate rotation angle based on direction
        const angle = Math.atan2(directionY, directionX);
        projectile.setRotation(angle);

        // Apply player color tint to the projectile
        const playerColor = getPlayerColorHex(username);
        projectile.setTint(playerColor);

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
}
