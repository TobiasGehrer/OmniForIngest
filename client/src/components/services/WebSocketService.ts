export interface WebSocketConfig {
    serverUrl?: string;
    maxReconnectAttempts?: number;
    reconnectTimeout?: number;
    connectionTimeout?: number;
}

export default class WebSocketService {
    private static instance: WebSocketService;
    private socket: WebSocket | null = null;
    private username: string | null = null;
    private isConnected: boolean = false;
    private messageTypeHandlers: Map<string, ((data: any) => void)[]> = new Map();
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectTimeout: number = 3000;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private url: string = '';
    private serverUrl: string = 'ws://localhost:8081/game';
    private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
    private connectionTimeoutMs: number = 5000;
    private currentMap: string = 'map1';
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    //TODO: Not sure if gameState is even needed here
    private gameState: string = 'WAITING';

    public static getInstance(): WebSocketService {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
            WebSocketService.instance.setupVisibilityHandling();
        }
        return WebSocketService.instance;
    }

    private setupVisibilityHandling(): void {
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && !this.isConnected) {
                    setTimeout(() => {
                        if (!this.isConnected) {
                            this.connect();
                        }
                    }, 1000);
                }
            });
        }
    }

    public configure(config: WebSocketConfig): void {
        if (config.serverUrl) this.serverUrl = config.serverUrl;
        if (config.maxReconnectAttempts) this.maxReconnectAttempts = config.maxReconnectAttempts;
        if (config.reconnectTimeout) this.reconnectTimeout = config.reconnectTimeout;
        if (config.connectionTimeout) this.connectionTimeoutMs = config.connectionTimeout;
    }

    public setCurrentMap(mapKey: string): void {
        this.currentMap = mapKey;
    }

    public getCurrentMap(): string {
        return this.currentMap;
    }

    public setGameState(gameState: string): void {
        this.gameState = gameState;
    }

    public connect(serverUrl?: string, mapKey?: string): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        if (!this.username || this.username.trim() === '') {
            console.warn('Cannot connect to WebSocket: username not set');
            return;
        }

        const selectedMap = mapKey || this.getSelectedMapFromStorage() || this.currentMap;
        this.currentMap = selectedMap;

        const urlToUse = serverUrl || this.serverUrl;
        this.url = `${urlToUse}?token=${encodeURIComponent(this.username)}&map=${encodeURIComponent(selectedMap)}`;

        try {
            this.socket = new WebSocket(this.url);

            this.connectionTimeout = setTimeout(() => {
                if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
                    this.socket.close();
                    this.handleReconnect();
                }
            }, this.connectionTimeoutMs);

            this.socket.onopen = () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;

                if (this.connectionTimeout) {
                    clearTimeout(this.connectionTimeout);
                    this.connectionTimeout = null;
                }

                this.sendMessage('join_game', {
                    username: this.username,
                    mapId: selectedMap
                });

                this.startHeartbeat();
            };

            this.socket.onclose = (event) => {
                this.isConnected = false;
                this.stopHeartbeat();

                if (event.code === 1000) {
                    // Normal closure - likely due to page visibility, keep game state
                } else {
                    this.setGameState('WAITING');
                }

                if (this.connectionTimeout) {
                    clearTimeout(this.connectionTimeout);
                    this.connectionTimeout = null;
                }

                if (event.code !== 1000) {
                    this.handleReconnect();
                }
            };

            this.socket.onerror = (error) => {
                console.error('[WebSocket] Error:', error)
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.updateGameStateFromMessage(data);

                    if (data.type && this.messageTypeHandlers.has(data.type)) {
                        const handlers = this.messageTypeHandlers.get(data.type);
                        if (handlers) {
                            handlers.forEach(handler => handler(data));
                        }
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
        } catch (error) {
            console.error('Error creating WebSocket connection:', error);
            this.handleReconnect();
        }
    }

    public disconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }

        this.stopHeartbeat();
        this.reconnectAttempts = 0;

        if (this.socket) {
            this.socket.close(1000, 'Normal closure');
            this.socket = null;
        }

        this.isConnected = false;
    }

    public send(data: any): boolean {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            try {
                const message = {
                    ...data,
                    username: data.username || this.username
                };
                this.socket.send(JSON.stringify(message));
                return true;
            } catch (error) {
                console.error('Error sending message:', error);
                return false;
            }
        } else {
            if (!this.socket || this.socket.readyState === WebSocket.CLOSED || this.socket.readyState === WebSocket.CLOSING) {
                this.connect();
            }

            return false;
        }
    }

    public setUsername(username: string): void {
        this.username = username;
    }

    public getUsername(): string {
        return this.username && this.username.trim() !== '' ? this.username : 'UNKNOWN';
    }

    public isSocketConnected(): boolean {
        return this.isConnected && this.socket?.readyState === WebSocket.OPEN;
    }

    public onMessageType(type: string, handler: (data: any) => void): void {
        if (!this.messageTypeHandlers.has(type)) {
            this.messageTypeHandlers.set(type, []);
        }

        const handlers = this.messageTypeHandlers.get(type);
        if (handlers && !handlers.includes(handler)) {
            handlers.push(handler);
        }
    }

    public offMessageType(type: string, handler: (data: any) => void): void {
        if (this.messageTypeHandlers.has(type)) {
            const handlers = this.messageTypeHandlers.get(type);
            if (handlers) {
                const index = handlers.indexOf(handler);
                if (index !== -1) {
                    handlers.splice(index, 1);
                }

                if (handlers.length === 0) {
                    this.messageTypeHandlers.delete(type);
                }
            }
        }
    }

    public sendMessage(type: string, data: any = {}): boolean {
        return this.send({
            type,
            ...data
        });
    }

    private getSelectedMapFromStorage(): string | null {
        try {
            return sessionStorage.getItem('selectedMapKey');
        } catch (e) {
            return null;
        }
    }

    private handleReconnect(): void {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this.reconnectTimer = setTimeout(() => {
                this.connect();
            }, this.reconnectTimeout);
        }
    }

    private startHeartbeat(): void {
        this.stopHeartbeat();

        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) {
                this.sendMessage('heartbeat', { timestamp: Date.now() });
            }
        }, 60000);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    private updateGameStateFromMessage(data: any): void {
        switch (data.type) {
            case 'room_status':
                if (data.gameState) {
                    this.setGameState(data.gameState);
                }
                break;
            case 'countdown_started':
                this.setGameState('COUNTDOWN');
                break;
            case 'game_started':
                this.setGameState('PLAYING');
                break;
            case 'game_ended':
                this.setGameState('FINISHED');
                break;
            case 'countdown_cancelled':
                this.setGameState('WAITING');
                break;
        }
    }
}
