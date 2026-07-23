// Small shared color-math helpers used by the procedurally drawn placeholder
// art (character/enemy fallback textures). Kept separate so both fallback
// generators use one consistent shading implementation.

/** Clamp a color channel value to the valid 0-255 byte range. */
export function clampByte(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Lightens (positive `amount`) or darkens (negative `amount`) a color by
 * adding `amount` to each RGB channel. Accepts either a numeric hex color
 * (e.g. `0xd6663f`) or a `#rrggbb` string, and always returns a `#rrggbb`
 * string ready to use as a canvas fill/stroke style.
 */
export function shadeColor(color: number | string, amount: number): string {
    const hex = typeof color === 'number'
        ? color.toString(16).padStart(6, '0')
        : color.replace('#', '');

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const shadedChannels = [r, g, b].map((channelValue) => clampByte(channelValue + amount));
    return `#${shadedChannels.map((channelValue) => channelValue.toString(16).padStart(2, '0')).join('')}`;
}

/** Converts a numeric hex color (e.g. `0xd6663f`) to a `#rrggbb` string. */
export function toHexColorString(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
}
