import { findCharacterById, getDefaultCharacter } from '../data/characters';

const CHARACTER_KEY = 'aventuras_selected_character';

/**
 * Persist the selected character id to localStorage.
 * Errors (private-browsing, quota exceeded, etc.) are silently ignored.
 */
export function saveSelectedCharacter(id: string): void {
    try {
        localStorage.setItem(CHARACTER_KEY, id);
    } catch {
        // Silently ignore storage errors
    }
}

/**
 * Load the previously saved character id from localStorage.
 *
 * Returns the stored id only if it matches a known character.
 * Falls back to the default character id for any of these cases:
 *  - Nothing saved yet
 *  - Stored value does not match any character id (corrupted / outdated)
 *  - localStorage is unavailable (e.g. private browsing restrictions)
 */
export function loadSelectedCharacterId(): string {
    try {
        const raw = localStorage.getItem(CHARACTER_KEY);
        if (raw !== null && findCharacterById(raw) !== undefined) {
            return raw;
        }
    } catch {
        // Silently ignore storage errors
    }
    return getDefaultCharacter().id;
}
