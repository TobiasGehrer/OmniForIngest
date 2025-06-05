import React, {useEffect, useRef, useState} from 'react';
import eventBus from '../../../utils/eventBus';
import './Notification.css';

interface NotificationData {
    message: string;
    id: number;
    isFading: boolean;
    height?: number;
}

const FADE_DURATION = 300;
const DISPLAY_DURATION = 4000;

const Notification: React.FC = () => {
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const notificationRefs = useRef<{
        [key: number]: HTMLDivElement | null
    }>({});

    useEffect(() => {
        const handleNotification = (message: string) => {
            const newNotification = {
                message,
                id: Date.now(), // Use timestamp as a unique ID
                isFading: false,
                height: 0, // Initial height, will be updated after render
            };

            setNotifications(prev => [...prev, newNotification]);

            // Play notification sound
            eventBus.emit('playNotificationSound');

            // Start fade out after display duration
            setTimeout(() => {
                setNotifications(prev =>
                    prev.map(n =>
                        n.id === newNotification.id ? {
                            ...n,
                            isFading: true
                        } : n
                    )
                );

                // Remove notification after fade animation completes
                setTimeout(() => {
                    setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
                }, FADE_DURATION);
            }, DISPLAY_DURATION);
        };

        eventBus.on('showNotification', handleNotification);

        return () => {
            eventBus.off('showNotification', handleNotification);
        };
    }, []);

    // Effect to measure heights of notifications after render
    useEffect(() => {
        // Update heights for all notifications that have a ref but no height
        notifications.forEach(notification => {
            const element = notificationRefs.current[notification.id];
            if (element && notification.height === 0) {
                const height = element.offsetHeight;
                setNotifications(prev =>
                    prev.map(n =>
                        n.id === notification.id ? {
                            ...n,
                            height
                        } : n
                    )
                );
            }
        });
    }, [notifications]);

    // Calculate positions based on actual heights
    const getNotificationPosition = (index: number): number => {
        let position = 10; // Start with initial gap

        // Add heights of all previous notifications plus gaps
        for (let i = 0; i < index; i++) {
            const prevHeight = notifications[i].height || 0;
            position += prevHeight + 10; // Add height plus gap
        }

        return position;
    };

    return (
        <div className="notification__container">
            {notifications.map((notification, index) => (
                <div
                    key={notification.id}
                    ref={el => {
                        notificationRefs.current[notification.id] = el;
                    }}
                    className={`notification__item ${notification.isFading ? 'fade-out' : 'slide-in'}`}
                    style={{top: `${getNotificationPosition(index)}px`}}
                >
                    {notification.message}
                </div>
            ))}
        </div>
    );
};

export default Notification;
