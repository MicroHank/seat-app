
import { AppConfig, loadConfig, saveConfig } from './modules/config.js';
import { state } from './modules/state.js';
import { updateActivityName, showAppAlert, showAppConfirm } from './modules/utils.js';
import { createTableGroup, createGrid, createFurniture, setupItems } from './modules/items.js';
import { tryLoadAutoSave, saveToLocal, exportLayout, importLayout, exportPDF, restoreLayoutData, assignSeats, captureAssignments, captureState } from './modules/layout.js';
import { initLottery } from './modules/lottery.js';
import { initClassManager } from './modules/classManager.js';

$(document).ready(function () {

    // --- Init ---
    loadConfig();
    setupItems(saveToLocal, state.enableSnap); // Inject dependency
    
    // Listeners for Item Actions (Delete, Edit) - Needs to be global or attached here
    // But items.js creates elements with these classes. 
    // We can use $(document).on here.

    // --- Global Event Listeners ---

    // Activity Name
    $('#activity-name-display').draggable({
        containment: "#classroom-container",
        stop: function () { saveToLocal(); }
    });
    
    $('#examTitleInput').on('input', function () {
        updateActivityName();
        // Debounce auto-save handled by layout helper? 
        // We can just saveToLocal directly or use a debounced global if we cared.
        // Original had "triggerAutoSave" with debounce.
        // Let's reimplement simple debounce here or in utils.
        clearTimeout(window._autoSaveTimer);
        window._autoSaveTimer = setTimeout(saveToLocal, 1000);
    }).on('change', function () {
        saveToLocal();
    });
    
    updateActivityName(); // Init

    // Mode Switch
    $('input[name="modeSwitch"]').on('change', function () {
        if ($('#modeDesk').is(':checked')) {
            state.currentMode = 'desk';
        } else {
            state.currentMode = 'seat';
        }
        applyModeState();
    });

    function applyModeState() {
        if (state.currentMode === 'desk') {
            $('body').removeClass('mode-seat').addClass('mode-desk');
            try { $(".desk-group").draggable("enable"); } catch (e) { }
            try { $(".desk-group").resizable("enable"); } catch (e) { }
            try { $(".seat").draggable("disable"); } catch (e) { }
            try { $(".seat").droppable("disable"); } catch (e) { }
        } else {
            $('body').removeClass('mode-desk').addClass('mode-seat');
            try { $(".desk-group").draggable("disable"); } catch (e) { }
            try { $(".desk-group").resizable("disable"); } catch (e) { }
            
            // Seat Swap Logic
            try { $(".seat").draggable("destroy"); } catch (e) { }
            $(".seat").draggable({
                helper: function () {
                    const text = $(this).text();
                    return $(`<div class="seat-drag-helper">${text}</div>`);
                },
                appendTo: "body", cursor: "grabbing", cursorAt: { top: 20, left: 20 },
                zIndex: 1000, disabled: true
            });
            
            $(".seat").droppable({
                accept: ".seat.filled",
                disabled: true, tolerance: "touch", hoverClass: "ui-droppable-hover",
                drop: function (event, ui) {
                    const $source = ui.draggable;
                    const $target = $(this);
                    const sourceName = $source.text();
                    const targetName = $target.text();

                    $target.text(sourceName).addClass('filled').addClass('highlighted');
                    $target.on('animationend', function () { $(this).removeClass('highlighted'); });
                    $target.draggable("enable");

                    if (targetName) {
                        $source.text(targetName).addClass('filled').addClass('highlighted');
                        $source.on('animationend', function () { $(this).removeClass('highlighted'); });
                        $source.draggable("enable");
                    } else {
                        $source.text('').removeClass('filled');
                        $source.draggable("disable");
                    }
                    
                    const fontSize = AppConfig.fontSize;
                    $source.css('font-size', fontSize + 'px');
                    $target.css('font-size', fontSize + 'px');

                    saveToLocal();
                }
            });
            
            try { $(".seat.filled").draggable("enable"); } catch (e) { }
            try { $(".seat").droppable("enable"); } catch (e) { }
        }
    }

    // Fullscreen
    $('#btnToggleFullScreen').on('click', function () {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                showAppAlert(`Error: ${err.message}`);
            });
            $('body').addClass('projection-mode');
        } else {
            document.exitFullscreen();
            $('body').removeClass('projection-mode');
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) $('body').removeClass('projection-mode');
    });

    // Menus & Modals
    // Add Table
    $('#btnAddTableConfirm').on('click', function () {
        const shape = $('#tableShape').val();
        const seatsPerTable = parseInt($('#seatsPerTable').val());
        const count = parseInt($('#tableCount').val());
        for (let i = 0; i < count; i++) {
            createTableGroup(shape, seatsPerTable);
        }
        $('#modalAddTable').modal('hide');
        assignSeats();
        saveToLocal();
    });

    // Add Grid
    $('#btnSingleSeatConfirm').on('click', function () {
        const rows = parseInt($('#gridRows').val());
        const cols = parseInt($('#gridCols').val());
        createGrid(rows, cols);
        $('#modalSingleSeat').modal('hide');
        assignSeats();
        saveToLocal();
    });

    // Furniture
    let pendingFurnitureType = 'lectern';
    const furnitureMap = {
        'btnAddLectern': { type: 'lectern', title: '新增講台' },
        'btnAddWhiteboard': { type: 'whiteboard', title: '新增白板' },
        'btnAddDoor': { type: 'door', title: '新增門' },
        'btnAddCabinet': { type: 'cabinet', title: '新增櫃子' },
        'btnAddWindow': { type: 'window', title: '新增窗戶' },
        'btnAddAirCon': { type: 'aircon', title: '新增冷氣' },
        'btnAddScreen': { type: 'screen', title: '新增投影幕/電視' },
        'btnAddPillar': { type: 'pillar', title: '新增柱子' },
        'btnAddFan': { type: 'fan', title: '新增電扇' },
        'btnAddTrashCan': { type: 'trashcan', title: '新增垃圾桶' },
        'btnAddBulletin': { type: 'bulletin', title: '新增佈告欄' }
    };

    Object.keys(furnitureMap).forEach(id => {
        $(`#${id}`).on('click', function () {
            const info = furnitureMap[id];
            pendingFurnitureType = info.type;
            $('#furnitureModalTitle').text(info.title);
            $('#modalAddFurniture').modal('show');
        });
    });

    $('#btnAddFurnitureConfirm').on('click', function () {
        const shape = $('#furnitureShape').val();
        createFurniture(pendingFurnitureType, { params: { shape: shape } });
        $('#modalAddFurniture').modal('hide');
        saveToLocal();
    });

    // Settings
    $('#btnApplySettings').on('click', function () {
        AppConfig.fontSize = parseInt($('#settingFontSize').val());
        AppConfig.seatSizeGrid = parseInt($('#settingSizeGrid').val());
        AppConfig.seatSizeRound = parseInt($('#settingSizeRound').val());
        AppConfig.seatSizeRectH = parseInt($('#settingSizeRectH').val());
        AppConfig.seatSizeRectV = parseInt($('#settingSizeRectV').val());
        saveConfig();
        
        // Redraw
        const layoutData = captureState(); // Uses captureLayoutState internally
        $('#seat-layer').empty();
        restoreLayoutData(layoutData, true);
        assignSeats();
        saveToLocal();
        $('#modalSettings').modal('hide');
    });

    // Persistence Buttons
    $('#btnExportLayout').on('click', exportLayout);
    $('#btnExportPDF').on('click', exportPDF);
    $('#btnImportLayout').on('click', function () { $('#importInput').click(); });
    $('#importInput').on('change', function(e) { importLayout(e.target.files[0]); $(this).val(''); });

    // Item Action Listeners (Delegated)
    let targetObjectToRemove = null;
    let targetGroupToEdit = null;

    $(document).on('click', '.btn-delete-group', function () {
        targetObjectToRemove = $(this).closest('.desk-group');
        $('#modalConfirmDeleteObject').modal('show');
    });

    $('#btnConfirmDeleteObject').click(function () {
        if (targetObjectToRemove) {
            const snapshot = captureAssignments();
            targetObjectToRemove.remove();
            targetObjectToRemove = null;
            $('#modalConfirmDeleteObject').modal('hide');
            assignSeats(snapshot);
            saveToLocal();
        }
    });

    $(document).on('click', '.btn-duplicate-group', function () {
        const $group = $(this).closest('.desk-group');
        const pos = $group.position();
        const width = $group.width();
        const height = $group.height();
        const newX = pos.left + 30;
        const newY = pos.top + 30;

        // Clone logic handled by re-creating with new coords
        // We need to inspect element to know what it is.
        // Or simpler: clone the DOM element and re-initialize generic interaction?
        // But our `createX` logic sets up specific CSS/Classes.
        // Let's reuse logic from original app.js which inspected DOM.
        
        if ($group.data('rows')) {
            createGrid($group.data('rows'), $group.data('cols'), { x: newX, y: newY, w: width, h: height });
        } else if ($group.find('.table-round').length) {
            const seats = $group.find('.seat').length;
            createTableGroup('round', seats, { x: newX, y: newY, w: width, h: height, forceRegen: true });
        } else if ($group.find('.table-rect').length) {
            const seats = $group.find('.seat').length;
            const type = $group.find('.vertical-table').length ? 'rect_v' : 'rect_h';
            createTableGroup(type, seats, { x: newX, y: newY, w: width, h: height, forceRegen: true });
        } else {
            // Furniture
            const classes = $group.find('.table-shape').attr('class') || '';
            let type = '';
            if (classes.includes('table-lectern')) type = 'lectern';
            else if (classes.includes('table-whiteboard')) type = 'whiteboard';
            else if (classes.includes('table-door')) type = 'door';
            else if (classes.includes('table-cabinet')) type = 'cabinet';
            else if (classes.includes('table-window')) type = 'window';
            else if (classes.includes('table-aircon')) type = 'aircon';
            else if (classes.includes('table-screen')) type = 'screen';
            else if (classes.includes('table-pillar')) type = 'pillar';
            else if (classes.includes('table-fan')) type = 'fan';
            else if (classes.includes('table-trashcan')) type = 'trashcan';
            else if (classes.includes('table-bulletin')) type = 'bulletin';

            if (type) {
                const isVertical = $group.find('.vertical-text').length > 0;
                createFurniture(type, { x: newX, y: newY, w: width, h: height, params: { shape: isVertical ? 'vertical' : 'horizontal' } });
            }
        }
        assignSeats();
        saveToLocal();
    });

    $(document).on('click', '.btn-edit-group', function () {
        const $group = $(this).closest('.desk-group');
        targetGroupToEdit = $group;

        let shape = 'unknown';
        if ($group.find('.table-rect').length) shape = 'rect';
        else if ($group.find('.table-round').length) shape = 'round';
        else if ($group.data('rows')) shape = 'grid';

        if (shape === 'unknown') return;

        if (shape === 'grid') {
            $('#editGridRows').val($group.data('rows'));
            $('#editGridCols').val($group.data('cols'));
            $('#modalEditGrid').modal('show');
        } else {
            const currentCount = $group.find('.seat').length;
            $('#editTableChairCount').val(currentCount);
            $('#modalEditTable').modal('show');
        }
    });

    $('#btnSaveTableEdit').click(function () {
        if (!targetGroupToEdit) return;
        const snapshot = captureAssignments();
        
        let shape = 'unknown';
        if (targetGroupToEdit.find('.table-rect').length) shape = 'rect'; // Needs refinement for rect_v/h?
        // createTableGroup auto-detects rect_h vs rect_v based on shape string? 
        // No, we pass shape string.
        // We need to know if it was vertical.
        if (targetGroupToEdit.find('.vertical-table').length) shape = 'rect_v';
        else if (targetGroupToEdit.find('.table-rect').length) shape = 'rect_h';
        else if (targetGroupToEdit.find('.table-round').length) shape = 'round';

        const newCount = parseInt($('#editTableChairCount').val());
        const pos = targetGroupToEdit.position();
        targetGroupToEdit.remove();

        createTableGroup(shape, newCount, { x: pos.left, y: pos.top });
        $('#modalEditTable').modal('hide');
        targetGroupToEdit = null;
        
        assignSeats(snapshot);
        saveToLocal();
    });

    $('#btnSaveGridEdit').click(function () {
        if (!targetGroupToEdit) return;
        const snapshot = captureAssignments();
        
        const newRows = parseInt($('#editGridRows').val());
        const newCols = parseInt($('#editGridCols').val());
        const pos = targetGroupToEdit.position();
        targetGroupToEdit.remove();
        
        createGrid(newRows, newCols, { x: pos.left, y: pos.top });
        $('#modalEditGrid').modal('hide');
        targetGroupToEdit = null;
        
        assignSeats(snapshot);
        saveToLocal();
    });

    // Seat Delete
    let seatToRemove = null;
    $('#seat-layer').on('contextmenu', '.seat', function (e) {
        if (state.currentMode === 'seat') return; // Only desk mode?
        e.preventDefault();
        seatToRemove = $(this);
        $('#modalConfirmDelete').modal('show');
    });

    $('#btnConfirmDeleteSeat').click(function () {
        if (seatToRemove) {
            seatToRemove.remove();
            seatToRemove = null;
            $('#modalConfirmDelete').modal('hide');
            assignSeats();
            saveToLocal();
        }
    });

    // Init sub-modules
    initLottery();
    initClassManager();
    tryLoadAutoSave();

    // Initial Apply Mode
    applyModeState();

});
