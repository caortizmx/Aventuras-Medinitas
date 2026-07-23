import { Boot } from './scenes/BootScene';
import { GameOver } from './scenes/GameOverScene';
import { MainMenu } from './scenes/MainMenuScene';
import { CharacterSelect } from './scenes/CharacterSelectScene';
import { LevelOne } from './scenes/LevelOneScene';
import { LevelComplete } from './scenes/LevelCompleteScene';
import { AUTO, Game, Scale } from 'phaser';
import { Preloader } from './scenes/Preloader';
import { GAME_HEIGHT, GAME_WIDTH, GRAVITY } from './constants/gameValues';

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    parent: 'game-container',
    backgroundColor: '#1a1a2e',
    // Crisp, non-blurry pixel-art scaling: nearest-neighbor filtering and
    // whole-pixel positioning are the cheapest, highest-impact visual polish
    // wins available before any new art assets are produced.
    pixelArt: true,
    roundPixels: true,
    scale: {
        mode:       Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
        width:      GAME_WIDTH,
        height:     GAME_HEIGHT,
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: GRAVITY },
            debug:   false,
        },
    },
    scene: [
        Boot,
        Preloader,
        MainMenu,
        CharacterSelect,
        LevelOne,
        LevelComplete,
        GameOver,
    ],
};

const StartGame = (parent: string): Game => new Game({ ...config, parent });

export default StartGame;
