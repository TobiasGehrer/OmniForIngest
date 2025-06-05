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
    private currentMap: string = 'map1'; // Default map
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private lastHeartbeat: number = 0;
    private gameState: string = 'WAITING';

    public static getInstance(): WebSocketService {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
            WebSocketService.instance.setupVisibilityHandling();
        }
        return WebSocketService.instance;
    }

    /**
     * Set up page visibility handling to prevent disconnections on inactive tabs
     */
    private setupVisibilityHandling(): void {
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                console.log('[WebSocket] Page visibility changed:', document.visibilityState, 'at', new Date().toISOString());
                console.log('[WebSocket] Connection state:', this.isConnected);
                console.log('[WebSocket] Game state:', this.gameState);
                
                if (document.visibilityState === 'visible' && !this.isConnected) {
                    console.log('Page became visible and WebSocket is disconnected');
                    console.log('Attempting reconnect...');
                    setTimeout(() => {
                        if (!this.isConnected) {
                            this.connect();
                        }
                    }, 1000);
                } else if (document.visibilityState === 'hidden' && this.isConnected) {
                    console.log('[WebSocket] Page became hidden but connection is still active');
                }
            });
        }
    }

    /**
     * Configure the WebSocket service
     * @param config Configuration options
     */
    public configure(config: WebSocketConfig): void {
        if (config.serverUrl) this.serverUrl = config.serverUrl;
        if (config.maxReconnectAttempts) this.maxReconnectAttempts = config.maxReconnectAttempts;
        if (config.reconnectTimeout) this.reconnectTimeout = config.reconnectTimeout;
        if (config.connectionTimeout) this.connectionTimeoutMs = config.connectionTimeout;
    }

    /**
     * Set the current map for WebSocket connections
     * @param mapKey The map key to use for connections
     */
    public setCurrentMap(mapKey: string): void {
        this.currentMap = mapKey;
        console.log(`WebSocket map set to: ${mapKey}`);
    }

    /**
     * Get the current map
     * @returns The current map key
     */
    public getCurrentMap(): string {
        return this.currentMap;
    }

    /**
     * Update the current game state
     * @param gameState The new game state
     */
    public setGameState(gameState: string): void {
        this.gameState = gameState;
        console.log('Game state updated to:', gameState);
    }

    /**
     * Connect to the WebSocket server
     * @param serverUrl Optional server URL to override the configured one
     */
    public connect(serverUrl?: string, mapKey?: string): void {
        // Clear any existing reconnect timers
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // If already connected or connecting, return
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        // Don't connect if username is not set
        if (!this.username || this.username.trim() === '') {
            console.warn('Cannot connect to WebSocket: username not set');
            return;
        }

        const selectedMap = mapKey || this.getSelectedMapFromStorage() || this.currentMap;
        this.currentMap = selectedMap;

        const urlToUse = serverUrl || this.serverUrl;
        this.url = `${urlToUse}?token=${encodeURIComponent(this.username)}&map=${encodeURIComponent(selectedMap)}`;
        console.log('Connecting to WebSocket server at:', this.url);

        try {
            this.socket = new WebSocket(this.url);

            // Set connection timeout
            this.connectionTimeout = setTimeout(() => {
                console.warn('WebSocket connection timeout');
                if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
                    this.socket.close();
                    this.handleReconnect();
                }
            }, this.connectionTimeoutMs);

            this.socket.onopen = () => {
                console.log(`[WebSocket] Connected to map: ${selectedMap} at`, new Date().toISOString());
                this.isConnected = true;
                this.reconnectAttempts = 0;

                // Clear connection timeout
                if (this.connectionTimeout) {
                    clearTimeout(this.connectionTimeout);
                    this.connectionTimeout = null;
                }

                this.sendMessage('join_game', {
                    username: this.username,
                    mapId: selectedMap
                });

                // Start heartbeat to keep connection alive
                this.startHeartbeat();
            };

            this.socket.onclose = (event) => {
                console.log(`[WebSocket] DISCONNECTED at ${new Date().toISOString()} - Code:`, event.code, 'Reason:', event.reason, 'Clean:', event.wasClean);
                console.log('[WebSocket] Document visibility:', document.visibilityState);
                console.log('[WebSocket] Game state when disconnected:', this.gameState);
                console.log('[WebSocket] Username:', this.username);
                console.log('[WebSocket] Stack trace at disconnect:');
                console.trace();
                this.isConnected = false;

                // Stop heartbeat
                this.stopHeartbeat();

                // Reset game state to prevent getting stuck in PLAYING state
                if (event.code === 1000) {
                    // Normal closure - likely due to page visibility, keep game state
                    console.log('Normal closure detected, keeping game state');
                } else {
                    // Abnormal closure - reset to waiting
                    this.setGameState('WAITING');
                }

                // Clear connection timeout if it exists
                if (this.connectionTimeout) {
                    clearTimeout(this.connectionTimeout);
                    this.connectionTimeout = null;
                }

                // Attempt to reconnect if not a normal closure
                if (event.code !== 1000) {
                    this.handleReconnect();
                }
            };

            this.socket.onerror = (error) => {
                console.error('[WebSocket] ERROR occurred at', new Date().toISOString(), ':', error);
                console.log('[WebSocket] Error details - readyState:', this.socket?.readyState);
                console.log('[WebSocket] Error details - url:', this.url);
                console.trace('[WebSocket] Error stack trace:');
                // Error handling will be done in onclose
            };

            this.socket.onmessage = (event) => {
                try {
                    // Parse the message to ensure its valid JSON
                    const data = JSON.parse(event.data);

                    // Log critical game events
                    if (['countdown_started', 'countdown', 'game_started', 'game_ended'].includes(data.type)) {
                        console.log(`[WebSocket] Critical event received:`, data.type, data);
                    }

                    // Track game state changes automatically
                    this.updateGameStateFromMessage(data);

                    // Call specific message type handlers
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

    /**
     * Disconnect from the WebSocket server
     */
    public disconnect(): void {
        console.log('[WebSocket] EXPLICIT DISCONNECT called at', new Date().toISOString());
        console.trace('Disconnect call stack:');
        
        // Clear any pending timeouts
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }

        // Stop heartbeat
        this.stopHeartbeat();

        // Reset reconnect attempts
        this.reconnectAttempts = 0;

        // Close the socket if it exists
        if (this.socket) {
            this.socket.close(1000, 'Normal closure');
            this.socket = null;
        }

        this.isConnected = false;
    }

    /**
     * Send data to the WebSocket server
     * @param data The data to send
     * @returns Whether the message was sent successfully
     */
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
            console.warn('WebSocket not connected, cannot send data');

            // If socket is closed or closing, attempt to reconnect
            if (!this.socket || this.socket.readyState === WebSocket.CLOSED || this.socket.readyState === WebSocket.CLOSING) {
                console.log('Attempting to reconnect before sending...');
                this.connect();
            }

            return false;
        }
    }

    /**
     * Set the username
     * @param username The username to set
     */
    public setUsername(username: string): void {
        this.username = username;
    }

    /**
     * Get the username
     * @returns The username or null if not set or empty
     */
    public getUsername(): string {
        // Return fallback if username is null, undefined, or an empty string
        return this.username && this.username.trim() !== '' ? this.username : 'UNKNOWN';
    }

    /**
     * Check if the WebSocket is connected
     * @returns Whether the WebSocket is connected
     */
    public isSocketConnected(): boolean {
        return this.isConnected && this.socket?.readyState === WebSocket.OPEN;
    }

    /**
     * Register a handler for a specific message type
     * @param type The message type to handle
     * @param handler The handler function
     */
    public onMessageType(type: string, handler: (data: any) => void): void {
        if (!this.messageTypeHandlers.has(type)) {
            this.messageTypeHandlers.set(type, []);
        }

        const handlers = this.messageTypeHandlers.get(type);
        if (handlers && !handlers.includes(handler)) {
            handlers.push(handler);
        }
    }

    /**
     * Unregister a handler for a specific message type
     * @param type The message type
     * @param handler The handler function to remove
     */
    public offMessageType(type: string, handler: (data: any) => void): void {
        if (this.messageTypeHandlers.has(type)) {
            const handlers = this.messageTypeHandlers.get(type);
            if (handlers) {
                const index = handlers.indexOf(handler);
                if (index !== -1) {
                    handlers.splice(index, 1);
                }

                // Remove the type entry if no handlers left
                if (handlers.length === 0) {
                    this.messageTypeHandlers.delete(type);
                }
            }
        }
    }

    /**
     * Send a message with a specific type
     * @param type The message type
     * @param data The data to send
     * @returns Whether the message was sent successfully
     */
    public sendMessage(type: string, data: any = {}): boolean {
        return this.send({
            type,
            ...data
        });
    }

    /**
     * Get the selected map from session storage
     * @private
     */
    private getSelectedMapFromStorage(): string | null {
        try {
            return sessionStorage.getItem('selectedMapKey');
        } catch (e) {
            console.warn('Could not access sessionStorage:', e);
            return null;
        }
    }

    /**
     * Handle reconnection logic
     * @private
     */
    private handleReconnect(): void {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

            this.reconnectTimer = setTimeout(() => {
                this.connect();
            }, this.reconnectTimeout);
        } else {
            console.error('Max reconnect attempts reached. Please try again later.');
        }
    }

    /**
     * Start heartbeat to keep connection alive
     * @private
     */
    private startHeartbeat(): void {
        this.stopHeartbeat(); // Clear any existing heartbeat

        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) {
                this.lastHeartbeat = Date.now();
                this.sendMessage('heartbeat', { timestamp: this.lastHeartbeat });
            }
        }, 60000); // Send heartbeat every 60 seconds
    }

    /**
     * Stop heartbeat
     * @private
     */
    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Update game state based on incoming WebSocket messages
     * @private
     */
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
