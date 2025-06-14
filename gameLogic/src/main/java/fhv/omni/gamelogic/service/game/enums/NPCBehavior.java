package fhv.omni.gamelogic.service.game.enums;

public enum NPCBehavior {
    IDLE,       // Standing still, scanning for targets
    PATROL,     // Moving randomly or in patterns
    CHASE,      // Pursuing a target
    ATTACK,     // Attacking a target
    RETREAT     // Moving away from threats
}
