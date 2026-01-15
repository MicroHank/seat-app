
export const AppConfig = {
    fontSize: 18,
    seatSizeGrid: 80,
    seatSizeRound: 60,
    seatSizeRectH: 60,
    seatSizeRectV: 60
};

export const SNAP_SIZE = 20;

export function loadConfig() {
    const saved = localStorage.getItem('seatAppConfig');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            Object.assign(AppConfig, parsed);
        } catch (e) {
            console.error("Failed to load config", e);
        }
    }
}

export function saveConfig() {
    localStorage.setItem('seatAppConfig', JSON.stringify(AppConfig));
}

export function getSeatSize(type) {
    switch (type) {
        case 'grid': return AppConfig.seatSizeGrid;
        case 'round': return AppConfig.seatSizeRound;
        case 'rect_h': return AppConfig.seatSizeRectH;
        case 'rect_v': return AppConfig.seatSizeRectV;
        case 'rect': return AppConfig.seatSizeRectH; // Default rect to H
        default: return 60;
    }
}
