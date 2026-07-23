export const UI_LAYOUT = {
    safeHorizontalMargin: 20,
    safeVerticalMargin: 16,
    maximumContentWidth: 680,
    mobileBreakpoint: 600,
    wideScreenBreakpoint: 1200,
    minimumReadableFontSize: 14,
    maximumReadableFontSize: 56,
    buttonHeight: 46,
    buttonGap: 10,
} as const;

export interface SafeArea {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}

export interface LoadingLayout {
    safeArea: SafeArea;
    logoX: number;
    logoY: number;
    logoMaxWidth: number;
    logoMaxHeight: number;
    progressX: number;
    progressY: number;
    progressWidth: number;
    progressHeight: number;
    percentageY: number;
    statusY: number;
    statusFontSize: number;
}

export interface MainMenuLayout {
    safeArea: SafeArea;
    logoX: number;
    logoY: number;
    logoMaxWidth: number;
    logoMaxHeight: number;
    promptY: number;
    promptFontSize: number;
}

export interface GameOverLayout {
    safeArea: SafeArea;
    panelX: number;
    panelY: number;
    panelWidth: number;
    panelHeight: number;
    titleY: number;
    titleFontSize: number;
    summaryY: number;
    summaryFontSize: number;
    buttonWidth: number;
    buttonHeight: number;
    retryButtonY: number;
    menuButtonY: number;
}

export function clamp(minimum: number, value: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}

export function calculateSafeArea(width: number, height: number): SafeArea {
    const horizontal = clamp(12, width * 0.035, UI_LAYOUT.safeHorizontalMargin);
    const vertical = clamp(10, height * 0.035, UI_LAYOUT.safeVerticalMargin);

    return {
        left: horizontal,
        top: vertical,
        right: width - horizontal,
        bottom: height - vertical,
        width: width - horizontal * 2,
        height: height - vertical * 2,
    };
}

export function calculateContainScale(
    textureWidth: number,
    textureHeight: number,
    availableWidth: number,
    availableHeight: number,
    maximumScale = 1,
): number {
    if (textureWidth <= 0 || textureHeight <= 0 || availableWidth <= 0 || availableHeight <= 0) {
        return 0;
    }

    return Math.min(
        availableWidth / textureWidth,
        availableHeight / textureHeight,
        maximumScale,
    );
}

export function calculateCoverScale(
    textureWidth: number,
    textureHeight: number,
    viewportWidth: number,
    viewportHeight: number,
): number {
    if (textureWidth <= 0 || textureHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
        return 0;
    }

    return Math.max(viewportWidth / textureWidth, viewportHeight / textureHeight);
}

export function calculateLoadingLayout(width: number, height: number): LoadingLayout {
    const safeArea = calculateSafeArea(width, height);
    const contentWidth = Math.min(safeArea.width, UI_LAYOUT.maximumContentWidth);
    const progressWidth = clamp(220, contentWidth * 0.72, 460);

    return {
        safeArea,
        logoX: width / 2,
        logoY: safeArea.top + safeArea.height * 0.34,
        logoMaxWidth: contentWidth * 0.78,
        logoMaxHeight: safeArea.height * 0.3,
        progressX: width / 2,
        progressY: safeArea.top + safeArea.height * 0.68,
        progressWidth,
        progressHeight: clamp(12, height * 0.035, 20),
        percentageY: safeArea.top + safeArea.height * 0.76,
        statusY: safeArea.top + safeArea.height * 0.84,
        statusFontSize: clamp(UI_LAYOUT.minimumReadableFontSize, height * 0.038, 18),
    };
}

export function calculateMainMenuLayout(width: number, height: number): MainMenuLayout {
    const safeArea = calculateSafeArea(width, height);
    const contentWidth = Math.min(safeArea.width, UI_LAYOUT.maximumContentWidth);

    return {
        safeArea,
        logoX: width / 2,
        logoY: safeArea.top + safeArea.height * 0.43,
        logoMaxWidth: contentWidth * 0.78,
        logoMaxHeight: safeArea.height * 0.3,
        promptY: safeArea.top + safeArea.height * 0.76,
        promptFontSize: clamp(20, height * 0.065, 32),
    };
}

export function calculateGameOverLayout(width: number, height: number): GameOverLayout {
    const safeArea = calculateSafeArea(width, height);
    const panelWidth = Math.min(safeArea.width, UI_LAYOUT.maximumContentWidth, 560);
    const panelHeight = Math.min(safeArea.height, 414);
    const panelTop = (height - panelHeight) / 2;
    const panelBottom = panelTop + panelHeight;
    // 44 logical pixels is the minimum accessible touch-target height on short mobile viewports.
    const buttonHeight = Math.max(44, Math.min(height * 0.105, 48));

    return {
        safeArea,
        panelX: width / 2,
        panelY: height / 2,
        panelWidth,
        panelHeight,
        titleY: panelTop + panelHeight * 0.13,
        titleFontSize: clamp(32, height * 0.1, UI_LAYOUT.maximumReadableFontSize),
        summaryY: panelTop + panelHeight * 0.36,
        summaryFontSize: clamp(16, height * 0.045, 22),
        buttonWidth: Math.min(panelWidth - 40, 340),
        buttonHeight,
        retryButtonY: panelBottom - buttonHeight * 1.65 - UI_LAYOUT.buttonGap,
        menuButtonY: panelBottom - buttonHeight * 0.6,
    };
}
