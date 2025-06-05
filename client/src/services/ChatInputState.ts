export default class ChatInputState {
    private static instance: ChatInputState;
    private listeners: ((isActive: boolean) => void)[] = [];
    private isActive: boolean = false;

    private constructor() {
    }

    public static getInstance(): ChatInputState {
        if (!ChatInputState.instance) {
            ChatInputState.instance = new ChatInputState();
        }
        return ChatInputState.instance;
    }

    /**
     * Set the chat input state
     * @param isActive Whether the chat input is active
     */
    public setChatInputActive(isActive: boolean): void {
        this.isActive = isActive;
        // Notify all listeners
        this.listeners.forEach(listener => listener(isActive));
    }

    /**
     * Get the current chat input state
     * @returns Whether the chat input is active
     */
    public isChatInputActive(): boolean {
        return this.isActive;
    }

    /**
     * Register a listener for chat input state changes
     * @param listener The listener function
     */
    public addListener(listener: (isActive: boolean) => void): void {
        this.listeners.push(listener);
    }

    /**
     * Unregister a listener for chat input state changes
     * @param listener The listener function to remove
     */
    public removeListener(listener: (isActive: boolean) => void): void {
        this.listeners = this.listeners.filter(l => l !== listener);
    }
}
