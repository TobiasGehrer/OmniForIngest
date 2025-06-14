import Phaser from 'phaser';
import NPC from '../entities/NPC';

export default class NPCManager {
    private readonly scene: Phaser.Scene;
    private readonly npcs: Map<string, NPC> = new Map();
    private collisionGroup?: Phaser.Physics.Arcade.StaticGroup;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    public setCollisionGroup(group: Phaser.Physics.Arcade.StaticGroup): void {
        this.collisionGroup = group;
    }

    public spawnNPC(data: {
        id: string;
        x: number;
        y: number;
        health: number;
        maxHealth: number;
    }): void {
        if (this.npcs.has(data.id)) {
            console.warn(`NPC ${data.id} already exists`);
            return;
        }

        const npc = NPC.createCombatNPC(this.scene, data.x, data.y, data.id);
        this.npcs.set(data.id, npc);

        // Set up collision with world bounds and static objects
        if (this.collisionGroup) {
            this.scene.physics.add.collider(npc, this.collisionGroup);
        }

        console.log(`Spawned NPC ${data.id} at (${data.x}, ${data.y})`);
    }

    public updateNPCs(data: {
        npcs: Record<string, any>
    }): void {
        Object.entries(data.npcs).forEach(([npcId, npcData]) => {
            const npc = this.npcs.get(npcId);
            if (npc) {
                npc.updateNPC(npcData);
            } else {
                console.warn(`Received update for unknown NPC: ${npcId}`);
            }
        });
    }

    public damageNPC(data: {
        id: string;
        health: number;
        died: boolean
    }): void {
        const npc = this.npcs.get(data.id);
        if (npc) {
            npc.takeDamage();

            if (data.died) {
                console.log(`NPC ${data.id} was destroyed!`);
                // Play destruction sound effect
                if (this.scene.sound?.add) {
                    const destroySound = this.scene.sound.add('death_sound', {volume: 0.4});
                    destroySound.play();
                }
            }
        }
    }

    public removeNPC(npcId: string): void {
        const npc = this.npcs.get(npcId);
        if (npc) {
            npc.destroy();
            this.npcs.delete(npcId);
            console.log(`Removed NPC ${npcId}`);
        }
    }

    public checkProjectileCollisions(projectiles: any[]): string | null {
        for (const [npcId, npc] of this.npcs) {
            if (npc.isNPCDead()) {
                continue;
            }

            for (const projectile of projectiles) {
                // Check if projectile is from a player (not from NPC)
                const projectileOwnerId = projectile.getData('username');
                if (projectileOwnerId && !projectileOwnerId.startsWith('npc_')) {
                    const distance = Phaser.Math.Distance.Between(
                        projectile.x, projectile.y,
                        npc.x, npc.y
                    );

                    if (distance <= 15) { // Hit radius
                        console.log(`Projectile from ${projectileOwnerId} hit NPC ${npcId}`);
                        return npcId;
                    }
                }
            }
        }
        return null;
    }

    public getNPC(npcId: string): NPC | undefined {
        return this.npcs.get(npcId);
    }

    public getAllNPCs(): NPC[] {
        return Array.from(this.npcs.values());
    }

    public hasNPCs(): boolean {
        return this.npcs.size > 0;
    }

    public getNPCCount(): number {
        return this.npcs.size;
    }

    public getAliveNPCCount(): number {
        return Array.from(this.npcs.values()).filter(npc => !npc.isNPCDead()).length;
    }

    public cleanup(): void {
        // Destroy all NPCs
        this.npcs.forEach(npc => npc.destroy());
        this.npcs.clear();
    }
}
