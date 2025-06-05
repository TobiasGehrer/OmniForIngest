export interface ChatMessage {
    type: 'chat_message';
    username: string;
    message: string;
    timestamp: number;
}
