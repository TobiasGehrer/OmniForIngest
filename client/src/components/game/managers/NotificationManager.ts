import eventBus from '../../../utils/eventBus';

export default class NotificationManager {
    showNotification(message: string): void {
        // Send notification data to React frontend via eventBus
        eventBus.emit('showNotification', message);
    }
}
