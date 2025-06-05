package fhv.omni.gamelogic.service.game;

import fhv.omni.gamelogic.service.game.dtos.PlayerStateDTO;

public class PlayerState {
    private float x;
    private float y;
    private float vx;
    private float vy;
    private boolean flipX;
    private int health;
    private boolean isDead;

    private static final int MAX_HEALTH = 4;

    public PlayerState(float x, float y, float vx, float vy, boolean flipX) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.flipX = flipX;
        this.health = MAX_HEALTH;
        this.isDead = false;
    }

    public boolean takeDamage(int damage) {
        if (isDead) {
            return false;
        }

        health -= damage;

        if (health <= 0) {
            health = 0;
            isDead = true;
            return true;
        }

        return false;
    }

    public boolean heal(int amount) {
        if (isDead) {
            return false;
        }

        int previousHealth = health;

        health += amount;

        if (isDead) {
            isDead = false;
        }

        return health == MAX_HEALTH && previousHealth < MAX_HEALTH;
    }

    public void reset() {
        this.health = MAX_HEALTH;
        this.isDead = false;
        this.vx = 0f;
        this.vy = 0f;
        this.flipX = false;
    }

    public void setPosition(float x, float y) {
        this.x = x;
        this.y = y;
    }

    public float getX() {
        return x;
    }

    public void setX(float x) {
        this.x = x;
    }

    public float getY() {
        return y;
    }

    public void setY(float y) {
        this.y = y;
    }

    public float getVx() {
        return vx;
    }

    public void setVx(float vx) {
        this.vx = vx;
    }

    public float getVy() {
        return vy;
    }

    public void setVy(float vy) {
        this.vy = vy;
    }

    public boolean isFlipX() {
        return flipX;
    }

    public void setFlipX(boolean flipX) {
        this.flipX = flipX;
    }

    public int getHealth() {
        return health;
    }

    public boolean isDead() {
        return isDead;
    }

    public void setDead(boolean dead) {
        isDead = dead;
        if (dead) {
            health = 0;
        }
    }
}
