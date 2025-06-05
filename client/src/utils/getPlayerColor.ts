// Generate a consistent color for a player based on their name
export function getPlayerColorCSS(username: string): string {
    // Simple hash function to generate a number from the player name
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Convert to a hue value (0-360)
    const hue = Math.abs(hash % 360);

    // Use a high saturation and lightness for vibrant but readable colors
    return `hsl(${hue}, 70%, 60%)`;
}

export function getPlayerColorHex(username: string): number {
    // Reuse the same hashing and hue logic
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = Math.abs(hash % 360);

    // Convert HSL to RGB
    const h = hue / 360;
    const s = 0.7;
    const l = 0.8;

    const hue2rgb = (p: number, q: number, t: number): number => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
    const g = Math.round(hue2rgb(p, q, h) * 255);
    const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

    return (r << 16) + (g << 8) + b;
}
