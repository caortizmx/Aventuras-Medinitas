/**
 * Tests for character configuration and save/load persistence.
 *
 * All code under test is Phaser-free, so the tests run in the jsdom
 * environment without a canvas or WebGL runtime.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    CHARACTERS,
    CharacterConfig,
    DEFAULT_CHARACTER_ID,
    findCharacterById,
    getDefaultCharacter,
} from '../src/game/data/characters';
import {
    saveSelectedCharacter,
    loadSelectedCharacterId,
} from '../src/game/system/SaveSystem';

// ── 1. findCharacterById ──────────────────────────────────────────────────────

describe('findCharacterById', () => {
    it('returns the correct config for a valid id', () => {
        const emma = findCharacterById('emma');
        expect(emma).toBeDefined();
        expect(emma!.id).toBe('emma');
        expect(emma!.displayName).toBe('Emma');
    });

    it('returns the correct config for each known character', () => {
        for (const char of CHARACTERS) {
            const found = findCharacterById(char.id);
            expect(found).toBeDefined();
            expect(found!.id).toBe(char.id);
        }
    });

    it('returns undefined for an unknown id', () => {
        expect(findCharacterById('unknown-hero')).toBeUndefined();
    });

    it('returns undefined for an empty string', () => {
        expect(findCharacterById('')).toBeUndefined();
    });
});

// ── 2. getDefaultCharacter ────────────────────────────────────────────────────

describe('getDefaultCharacter', () => {
    it('returns a character object', () => {
        const def = getDefaultCharacter();
        expect(def).toBeDefined();
    });

    it('matches DEFAULT_CHARACTER_ID', () => {
        expect(getDefaultCharacter().id).toBe(DEFAULT_CHARACTER_ID);
    });

    it('is present in the CHARACTERS array', () => {
        const def = getDefaultCharacter();
        expect(CHARACTERS.some(c => c.id === def.id)).toBe(true);
    });
});

// ── 3. CHARACTERS array ───────────────────────────────────────────────────────

describe('CHARACTERS array', () => {
    it('contains exactly three characters', () => {
        expect(CHARACTERS.length).toBe(3);
    });

    it('includes Emma, Orel, and Israel', () => {
        const ids = CHARACTERS.map(c => c.id);
        expect(ids).toContain('emma');
        expect(ids).toContain('orel');
        expect(ids).toContain('israel');
    });

    const REQUIRED_KEYS: (keyof CharacterConfig)[] = [
        'id',
        'displayName',
        'temporaryColor',
        'assetKey',
        'collisionWidth',
        'collisionHeight',
        'movementSpeed',
        'jumpVelocity',
    ];

    it.each(REQUIRED_KEYS)('every character has a "%s" property', (key) => {
        for (const char of CHARACTERS) {
            expect(char).toHaveProperty(key);
            expect(char[key]).toBeDefined();
        }
    });

    it('all characters have positive collisionWidth', () => {
        for (const char of CHARACTERS) {
            expect(char.collisionWidth).toBeGreaterThan(0);
        }
    });

    it('all characters have positive collisionHeight', () => {
        for (const char of CHARACTERS) {
            expect(char.collisionHeight).toBeGreaterThan(0);
        }
    });

    it('all characters have positive movementSpeed', () => {
        for (const char of CHARACTERS) {
            expect(char.movementSpeed).toBeGreaterThan(0);
        }
    });

    it('all characters have a negative jumpVelocity (upward force)', () => {
        for (const char of CHARACTERS) {
            expect(char.jumpVelocity).toBeLessThan(0);
        }
    });

    it('all characters have identical gameplay abilities at Stage 4', () => {
        const [first, ...rest] = CHARACTERS;
        for (const char of rest) {
            expect(char.movementSpeed).toBe(first.movementSpeed);
            expect(char.jumpVelocity).toBe(first.jumpVelocity);
        }
    });

    it('all character ids are unique', () => {
        const ids = CHARACTERS.map(c => c.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

// ── 4 & 5. saveSelectedCharacter / loadSelectedCharacterId ────────────────────

describe('saveSelectedCharacter / loadSelectedCharacterId', () => {
    // Start each test with a clean localStorage
    beforeEach(() => localStorage.clear());
    afterEach(() => localStorage.clear());

    it('saves and loads a valid character id', () => {
        saveSelectedCharacter('orel');
        expect(loadSelectedCharacterId()).toBe('orel');
    });

    it('saves and loads every known character id', () => {
        for (const char of CHARACTERS) {
            saveSelectedCharacter(char.id);
            expect(loadSelectedCharacterId()).toBe(char.id);
        }
    });

    it('falls back to the default character when nothing is saved', () => {
        expect(loadSelectedCharacterId()).toBe(DEFAULT_CHARACTER_ID);
    });
});

// ── 6. Corrupted saved selection ──────────────────────────────────────────────

describe('loadSelectedCharacterId — corrupted/invalid stored data', () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => localStorage.clear());

    it('falls back to the default when the stored id does not match any character', () => {
        localStorage.setItem('aventuras_selected_character', 'totally-invalid-id');
        expect(loadSelectedCharacterId()).toBe(DEFAULT_CHARACTER_ID);
    });

    it('falls back to the default for an empty string value', () => {
        localStorage.setItem('aventuras_selected_character', '');
        expect(loadSelectedCharacterId()).toBe(DEFAULT_CHARACTER_ID);
    });

    it('falls back to the default for a numeric-looking string', () => {
        localStorage.setItem('aventuras_selected_character', '42');
        expect(loadSelectedCharacterId()).toBe(DEFAULT_CHARACTER_ID);
    });

    it('falls back to the default for a JSON-serialised object', () => {
        localStorage.setItem('aventuras_selected_character', '{"id":"emma"}');
        expect(loadSelectedCharacterId()).toBe(DEFAULT_CHARACTER_ID);
    });
});
