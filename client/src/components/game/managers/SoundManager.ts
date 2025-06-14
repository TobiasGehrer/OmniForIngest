import Phaser from 'phaser';
import eventBus from '../../../utils/eventBus';

export default class SoundManager {
    private static instance: SoundManager | null = null;
    private scene: Phaser.Scene | null = null;
    private backgroundMusic?: Phaser.Sound.NoAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.WebAudioSound;
    private lowPassFilter?: BiquadFilterNode;
    private gainNode?: GainNode;
    private webAudioManager?: Phaser.Sound.WebAudioSoundManager;
    private initialVolume: number = 0.2;

    private constructor() {
        // Set up event listeners for escape menu
        eventBus.on('escapeMenuOpen', this.handleEscapeMenuOpen);
        eventBus.on('escapeMenuClose', this.handleEscapeMenuClose);

        // Set up event listener for notification sound
        eventBus.on('playNotificationSound', this.playNotificationSound);

        // Set up event listener for stopping background music
        eventBus.on('stopBackgroundMusic', this.stopBackgroundMusic.bind(this));
    }

    /**
     * Get the singleton instance of SoundManager
     * @param scene Optional Phaser.Scene to set or update the scene
     * @returns The singleton instance of SoundManager
     */
    public static getInstance(scene?: Phaser.Scene): SoundManager {
        SoundManager.instance ??= new SoundManager();

        // Update the scene if provided
        if (scene) {
            SoundManager.instance.setScene(scene);
        }

        return SoundManager.instance;
    }

    /**
     * Set or update the scene for the SoundManager
     * @param scene The Phaser.Scene to use
     */
    public setScene(scene: Phaser.Scene): void {
        this.scene = scene;
    }

    playBackgroundMusic(key: string, config: Phaser.Types.Sound.SoundConfig = {}, applyFilter: boolean = false): void {
        if (!this.scene) {
            console.warn('Cannot play background music: no scene set');
            return;
        }

        this.stopExistingMusic();
        this.createBackgroundMusic(key, config);
        this.setupWebAudio(applyFilter);
    }

