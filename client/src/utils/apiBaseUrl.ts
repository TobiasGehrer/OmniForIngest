// Utility to get the correct API base URL depending on environment
export function getApiBaseUrl(): string {
    if (import.meta.env.PROD) {
        return 'https://omni.jware.at';
    }
    return 'http://localhost:8080';
}

// Utility to get the correct Shop API base URL
export function getShopBaseUrl(): string {
    if (import.meta.env.PROD) {
        return 'https://omni.jware.at';
    }
    return 'http://localhost:8084';
}

// Utility to get the correct Wallet API base URL
export function getWalletBaseUrl(): string {
    if (import.meta.env.PROD) {
        return 'https://omni.jware.at';
    }
    return 'http://localhost:8083';
}

// Utility to get the correct WebSocket base URL
export function getWsBaseUrl(): string {
    if (import.meta.env.PROD) {
        return 'wss://omni.jware.at/game';
    }
    return 'ws://localhost:8081/game';
}
