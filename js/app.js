
import * as Config from './modules/config.js';
import * as State from './modules/state.js';
import * as Layout from './modules/layout.js';
import * as Seats from './modules/seats.js';
import * as Lottery from './modules/lottery.js';

$(document).ready(function () {
    // --- Initialization ---

    // 1. Initialize Modules (Dependency Injection)
    State.init({
        onCapture: () => {
             // Capture Activity Name State
            const activityInfo = {
                title: $('#examTitleInput').val(),
                posTop: $('#activity-name-display').css('top'),
                posLeft: $('#activity-name-display').css('left')
            };
            
            return {
                layout: Layout.captureLayoutState().layout,
                activity: activityInfo
            };
        },
        onRestore: (state) => {
            // Restore Activity Name
            if (state.activity) {
                if (state.activity.title !== undefined) {
                    $('#examTitleInput').val(state.activity.title);
                    updateActivityName();
                }
                if (state.activity.posTop && state.activity.posLeft) {
                    $('#activity-name-display').css({
                        top: state.activity.posTop,
                        left: state.activity.posLeft
                    });
                }
            }

            // Restore Layout
            if (state.layout) {
                Layout.restoreLayoutData(state, true); // forceRegen=true
            }

            // Restore Student Count UI
            if (state.students) {
                $('#studentCountBadge').text(`人數: ${state.students.length}`);
            }

            // Assign Seats
            Seats.assignSeats(State.students, State.currentMode);
        },
        onUndoRedoUpdate: (canUndo, canRedo) => {
             $('#btnUndo').prop('disabled', !canUndo);
             $('#btnRedo').prop('disabled', !canRedo);
        },
        onAutoSaveUpdate: (html) => {
             $('#saveStatus').html(html);
        }
    });

    Layout.init({
        onLayoutChange: () => {
             State.commitState();
        }
    });

    Seats.init({
        onStateCommit: () => {
             State.commitState();
        }
    });
    
    // Load Config Interaction
    Config.loadConfig();
    Layout.initInteractions(); // Just to be sure interactions are bound for static elements if any
    
    // Initial UI Sync
    updateActivityName();

    // --- Activity Name Logic ---
    function updateActivityName() {
        const title = $('#examTitleInput').val() || '活動名稱';
        $('#activity-name-display').text(title);
    }
    
    $('#activity-name-display').draggable({
        containment: "#classroom-container",
        stop: function() {
            State.commitState();
        }
    });

    $('#examTitleInput').on('input', function() {
        updateActivityName();
        State.triggerAutoSave();
    }).on('change', function() {
        State.commitState();
    });

    // --- UI Interactions ---

    // Undo/Redo Keys
    $(document).on('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            State.undo();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault();
            State.redo();
        }
    });

    $('#btnUndo').click(State.undo);
    $('#btnRedo').click(State.redo);

    // Snap Toggle
    $('#btnToggleSnap').click(function () {
        const active = !$(this).hasClass('active'); // Toggle based on current class
        $(this).toggleClass('active', active);
        Layout.setEnableSnap(active);
    });

    // Fullscreen Toggle
    $('#btnToggleFullScreen').on('click', function () {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
            $('body').addClass('projection-mode');
        } else {
            document.exitFullscreen();
            $('body').removeClass('projection-mode');
        }
    });
    document.addEventListener('fullscreenchange', (event) => {
        if (!document.fullscreenElement) {
            $('body').removeClass('projection-mode');
        }
    });

    // XLSX Import
    $('#xlsxInput').on('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            let newStudents = [];
            json.forEach(row => {
                row.forEach(cell => {
                    if (cell && cell.toString().trim() !== "") {
                        newStudents.push(cell.toString().trim());
                    }
                });
            });

            State.setStudents(newStudents);
            $('#studentCountBadge').text(`人數: ${newStudents.length}`);
            alert(`成功匯入 ${newStudents.length} 位人員資料！`);
            
            Seats.assignSeats(newStudents, State.currentMode);
            State.commitState();
        };
        reader.readAsArrayBuffer(file);
    });

    // Mode Switch
    $('input[name="modeSwitch"]').on('change', function () {
        if ($('#modeDesk').is(':checked')) {
            State.setCurrentMode('desk');
            $('body').removeClass('mode-seat').addClass('mode-desk');
            // Rebind
            Seats.rebindSeatInteractions('desk');
            // Re-enable Layout dragging
            try { $(".desk-group").draggable("enable"); } catch (e) { }
            try { $(".desk-group").resizable("enable"); } catch (e) { }
        } else {
            State.setCurrentMode('seat');
            $('body').removeClass('mode-desk').addClass('mode-seat');
             // Rebind
            Seats.rebindSeatInteractions('seat');
            // Disable Layout dragging
            try { $(".desk-group").draggable("disable"); } catch (e) { }
            try { $(".desk-group").resizable("disable"); } catch (e) { }
        }
    });


    // --- Persistence (Export/Import) ---
    $('#btnExportLayout').on('click', exportLayout);
    $('#btnExportPDF').on('click', exportPDF);
    $('#btnImportLayout').on('click', function () {
        $('#importInput').click();
    });
    $('#importInput').on('change', importLayout);

    function exportLayout() {
        const state = Layout.captureLayoutState(); // Only layout
        const assignments = Seats.captureAssignments();
        
        // Combine them into export format:
        // We need students logic. In legacy code, it sorted assignments by position and extracted names as student list.
        // Let's replicate this "Sort by Position" logic to define the order of students in the file?
        // Or simply dump the State.students? 
        // Legacy: "Extract names from sorted seats" -> implies visual order matters for the list.
        
        assignments.sort((a, b) => {
             if (Math.abs(a.y - b.y) > 20) return a.y - b.y;
             return a.x - b.x;
        });
        const currentStudents = assignments.filter(s => s.name).map(s => s.name);
        
        const activityInfo = {
            title: $('#examTitleInput').val(),
            posTop: $('#activity-name-display').css('top'),
            posLeft: $('#activity-name-display').css('left')
        };

        const data = {
            students: currentStudents,
            layout: state.layout,
            activity: activityInfo,
            timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        const now = new Date();
        const dateStr = now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') + "_" +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0');

        let title = $('#examTitleInput').val().trim();
        if (!title) title = "座位表";

        a.href = url;
        a.download = `${title}_${dateStr}.json`;
        a.click();
    }

    function exportPDF() {
        const now = new Date();
        const dateStr = now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') + "_" +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0');

        let title = $('#examTitleInput').val().trim();
        if (!title) title = "座位表";
        const filename = `${title}_${dateStr}.pdf`;

        const element = document.getElementById('classroom-container');
        const width = element.offsetWidth;
        const height = element.offsetHeight;
        
        const opt = {
            margin: 0,
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2, 
                useCORS: true,
                windowWidth: width,
                windowHeight: height
            },
            jsPDF: { unit: 'px', format: [width, height], orientation: width > height ? 'landscape' : 'portrait' },
            pagebreak: { mode: 'avoid-all' }
        };

        $('.desk-actions').hide();
        $('.ui-resizable-handle').hide(); // Also hide handles

        html2pdf().set(opt).from(element).save().then(function () {
            $('.desk-actions').show();
            $('.ui-resizable-handle').css('display', '');
        });
    }

    function importLayout(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = JSON.parse(e.target.result);
                // Rely on State.restoreState logic, but data structure might need adapting?
                // Legacy import restoration called `restoreLayoutData` then `assignSeats`.
                // `State.restoreState` does exactly that if we pass checks.
                
                // Construct a strict state object if needed, or pass data as is if compatible
                State.restoreState(data);
                State.commitState();
                alert('匯入成功！');
            } catch (err) {
                console.error(err);
                alert('匯入失敗: 檔案格式錯誤');
            }
        };
        reader.readAsText(file);
        $('#importInput').val('');
    }

    // --- Modal Interactions ---

    // Add Table
    $('#btnAddTableConfirm').on('click', function () {
        const shape = $('#tableShape').val();
        const seatsPerTable = parseInt($('#seatsPerTable').val());
        const count = parseInt($('#tableCount').val());

        for (let i = 0; i < count; i++) {
            Layout.createTableGroup(shape, seatsPerTable);
        }

        $('#modalAddTable').modal('hide');
        Seats.assignSeats(State.students, State.currentMode);
        State.commitState();
    });

    // Add Grid
    $('#btnSingleSeatConfirm').on('click', function () {
        const rows = parseInt($('#gridRows').val());
        const cols = parseInt($('#gridCols').val());

        Layout.createGrid(rows, cols);

        $('#modalSingleSeat').modal('hide');
        Seats.assignSeats(State.students, State.currentMode);
        State.commitState();
    });

    // Add Furniture (Lectern etc) - Handlers
    let pendingFurnitureType = 'lectern';

    const furnitureMap = {
        '#btnAddLectern': { type: 'lectern', title: '新增講台' },
        '#btnAddWhiteboard': { type: 'whiteboard', title: '新增白板' },
        '#btnAddDoor': { type: 'door', title: '新增門' },
        '#btnAddCabinet': { type: 'cabinet', title: '新增櫃子' },
        '#btnAddWindow': { type: 'window', title: '新增窗戶' },
        '#btnAddAirCon': { type: 'aircon', title: '新增冷氣' },
        '#btnAddScreen': { type: 'screen', title: '新增投影幕/電視' },
        '#btnAddPillar': { type: 'pillar', title: '新增柱子' },
        '#btnAddFan': { type: 'fan', title: '新增電扇' },
        '#btnAddTrashCan': { type: 'trashcan', title: '新增垃圾桶' },
        '#btnAddBulletin': { type: 'bulletin', title: '新增佈告欄' },
    };

    Object.keys(furnitureMap).forEach(selector => {
        $(selector).on('click', function() {
            pendingFurnitureType = furnitureMap[selector].type;
            $('#furnitureModalTitle').text(furnitureMap[selector].title);
            $('#modalAddFurniture').modal('show');
        });
    });

    $('#btnAddFurnitureConfirm').on('click', function () {
        const shape = $('#furnitureShape').val();
        Layout.createFurniture(pendingFurnitureType, { params: { shape: shape } });
        $('#modalAddFurniture').modal('hide');
        State.commitState();
    });

    // Settings
    $('#btnApplySettings').on('click', function () {
        Config.AppConfig.fontSize = parseInt($('#settingFontSize').val());
        Config.AppConfig.seatSizeGrid = parseInt($('#settingSizeGrid').val());
        Config.AppConfig.seatSizeRound = parseInt($('#settingSizeRound').val());
        Config.AppConfig.seatSizeRectH = parseInt($('#settingSizeRectH').val());
        Config.AppConfig.seatSizeRectV = parseInt($('#settingSizeRectV').val());

        Config.saveConfig();
        // Redraw
        Layout.redrawLayout();
        Seats.assignSeats(State.students, State.currentMode);
        State.commitState();

        $('#modalSettings').modal('hide');
    });

    // Edit Group (Table / Grid)
    let targetGroupToEdit = null;

    $(document).on('click', '.btn-edit-group', function () {
        const $group = $(this).closest('.desk-group');
        targetGroupToEdit = $group;

        let shape = 'unknown';
        if ($group.find('.table-rect').length) shape = 'rect';
        else if ($group.find('.table-round').length) shape = 'round';
        else if ($group.data('rows')) shape = 'grid';

        if (shape === 'unknown') return;

        if (shape === 'grid') {
            const currentRows = $group.data('rows');
            const currentCols = $group.data('cols');
            $('#editGridRows').val(currentRows);
            $('#editGridCols').val(currentCols);
            $('#modalEditGrid').modal('show');
        } else {
            const currentCount = $group.find('.seat').length;
            $('#editTableChairCount').val(currentCount);
            $('#modalEditTable').modal('show');
        }
    });

    // Save Table Edit
    $('#btnSaveTableEdit').click(function() {
        if (!targetGroupToEdit) return;
        
        const snapshot = Seats.captureAssignments(); // Sticky Logic needs assignments
        
        let shape = 'unknown';
        if (targetGroupToEdit.find('.table-rect').length) shape = 'rect';
        else if (targetGroupToEdit.find('.table-round').length) shape = 'round';

        const newCount = parseInt($('#editTableChairCount').val());
        if (isNaN(newCount) || newCount < 1) return;

        const pos = targetGroupToEdit.position();
        targetGroupToEdit.remove();
        
        Layout.createTableGroup(shape, newCount, { x: pos.left, y: pos.top });
        
        $('#modalEditTable').modal('hide');
        targetGroupToEdit = null;
        
        Seats.assignSeats(State.students, State.currentMode, snapshot);
        State.commitState();
    });

    // Save Grid Edit
    $('#btnSaveGridEdit').click(function() {
        if (!targetGroupToEdit) return;
        
        const snapshot = Seats.captureAssignments();
        
        const newRows = parseInt($('#editGridRows').val());
        const newCols = parseInt($('#editGridCols').val());
        
        if (isNaN(newRows) || isNaN(newCols) || newRows < 1 || newCols < 1) return;

        const pos = targetGroupToEdit.position();
        targetGroupToEdit.remove();
        
        Layout.createGrid(newRows, newCols, { x: pos.left, y: pos.top });
        
        $('#modalEditGrid').modal('hide');
        targetGroupToEdit = null;
        
        Seats.assignSeats(State.students, State.currentMode, snapshot);
        State.commitState();
    });

    // Delete Object
    let targetObjectToRemove = null;
    $(document).on('click', '.btn-delete-group', function () {
        targetObjectToRemove = $(this).closest('.desk-group');
        $('#modalConfirmDeleteObject').modal('show');
    });

    $('#btnConfirmDeleteObject').click(function() {
        if(targetObjectToRemove) {
            const snapshot = Seats.captureAssignments();
            targetObjectToRemove.remove();
            targetObjectToRemove = null;
            $('#modalConfirmDeleteObject').modal('hide');
            
            Seats.assignSeats(State.students, State.currentMode, snapshot);
            State.commitState();
        }
    });

    // Delete Seat (Context Menu)
    let seatToRemove = null;
    $('#seat-layer').on('contextmenu', '.seat', function (e) {
        if ($('body').hasClass('mode-seat')) return; 
        e.preventDefault();
        seatToRemove = $(this);
        $('#modalConfirmDelete').modal('show');
    });
    $('#btnConfirmDeleteSeat').click(function() {
        if (seatToRemove) {
            seatToRemove.remove();
            seatToRemove = null;
            $('#modalConfirmDelete').modal('hide');
            Seats.assignSeats(State.students, State.currentMode);
            State.commitState();
        }
    });

    // --- Lottery ---
    $('#modalLottery').on('show.bs.modal', function () {
        const exclude = $('#lotteryExclude').is(':checked');
        const pool = Lottery.getLotteryCandidates(exclude);
        $('#lotteryPoolSize').text(`名單剩餘: ${pool.length} 人`);
        $('#lotteryCount').attr('max', pool.length > 0 ? pool.length : 1);
        if (pool.length === 0) $('#lotteryCount').val(0);
        else if ($('#lotteryCount').val() > pool.length) $('#lotteryCount').val(pool.length);
    });

    $('#lotteryExclude').on('change', function() {
        const exclude = $(this).is(':checked');
        const pool = Lottery.getLotteryCandidates(exclude);
        $('#lotteryPoolSize').text(`名單剩餘: ${pool.length} 人`);
        $('#lotteryCount').attr('max', pool.length > 0 ? pool.length : 1);
    });

    $('#btnStartLottery').click(function() {
        const count = parseInt($('#lotteryCount').val()) || 1;
        const exclude = $('#lotteryExclude').is(':checked');
        
        Lottery.startLottery(count, exclude, () => {
             $('#modalLottery').modal('hide');
        });
    });

    $('#btnResetLotteryHistory').click(function() {
        if(confirm('確定要清除所有已抽籤紀錄嗎？')) {
            Lottery.resetHistory();
            const exclude = $('#lotteryExclude').is(':checked');
            const pool = Lottery.getLotteryCandidates(exclude);
            $('#lotteryPoolSize').text(`名單剩餘: ${pool.length} 人`);
        }
    });

});