    private stopExistingMusic(): void {
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
            this.cleanupAudioNodes();
        }
    }

    private cleanupAudioNodes(): void {
        if (this.lowPassFilter && this.webAudioManager) {
            try {
                this.lowPassFilter.disconnect();
            } catch (error) {
                console.warn('Failed to disconnect lowpass filter:', error);
            }
            this.lowPassFilter = undefined;
        }

        if (this.gainNode && this.webAudioManager) {
            try {
                this.gainNode.disconnect();
            } catch (error) {
                console.warn('Failed to disconnect gain node:', error);
            }
            this.gainNode = undefined;
        }
    }

    private createBackgroundMusic(key: string, config: Phaser.Types.Sound.SoundConfig): void {
        this.initialVolume = config.volume ?? 0.2;

        this.backgroundMusic = this.scene!.sound.add(key, {
            loop: true,
            volume: this.initialVolume,
            ...config
        });

        this.backgroundMusic.play();
    }

    private setupWebAudio(applyFilter: boolean): void {
        if (this.backgroundMusic instanceof Phaser.Sound.WebAudioSound) {
            this.webAudioManager = this.scene!.sound as Phaser.Sound.WebAudioSoundManager;
            this.setupWebAudioNodes(applyFilter);
        } else if (applyFilter) {
            this.applyLowPassFilter();
        }
    }

    private setupWebAudioNodes(applyFilter: boolean): void {
        const webAudioSound = this.backgroundMusic as Phaser.Sound.WebAudioSound;
        if (this.webAudioManager!.context && webAudioSound.source) {
            try {
                this.createGainNode();
                this.connectAudioNodes();
                
                if (applyFilter) {
                    this.applyLowPassFilter();
                }
            } catch (error) {
                this.handleWebAudioError(error);
            }
        } else if (applyFilter) {
            this.applyLowPassFilter();
        }
    }

    private createGainNode(): void {
        this.gainNode = this.webAudioManager!.context.createGain();
        this.gainNode.gain.value = this.backgroundMusic!.volume;
    }

    private connectAudioNodes(): void {
        const webAudioSound = this.backgroundMusic as Phaser.Sound.WebAudioSound;
        webAudioSound.source.disconnect();
        webAudioSound.source.connect(this.gainNode!);
        this.gainNode!.connect(this.webAudioManager!.destination);
    }

    private handleWebAudioError(error: any): void {
        console.warn('Failed to set up audio nodes:', error);
        const webAudioSound = this.backgroundMusic as Phaser.Sound.WebAudioSound;
        if (webAudioSound.source) {
            webAudioSound.source.connect(this.webAudioManager!.destination);
        }
    }

    private setupLowPassFilter(frequency: number, q: number): void {
        this.webAudioManager = this.scene!.sound as Phaser.Sound.WebAudioSoundManager;

        if (this.webAudioManager.context) {
            try {
                this.createLowPassFilter(frequency, q);
                this.connectFilterToAudioGraph();
            } catch (error) {
                console.warn('Failed to apply lowpass filter:', error);
            }
        }
    }

    private createLowPassFilter(frequency: number, q: number): void {
        this.lowPassFilter = this.webAudioManager!.context.createBiquadFilter();
        this.lowPassFilter.type = 'lowpass';
        this.lowPassFilter.frequency.value = frequency;
        this.lowPassFilter.Q.value = q;
    }

    private connectFilterToAudioGraph(): void {
        const webAudioSound = this.backgroundMusic as Phaser.Sound.WebAudioSound;
        if (webAudioSound.source) {
            webAudioSound.source.disconnect();
            
            if (this.gainNode) {
                this.connectWithGainNode();
            } else {
                this.connectWithoutGainNode();
            }
        } else {
            console.warn('Audio source not available, playing without filter');
        }
    }

    private connectWithGainNode(): void {
        const webAudioSound = this.backgroundMusic as Phaser.Sound.WebAudioSound;
        this.gainNode!.disconnect();
        webAudioSound.source.connect(this.gainNode!);
        this.gainNode!.connect(this.lowPassFilter!);
        this.lowPassFilter!.connect(this.webAudioManager!.destination);
    }

    private connectWithoutGainNode(): void {
        const webAudioSound = this.backgroundMusic as Phaser.Sound.WebAudioSound;
        webAudioSound.source.connect(this.lowPassFilter!);
        this.lowPassFilter!.connect(this.webAudioManager!.destination);
    }

    stopBackgroundMusic(): void {
        this.fadeOutBackgroundMusic(1000);
    }

    fadeOutBackgroundMusic(duration: number = 1000): void {
        if (this.backgroundMusic) {
            if (this.gainNode) {
                // If we have a gain node, use it to fade out
                this.tweenGain(0, duration);

                // Stop the music after the fade out is complete
                if (this.scene) {
                    this.scene.time.delayedCall(duration, () => {
                        if (this.backgroundMusic) {
                            this.backgroundMusic.stop();
                        }
                    });
                }
            } else {
                // If no gain node, just stop immediately
                this.backgroundMusic.stop();
            }
        }
    }

    setVolume(volume: number): void {
        if (this.backgroundMusic) {
            this.backgroundMusic.setVolume(volume);

            // Also update gain node if it exists
            if (this.gainNode) {
                this.gainNode.gain.value = volume;
            }
        }
    }

    setGain(gainValue: number): void {
        if (this.gainNode) {
            this.gainNode.gain.value = gainValue;
        } else if (this.backgroundMusic) {
            this.backgroundMusic.setVolume(gainValue);
        } else {
            console.warn('Could not set gain: no gainNode or backgroundMusic available');
        }
    }

    fadeGain(targetGain: number, duration: number = 1000): void {
        if (this.gainNode && this.webAudioManager?.context) {
            try {
                const currentTime = this.webAudioManager.context.currentTime;
                this.gainNode.gain.cancelScheduledValues(currentTime);
                this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, currentTime);
                this.gainNode.gain.linearRampToValueAtTime(targetGain, currentTime + (duration / 1000));
            } catch (error) {
                console.warn('Failed to fade gain:', error);
                // Fallback to immediate change
                this.gainNode.gain.value = targetGain;
            }
        }
    }

    tweenGain(targetGain: number, duration: number = 1000): void {
        if (!this.scene) {
            console.warn('Cannot tween gain: no scene set');
            return;
        }

        if (this.gainNode) {
            try {
                this.scene.tweens.add({
                    targets: {gain: this.gainNode.gain.value},
                    gain: targetGain,
                    duration: duration,
                    ease: 'Sine.easeInOut',
                    onUpdate: (_tween, target) => {
                        if (this.gainNode) {
                            this.gainNode.gain.value = target.gain;
                        }
                    }
                });
            } catch (error) {
                console.warn('Failed to tween gain:', error);
                // Fallback to immediate change
                this.gainNode.gain.value = targetGain;
            }
        }
    }

    applyLowPassFilter(frequency: number = 2000, q: number = 1): void {
        if (!this.scene) {
            console.warn('Cannot apply low pass filter: no scene set');
            return;
        }

        if (this.backgroundMusic instanceof Phaser.Sound.WebAudioSound) {
            this.setupLowPassFilter(frequency, q);
        }
    }

    setFilterFrequency(frequency: number, duration: number = 500): void {
        if (!this.scene) {
            console.warn('Cannot set filter frequency: no scene set');
            return;
        }

        if (this.lowPassFilter) {
            try {
                this.scene.tweens.add({
                    targets: this.lowPassFilter.frequency,
                    value: frequency,
                    duration: duration,
                    ease: 'Sine.easeInOut'
                });
            } catch (error) {
                console.warn('Failed to adjust lowpass filter:', error);
            }
        }
    }

    destroy(): void {
        // Remove event listeners when manager is destroyed
        eventBus.off('escapeMenuOpen', this.handleEscapeMenuOpen);
        eventBus.off('escapeMenuClose', this.handleEscapeMenuClose);
        eventBus.off('playNotificationSound', this.playNotificationSound);
        eventBus.off('stopBackgroundMusic', this.stopBackgroundMusic.bind(this));

        // Stop background music
        this.stopBackgroundMusic();

        // Disconnect the filter if it exists
        if (this.lowPassFilter && this.webAudioManager) {
            try {
                this.lowPassFilter.disconnect();
            } catch (error) {
                console.warn('Failed to disconnect lowpass filter:', error);
            }
        }

        // Disconnect the gain node if it exists
        if (this.gainNode && this.webAudioManager) {
            try {
                this.gainNode.disconnect();
            } catch (error) {
                console.warn('Failed to disconnect gain node:', error);
            }
        }
    }

    private readonly handleEscapeMenuOpen = () => {
        if (this.scene) {
            this.setFilterFrequency(300);
        }
    };

    private readonly handleEscapeMenuClose = () => {
        if (this.scene) {
            this.setFilterFrequency(2000);
        }
    };

    private readonly playNotificationSound = () => {
        if (!this.scene) {
            console.warn('Cannot play notification sound: no scene set');
            return;
        }

        if (this.scene.sound?.add) {
            try {
                const notificationSound = this.scene.sound.add('notification_sound', {
                    volume: 0.5
                });
                notificationSound.play();
            } catch (error) {
                console.warn('Failed to play notification sound:', error);
            }
        }
    };
}
