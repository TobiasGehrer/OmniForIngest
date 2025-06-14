import Phaser from 'phaser';
import menuMusicAsset from '../../../../public/assets/audio/music/menu_music.mp3';
import notificationFx from '../../../../public/assets/audio/fx/notification.mp3';
import {getApiBaseUrl, getShopBaseUrl} from '../../../utils/apiBaseUrl';
import AnimationManager from '../managers/AnimationManager';

export default class MenuLoadingScene extends Phaser.Scene {
    private tipsText: Phaser.GameObjects.Text | undefined;
    private continueButton: Phaser.GameObjects.Text | undefined;
    private loadingComplete: boolean = false;
    private enterKey: Phaser.Input.Keyboard.Key | undefined;
    private progressBar: Phaser.GameObjects.Graphics | undefined;
    private progressBg: Phaser.GameObjects.Graphics | undefined;
    private loadingDots: Phaser.GameObjects.Text | undefined;
    private floatingParticles: Phaser.GameObjects.Group | undefined;
    private fetchingUserData: boolean = false;

    constructor() {
        super('LoadingScene');
    }

    preload() {
        // Load ONLY the background first
        this.load.image('loading_bg', 'images/backgrounds/loading_bg.png');

        // Wait for just the background to load
        this.load.on('filecomplete-image-loading_bg', () => {
            this.createCozyBackground();
            this.createFloatingParticles();
            this.createTitle();
            this.createLoadingBar();
            this.createTipsSection();
        });

        this.loadGameAssets();
    }

    create() {
        // Set up the enter key for navigation
        this.enterKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

        if (this.loadingComplete) {
            this.showContinueButton();
        }
    }

    update() {
        // Check for Enter key press when loading is complete
        if (this.loadingComplete && this.enterKey?.isDown) {
            this.continueToNextScene();
        }
    }

    private createCozyBackground() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Option 1: Use a static background image
        const background = this.add.image(width / 2, height / 2, 'loading_bg');
        background.setDisplaySize(width, height); // Scale to fit screen
        background.setOrigin(0.5, 0.5);

