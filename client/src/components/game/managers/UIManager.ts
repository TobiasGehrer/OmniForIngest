import WebSocketService from '../../services/WebSocketService.ts';
import eventBus from '../../../utils/eventBus';

export default class UIManager {
    private websocket: WebSocketService;
    private readonly username: string;

    constructor(websocket: WebSocketService, username: string) {
        this.websocket = websocket;
        this.username = username;
    }

    // Send initial connection info to React frontend
    createConnectionText(): void {
        this.updateConnectionText(0);
    }

    updateConnectionText(playerCount: number): void {
        // Send connection info to React frontend via eventBus
        eventBus.emit('updateConnectionInfo', {
            username: this.username,
            isConnected: this.websocket.isSocketConnected(),
            playerCount: playerCount
        });
    }
}
