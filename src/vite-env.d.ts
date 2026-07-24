/// <reference types="vite/client" />

interface Window {
    __PHASER_GAME__?: import('phaser').Game;
    __CAMPAIGN_TEST__?: import('./game/testing/campaignTestBridge').CampaignTestBridge;
}