        // Optional: Add subtle overlay for better text readability
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.2); // Adjust opacity as needed
        overlay.fillRect(0, 0, width, height);
    }

    private createFloatingParticles() {
        this.floatingParticles = this.add.group();
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Create subtle floating particles
        for (let i = 0; i < 20; i++) {
            const particle = this.add.circle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height),
                Phaser.Math.Between(1, 3),
                0xffffff,
                0.1
            );

            this.floatingParticles.add(particle);

            // Animate particles
            this.tweens.add({
                targets: particle,
                y: particle.y - Phaser.Math.Between(50, 150),
                alpha: {
                    from: 0.1,
                    to: 0.5
                },
                duration: Phaser.Math.Between(8000, 15000),
                repeat: -1,
                yoyo: true,
                ease: 'Sine.easeInOut'
            });

            this.tweens.add({
                targets: particle,
                x: particle.x + Phaser.Math.Between(-30, 30),
                duration: Phaser.Math.Between(6000, 12000),
                repeat: -1,
                yoyo: true,
                ease: 'Sine.easeInOut'
            });
        }
    }

    private createTitle() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Main title
        const titleText = this.add.text(width / 2, height / 4, 'omni', {
            font: 'bold 96px gameovercre',
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 8,
        });
        titleText.setOrigin(0.5, 0.5);

        // Title entrance animation
        titleText.setScale(0);
        this.tweens.add({
            targets: titleText,
            scaleX: 1,
            scaleY: 1,
            duration: 1500,
            ease: 'Back.easeOut'
        });

        // Subtle floating animation
        this.tweens.add({
            targets: titleText,
            y: titleText.y - 5,
            duration: 2000,
            repeat: -1,
            yoyo: true,
            ease: 'Sine.easeInOut'
        });
    }

    private createLoadingBar() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Modern rounded progress bar background
        this.progressBg = this.add.graphics();
        this.progressBg.fillStyle(0x000000, 0.3);
        this.progressBg.fillRoundedRect(width / 2 - 200, height / 2 + 100, 400, 16, 8);

        // Inner shadow effect
        const innerShadow = this.add.graphics();
        innerShadow.fillStyle(0x000000, 0.2);
        innerShadow.fillRoundedRect(width / 2 - 198, height / 2 + 102, 396, 12, 6);

        this.progressBar = this.add.graphics();

        // Loading dots animation
        this.loadingDots = this.add.text(width / 2, height / 2 + 55, 'Loading', {
            font: '24px gameovercre',
            color: '#ffffff',
            align: 'center'
        });
        this.loadingDots.setOrigin(0.5, 0.5);

        // Animate loading dots
        let dotCount = 0;
        this.time.addEvent({
            delay: 500,
            callback: () => {
                dotCount = (dotCount + 1) % 4;
                const dots = '.'.repeat(dotCount);
                this.loadingDots?.setText(`Loading${dots}`);
            },
            loop: true
        });

        this.load.on('progress', (value: number) => {
            this.updateProgressBar(value);
        });
    }

    private updateProgressBar(progress: number) {
        if (!this.progressBar) return;

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.progressBar.clear();
        const progressWidth = 396 * progress;

        if (progressWidth > 0) {
            this.progressBar.fillStyle(0x63ab3f);
            this.progressBar.fillRoundedRect(width / 2 - 198, height / 2 + 102, progressWidth, 12, 6);
            this.progressBar.lineStyle(2, 0x000000, 0.9);
            this.progressBar.strokeRoundedRect(width / 2 - 198, height / 2 + 102, progressWidth, 12, 6);
        }
    }

    private createTipsSection() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Cozy, encouraging tips
        const tips = [
            '💡 Do not ignore software architecture assignments until 2 days before the due date',
            '💡 Never trust a professor who says “this won’t be on the exam”',
            '💡 Skip lectures',
            '💡 Group projects build character — the character of someone who does everything alone at 3am',
            '💡 Tung tung tung sahur'
        ];

        // Tips container with subtle background
        const tipsContainer = this.add.graphics();
        tipsContainer.fillStyle(0x000000, 0.2);
        tipsContainer.fillRoundedRect(width / 2 - 300, height - 200, 600, 60, 12);

        this.tipsText = this.add.text(width / 2, height - 170, tips[0], {
            font: '20px gameovercre',
            color: '#ffffff',
            align: 'center',
            wordWrap: {
                width: 550,
                useAdvancedWrap: true
            }
        });
        this.tipsText.setOrigin(0.5, 0.5);
        this.tipsText.setAlpha(0);

        // Animate first tip in
        this.tweens.add({
            targets: this.tipsText,
            alpha: 1,
            duration: 1000,
            ease: 'Power2'
        });

        // Cycle through tips with smooth transitions
        let tipIndex = 0;
        this.time.addEvent({
            delay: 4000,
            callback: () => {
                if (!this.tipsText) return;

                // Fade out current tip
                this.tweens.add({
                    targets: this.tipsText,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        tipIndex = (tipIndex + 1) % tips.length;
                        if (this.tipsText) {
                            this.tipsText.setText(tips[tipIndex]);

                            // Fade in new tip
                            this.tweens.add({
                                targets: this.tipsText,
                                alpha: 1,
                                duration: 500
                            });
                        }
                    }
                });
            },
            loop: true
        });

        this.load.on('complete', () => {
            this.loadingComplete = true;
            this.fetchUserDataAndSkin();
        });
    }

    private loadGameAssets() {
        // Load assets for next scene
        this.load.image('tiles', 'assets/tiles/base.png');
        this.load.tilemapTiledJSON('menu', 'assets/tiles/menu.json');
        this.load.audio('menu_music', menuMusicAsset);
        this.load.audio('notification_sound', notificationFx);
        // Load all player skin sprites
        for (let i = 0; i <= 25; i++) {
            this.load.spritesheet(`player_${i}`, `assets/sprites/characters/player_${i}.png`, {
                frameWidth: 24,
                frameHeight: 24,
            });
        }
        this.load.spritesheet('shopkeeper', 'assets/sprites/characters/shopkeeper.png', {
            frameWidth: 24,
            frameHeight: 24,
        });
        this.load.spritesheet('tree_0', 'assets/sprites/environment/tree_0.png', {
            frameWidth: 16,
            frameHeight: 27,
        });
        this.load.spritesheet('tree_1', 'assets/sprites/environment/tree_1.png', {
            frameWidth: 22,
            frameHeight: 42,
        });
        this.load.spritesheet('tree_2', 'assets/sprites/environment/tree_2.png', {
            frameWidth: 22,
            frameHeight: 54,
        });
        this.load.spritesheet('tree_3', 'assets/sprites/environment/tree_3.png', {
            frameWidth: 30,
            frameHeight: 43,
        });
        this.load.spritesheet('tree_4', 'assets/sprites/environment/tree_4.png', {
            frameWidth: 42,
            frameHeight: 43,
        });
        this.load.spritesheet('tree_5', 'assets/sprites/environment/tree_5.png', {
            frameWidth: 42,
            frameHeight: 43,
        });
        this.load.spritesheet('tree_dark_0', 'assets/sprites/environment/tree_dark_0.png', {
            frameWidth: 16,
            frameHeight: 27,
        });
        this.load.spritesheet('tree_dark_1', 'assets/sprites/environment/tree_dark_1.png', {
            frameWidth: 22,
            frameHeight: 42,
        });
        this.load.spritesheet('tree_dark_2', 'assets/sprites/environment/tree_dark_2.png', {
            frameWidth: 22,
            frameHeight: 54,
        });
        this.load.spritesheet('tree_dark_3', 'assets/sprites/environment/tree_dark_3.png', {
            frameWidth: 30,
            frameHeight: 43,
        });
        this.load.spritesheet('tree_dark_4', 'assets/sprites/environment/tree_dark_4.png', {
            frameWidth: 42,
            frameHeight: 43,
        });
        this.load.spritesheet('tree_dark_5', 'assets/sprites/environment/tree_dark_5.png', {
            frameWidth: 42,
            frameHeight: 43,
        });
        this.load.spritesheet('fountain', 'assets/sprites/environment/fountain.png', {
            frameWidth: 48,
            frameHeight: 60,
        });
        this.load.spritesheet('sign_big_light_wood_front', 'assets/sprites/environment/sign_big_light_wood_front.png', {
            frameWidth: 54,
            frameHeight: 46,
        });
        this.load.spritesheet('lantern_light_true', 'assets/sprites/environment/lantern_light_true.png', {
            frameWidth: 12,
            frameHeight: 45,
        });
        this.load.spritesheet('projectile', 'assets/sprites/fx/projectile.png', {
            frameWidth: 32,
            frameHeight: 20,
            startFrame: 228,
            endFrame: 231
        });
    }

    private showContinueButton() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Hide loading dots
        if (this.loadingDots) {
            this.tweens.add({
                targets: this.loadingDots,
                alpha: 0,
                duration: 500
            });
        }

        const continueContainer = this.add.graphics();
        continueContainer.fillStyle(0x000000, 0.2);
        continueContainer.fillRoundedRect(width / 2 - 150, height / 2 + 25, 300, 60, 12);

        this.continueButton = this.add.text(width / 2, height / 2 + 65, '✨ Continue ✨', {
            font: '24px gameovercre',
            color: '#ffffff',
            align: 'center'
        });
        this.continueButton.setOrigin(0.5, 0.5);
        this.continueButton.setAlpha(0);

        // Animate button in
        this.tweens.add({
            targets: this.continueButton,
            alpha: 1,
            y: this.continueButton.y - 10,
            duration: 1000,
            ease: 'Back.easeOut'
        });

        // Set up interactivity
        const buttonArea = this.add.rectangle(width / 2, height / 2 + 55, 300, 60, 0x000000, 0);
        buttonArea.setInteractive();

        buttonArea
            .on('pointerover', () => {
                this.tweens.add({
                    targets: this.continueButton,
                    scaleX: 1.05,
                    scaleY: 1.05,
                    duration: 200,
                    ease: 'Power2'
                });
            })
            .on('pointerout', () => {
                this.tweens.add({
                    targets: this.continueButton,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 200,
                    ease: 'Power2'
                });
            })
            .on('pointerdown', () => {
                this.continueToNextScene();
            });

        // Add instruction text
        const instructionText = this.add.text(width / 2, height / 2 + 140, 'Press ENTER or click to continue', {
            font: '16px gameovercre',
            color: '#ffffff',
            align: 'center'
        });
        instructionText.setOrigin(0.5, 0.5);
        instructionText.setAlpha(0.6);
    }

    private continueToNextScene() {
        // Add a smooth transition effect
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const fadeOut = this.add.graphics();
        fadeOut.fillStyle(0x000000, 0);
        fadeOut.fillRect(0, 0, width, height);

        this.tweens.add({
            targets: fadeOut,
            alpha: 1,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => {
                this.scene.start('MenuScene');
            }
        });
    }

    private async fetchUserDataAndSkin() {
        if (this.fetchingUserData) return;
        this.fetchingUserData = true;

        try {
            // First get the username
            const username = await this.getCurrentUsername();

            // Then fetch the selected skin
            if (username && username !== 'Unknown') {
                await this.fetchSelectedSkin(username);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        } finally {
            this.fetchingUserData = false;
            this.showContinueButton();
        }
    }

    private async getCurrentUsername(): Promise<string> {
        // First check if username is in the game registry
        const usernameFromRegistry = this.registry.get('username');
        if (usernameFromRegistry) {
            return usernameFromRegistry;
        }

        try {
            const response = await fetch(`${getApiBaseUrl()}/me`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
            });

            if (response.ok) {
                const data = await response.json();
                const username = data.username ?? 'Unknown';
                // Store username in registry for future use
                this.registry.set('username', username);
                return username;
            }
        } catch (error) {
            console.error('Error fetching username:', error);
        }

        return 'Unknown';
    }

    private async fetchSelectedSkin(username: string): Promise<void> {
        try {
            const response = await fetch(`${getShopBaseUrl()}/api/shop/preferences/${username}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                const selectedSkin = data.selectedSkin;

                // Store the selected skin in the registry
                this.registry.set('selectedSkin', selectedSkin);

                // Create animations for the skin
                const animManager = new AnimationManager(this);
                animManager.createAnimations(selectedSkin);
            }
        } catch (error) {
            console.error('Error fetching selected skin:', error);
        }
    }
}
