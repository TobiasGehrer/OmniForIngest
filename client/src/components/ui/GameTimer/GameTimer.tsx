import React, {useEffect, useState} from 'react';
import eventBus from '../../../utils/eventBus';
import './GameTimer.css';

interface GameTimerProps {
    isVisible?: boolean;
}

const GameTimer: React.FC<GameTimerProps> = ({ isVisible = true }) => {
    const [timeRemaining, setTimeRemaining] = useState<number>(0);
    const [isGameActive, setIsGameActive] = useState(false);

    useEffect(() => {
        const handleTimeRemaining = (data: { timeRemaining: number }) => {
            setTimeRemaining(data.timeRemaining);
        };

        const handleGameStarted = () => {
            setIsGameActive(true);
        };

        const handleGameEnded = () => {
            setIsGameActive(false);
            setTimeRemaining(0);
        };

        // Register event handlers
        eventBus.on('time_remaining', handleTimeRemaining);
        eventBus.on('game_started', handleGameStarted);
        eventBus.on('game_ended', handleGameEnded);

        return () => {
            eventBus.off('time_remaining', handleTimeRemaining);
            eventBus.off('game_started', handleGameStarted);
            eventBus.off('game_ended', handleGameEnded);
        };
    }, []);

    console.log('GameTimer render - isVisible:', isVisible, 'isGameActive:', isGameActive, 'timeRemaining:', timeRemaining);

    if (!isVisible || !isGameActive) {
        console.log('GameTimer hidden - isVisible:', isVisible, 'isGameActive:', isGameActive);
        return null;
    }

    const formatTime = (milliseconds: number): string => {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const getTimerClass = (): string => {
        if (timeRemaining <= 30000) { // 30 seconds
            return 'game-timer--critical';
        } else if (timeRemaining <= 60000) { // 1 minute
            return 'game-timer--warning';
        }
        return 'game-timer--normal';
    };

    return (
        <div className={`game-timer ${getTimerClass()}`}>
            <div className="game-timer__label">Time Left:</div>
            <div className="game-timer__time">{formatTime(timeRemaining)}</div>
        </div>
    );
};

export default GameTimer;