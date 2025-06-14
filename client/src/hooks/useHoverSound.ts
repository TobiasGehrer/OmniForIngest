import {useEffect, useState} from 'react';

interface WindowWithWebkitAudio extends Window {
    webkitAudioContext?: typeof AudioContext;
}

/**
 * Custom hook for adding hover sound effects to elements
 * @returns A function that plays a hover sound when called
 */
const useHoverSound = () => {
    // Store the audio context so we can use it later
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

    // Create the audio context when the hook is first used
    useEffect(() => {
        try {
            // Create AudioContext only when component mounts
            const windowWithWebkit = window as WindowWithWebkitAudio;
            const AudioContextClass = window.AudioContext || windowWithWebkit.webkitAudioContext;

            if (!AudioContextClass) {
                console.warn('AudioContext is not supported in this browser');
                return;
            }

            const context = new AudioContextClass();
            setAudioContext(context);

            // Clean up when no longer needed
            return () => {
                if (context) {
                    context.close().catch(err => {
                        console.warn('Error closing AudioContext:', err);
                    });
                }
            };
        } catch (error) {
            console.warn('Error creating AudioContext:', error);
        }
    }, []);

    return () => {
        if (!audioContext) return;

        // Create sound generator
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        // Connect the sound generator to the volume control and then to the speakers
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Set the sound properties (sine wave at A4 note)
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime);

        gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

        // Play the sound for 0.2 seconds
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
    };
};

export default useHoverSound;
