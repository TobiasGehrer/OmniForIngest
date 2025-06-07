import React, {useEffect, useRef, useState} from 'react';
import {ChatMessage} from '../../../types/ChatMessage';
import WebSocketService from '../../services/WebSocketService';
import ChatInputState from '../../../services/ChatInputState';
import {getPlayerColorCSS} from '../../../utils/getPlayerColor.ts';
import eventBus from '../../../utils/eventBus.ts';

import './Chat.css';

interface ChatProps {
    displayDuration?: number;
    username?: string;
}

const Chat: React.FC<ChatProps> = ({
                                       displayDuration = 5000,
                                       username = 'Unknown'
                                   }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isVisible, setIsVisible] = useState(false);
    const [isInputActive, setIsInputActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const websocketService = useRef<WebSocketService | null>(null);
    const chatInputState = useRef<ChatInputState>(ChatInputState.getInstance());
    const notificationSound = new Audio('/assets/audio/fx/chat.mp3');
    notificationSound.volume = 0.3;

    // Initialize WebSocket service
    useEffect(() => {
        const initializeWebSocket = async () => {
            try {
                websocketService.current = await WebSocketService.getInstance();
            } catch (error) {
                console.error('Failed to initialize WebSocket service:', error);
            }
        };

        initializeWebSocket();
    }, []);

    // Handle receiving new chat messages via eventBus
    useEffect(() => {
        const handleChatMessage = (data: any) => {
            const message: ChatMessage = {
                type: 'chat_message',
                username: data.username,
                message: data.message,
                timestamp: data.timestamp
            };
            setMessages(prevMessages => [...prevMessages, message]);
            showChat();
            notificationSound.play().catch(() => {
                // Suppress autoplay restrictions silently
            });
        };

        // Listen for chat messages via eventBus
        eventBus.on('chat_message', handleChatMessage);

        return () => {
            // Remove event listener when component unmounts
            eventBus.off('chat_message', handleChatMessage);
        };
    }, []);

    // Auto-hide chat after displayDuration
    const showChat = () => {
        setIsVisible(true);

        // Clear any existing timeout
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
        }

        // Set a new timeout to hide the chat
        hideTimeoutRef.current = setTimeout(() => {
            // Use functional state update to get current value
            setIsVisible(prev => {
                // Only hide if input is not currently active
                const chatState = chatInputState.current.isChatInputActive();
                return chatState ? prev : false;
            });
        }, displayDuration);
    };

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
    }, [messages]);

    // Handle 't' key to show chat input or send message
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 't') {
                if (!isInputActive) {
                    e.preventDefault();
                    setIsInputActive(true);
                    setIsVisible(true);
                    // Notify that chat input is active FIRST
                    chatInputState.current.setChatInputActive(true);
                    // Focus the input field immediately in next tick
                    requestAnimationFrame(() => {
                        inputRef.current?.focus();
                    });
                }
            } else if (e.key === 'Escape' && isInputActive) {
                setIsInputActive(false);
                // Notify that chat input is inactive
                chatInputState.current.setChatInputActive(false);

                if (hideTimeoutRef.current) {
                    clearTimeout(hideTimeoutRef.current);
                }

                // Set timeout to hide the chat after display duration
                hideTimeoutRef.current = setTimeout(() => {
                    setIsVisible(false);
                }, displayDuration);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isInputActive, displayDuration]);

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    // Handle form submission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (inputValue.trim() && websocketService.current) {
            // Create a chat message object
            const newMessage: ChatMessage = {
                type: 'chat_message',
                username: username,
                message: inputValue.trim(),
                timestamp: Date.now()
            };

            // Add message to local state immediately
            setMessages(prevMessages => [...prevMessages, newMessage]);

            // Send the message directly via WebSocket
            websocketService.current.send(newMessage);
            setInputValue('');
        }

        setIsInputActive(false);

        // Notify that chat input is inactive
        chatInputState.current.setChatInputActive(false);

        // Blur the input field to remove focus
        inputRef.current?.blur();

        // Use showChat() to maintain consistent timing
        showChat();
    };

    // Handle keyboard events in the input field
    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        // Prevent all key events from bubbling up to game handlers
        e.stopPropagation();
        
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit(e);
        }
        // Allow all other keys (including WASD and space) to work normally
    };

    // Determine the CSS class based on the current state
    const getChatClassName = () => {
        if (!isVisible) return 'game-chat game-chat--hidden';
        if (isInputActive) return 'game-chat game-chat--active';
        return 'game-chat';
    };

    return (
        <div className={getChatClassName()}>
            <div className="game-chat__messages">
                {messages.map((msg, index) => (
                    <div key={index} className="game-chat__message">
            <span
                className="game-chat__player-name"
                style={{color: getPlayerColorCSS(msg.username)}}
            >
              {msg.username}:
            </span>
                        <span className="game-chat__message-text">{msg.message}</span>
                    </div>
                ))}
                <div ref={messagesEndRef}/>
            </div>

            {isInputActive && (
                <form onSubmit={handleSubmit} className="game-chat__input-container">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleInputKeyDown}
                        className="game-chat__input"
                        placeholder="Type your message..."
                        autoFocus
                    />
                </form>
            )}
        </div>
    );
};

export default Chat;
