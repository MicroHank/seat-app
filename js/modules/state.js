// State Module
import { AppConfig } from './config.js';

export let students = [];
export let currentMode = 'desk'; // 'desk' or 'seat'

// History Stacks
let historyStack = [];
let redoStack = [];
const MAX_HISTORY = 20;

// Callbacks (injected by App)
let onCapture = null;
let onRestore = null;
let onUndoRedoUpdate = null;
let onAutoSaveUpdate = null; // (statusHtml) => ...

// State Initialization
export function init(callbacks) {
    if (callbacks.onCapture) onCapture = callbacks.onCapture;
    if (callbacks.onRestore) onRestore = callbacks.onRestore;
    if (callbacks.onUndoRedoUpdate) onUndoRedoUpdate = callbacks.onUndoRedoUpdate;
    if (callbacks.onAutoSaveUpdate) onAutoSaveUpdate = callbacks.onAutoSaveUpdate;

    // Load initial auto-save if available
    tryLoadAutoSave();
}

export function setStudents(newStudents) {
    students = newStudents;
}

export function setCurrentMode(mode) {
    currentMode = mode;
}

// --- State Management ---
export function captureState() {
    if (!onCapture) return {};
    
    const layoutAndActivity = onCapture(); // Should return { layout, activity }
    
    return {
        students: [...students],
        layout: layoutAndActivity.layout,
        config: { ...AppConfig },
        activity: layoutAndActivity.activity,
        timestamp: Date.now()
    };
}

export function restoreState(state) {
    if (!state) return;

    // Restore Config
    if (state.config) Object.assign(AppConfig, state.config);

    // Restore Students
    if (state.students) students = [...state.students];
    
    // Notify App to restore Layout, Activity, and UI (Student Count)
    if (onRestore) {
        onRestore(state);
    }
}

// --- Undo/Redo System ---
export function commitState() {
    // Push current state to history
    const currentState = captureState();
    historyStack.push(JSON.stringify(currentState));

    if (historyStack.length > MAX_HISTORY) {
        historyStack.shift();
    }

    // Clear Redo
    redoStack = [];

    updateUndoRedoButtons();
    triggerAutoSave();
}

export function undo() {
    if (historyStack.length === 0) return;

    // Current state goes to Redo
    const currentState = captureState();
    redoStack.push(JSON.stringify(currentState));

    // Pop from History
    const prevStateJSON = historyStack.pop();
    const prevState = JSON.parse(prevStateJSON);

    restoreState(prevState);
    updateUndoRedoButtons();
    triggerAutoSave();
}

export function redo() {
    if (redoStack.length === 0) return;

    // Current state goes to History
    const currentState = captureState();
    historyStack.push(JSON.stringify(currentState));

    // Pop from Redo
    const nextStateJSON = redoStack.pop();
    const nextState = JSON.parse(nextStateJSON);

    restoreState(nextState);
    updateUndoRedoButtons();
    triggerAutoSave();
}

function updateUndoRedoButtons() {
    const canUndo = historyStack.length > 0;
    const canRedo = redoStack.length > 0;
    if (onUndoRedoUpdate) onUndoRedoUpdate(canUndo, canRedo);
}

// --- Auto Save ---
const DEBOUNCE_DELAY = 1000;
let autoSaveTimer;

export function triggerAutoSave() {
    if (onAutoSaveUpdate) onAutoSaveUpdate('<i class="bi bi-arrow-repeat spin"></i> 儲存中...');

    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        saveToLocal();
    }, DEBOUNCE_DELAY);
}

function saveToLocal() {
    const state = captureState();
    try {
        localStorage.setItem('seatAppAutoSave', JSON.stringify(state));
        if (onAutoSaveUpdate) onAutoSaveUpdate('<i class="bi bi-cloud-check"></i> 已儲存');
    } catch (e) {
        console.error("AutoSave Failed", e);
        if (onAutoSaveUpdate) onAutoSaveUpdate('<i class="bi bi-exclamation-triangle"></i> 儲存失敗');
    }
}

export function tryLoadAutoSave() {
    const saved = localStorage.getItem('seatAppAutoSave');
    if (saved) {
        try {
            const state = JSON.parse(saved);
            // Check if valid state
            if (state.layout || state.students) {
                restoreState(state);
                console.log("Auto-Save restored");
            }
        } catch (e) {
            console.error("Failed to load auto-save", e);
        }
    }
}
