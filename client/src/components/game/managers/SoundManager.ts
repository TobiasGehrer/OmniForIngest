import Phaser from 'phaser';
import eventBus from '../../../utils/eventBus';

export default class SoundManager {
    private scene: Phaser.Scene;
    private backgroundMusic?: Phaser.Sound.NoAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.WebAudioSound;
    private lowPassFilter?: BiquadFilterNode;
    private gainNode?: GainNode;
    private webAudioManager?: Phaser.Sound.WebAudioSoundManager;
    private initialVolume: number = 0.2;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;

        // Set up event listeners for escape menu
        eventBus.on('escapeMenuOpen', this.handleEscapeMenuOpen);
        eventBus.on('escapeMenuClose', this.handleEscapeMenuClose);

        // Set up event listener for notification sound
        eventBus.on('playNotificationSound', this.playNotificationSound);
    }

    playBackgroundMusic(key: string, config: Phaser.Types.Sound.SoundConfig = {}, applyFilter: boolean = false): void {
        // Stop any existing music first
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();

            // Clean up existing audio nodes
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

        // Store the volume from config or use default
        this.initialVolume = config.volume !== undefined ? config.volume : 0.2;

        this.backgroundMusic = this.scene.sound.add(key, {
            loop: true,
            volume: this.initialVolume,
            ...config
        });

        // Play the music first to initialize the audio source
        this.backgroundMusic.play();

        // Initialize Web Audio API components if using WebAudio
        if (this.backgroundMusic instanceof Phaser.Sound.WebAudioSound) {
            this.webAudioManager = this.scene.sound as Phaser.Sound.WebAudioSoundManager;

            if (this.webAudioManager.context && this.backgroundMusic.source) {
                try {
                    // Create a gain node for volume control
                    this.gainNode = this.webAudioManager.context.createGain();
                    this.gainNode.gain.value = this.backgroundMusic.volume;

                    // Disconnect the default connection
                    this.backgroundMusic.source.disconnect();

                    // Connect source -> gain node -> destination (or filter if applied later)
                    this.backgroundMusic.source.connect(this.gainNode);
                    this.gainNode.connect(this.webAudioManager.destination);

                    // Apply lowpass filter if requested
                    if (applyFilter) {
                        this.applyLowPassFilter();
                    }
                } catch (error) {
                    console.warn('Failed to set up audio nodes:', error);
                    // Fallback to default connection
                    if (this.backgroundMusic.source) {
                        this.backgroundMusic.source.connect(this.webAudioManager.destination);
                    }
                }
            } else if (applyFilter) {
                // If we can't set up the gain node but still want the filter
                this.applyLowPassFilter();
            }
        } else if (applyFilter) {
            // For non-WebAudio sound objects, just apply the filter
            this.applyLowPassFilter();
        }
    }

    stopBackgroundMusic(): void {
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
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
        if (this.backgroundMusic instanceof Phaser.Sound.WebAudioSound) {
            this.webAudioManager = this.scene.sound as Phaser.Sound.WebAudioSoundManager;

            if (this.webAudioManager.context) {
                try {
                    // Create a lowpass filter
                    this.lowPassFilter = this.webAudioManager.context.createBiquadFilter();
                    this.lowPassFilter.type = 'lowpass';
                    this.lowPassFilter.frequency.value = frequency;
                    this.lowPassFilter.Q.value = q;

                    // Connect the filter to the audio graph
                    if (this.backgroundMusic.source) {
                        // Disconnect existing connections
                        this.backgroundMusic.source.disconnect();

                        if (this.gainNode) {
                            this.gainNode.disconnect();

                            // Connect source -> gain -> filter -> destination
                            this.backgroundMusic.source.connect(this.gainNode);
                            this.gainNode.connect(this.lowPassFilter);
                            this.lowPassFilter.connect(this.webAudioManager.destination);
                        } else {
                            // If no gain node, connect source -> filter -> destination
                            this.backgroundMusic.source.connect(this.lowPassFilter);
                            this.lowPassFilter.connect(this.webAudioManager.destination);
                        }
                    } else {
                        console.warn('Audio source not available, playing without filter');
                    }
                } catch (error) {
                    console.warn('Failed to apply lowpass filter:', error);
                }
            }
        }
    }

    setFilterFrequency(frequency: number, duration: number = 500): void {
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

    private handleEscapeMenuOpen = () => {
        this.setFilterFrequency(300);
    };

    private handleEscapeMenuClose = () => {
        this.setFilterFrequency(2000);
    };

    private playNotificationSound = () => {
        if (this.scene.sound && this.scene.sound.add) {
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
