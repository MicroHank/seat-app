
import { AppConfig, loadConfig, saveConfig } from './config.js';
import { state } from './state.js';
import { createTableGroup, createGrid, createFurniture, setupItems } from './items.js';
import { updateActivityName, updateStudentCountBadge, showAppAlert } from './utils.js';

// --- Layout State Logic ---

export function captureLayoutState() {
    const layout = [];
    $('.desk-group').each(function () {
        const $el = $(this);
        const pos = $el.position();
        const width = $el.width();
        const height = $el.height();

        const seatsData = [];
        $el.find('.seat').each(function () {
            const $s = $(this);
            seatsData.push({
                x: parseFloat($s.css('left')),
                y: parseFloat($s.css('top'))
            });
        });

        let type = 'unknown';
        let params = {};

        if ($el.find('.table-round').length > 0) {
            type = 'round';
        } else if ($el.find('.table-rect').length > 0) {
            if ($el.find('.vertical-table').length > 0) type = 'rect_v';
            else type = 'rect_h';
        } else if ($el.find('.table-lectern').length > 0) {
            type = 'lectern';
            params.shape = $el.find('.vertical-text').length > 0 ? 'vertical' : 'horizontal';
        } else if ($el.find('.table-whiteboard').length > 0) {
            type = 'whiteboard';
            params.shape = $el.find('.vertical-text').length > 0 ? 'vertical' : 'horizontal';
        } else if ($el.find('.table-door').length > 0) {
            type = 'door';
            params.shape = $el.find('.vertical-text').length > 0 ? 'vertical' : 'horizontal';
        } else if ($el.find('.table-cabinet').length > 0) {
            type = 'cabinet';
            params.shape = $el.find('.vertical-text').length > 0 ? 'vertical' : 'horizontal';
        } else if ($el.find('.table-window').length > 0) {
            type = 'window';
            params.shape = $el.find('.vertical-text').length > 0 ? 'vertical' : 'horizontal';
        } else if ($el.find('.table-aircon').length > 0) {
            type = 'aircon';
            params.shape = $el.find('.vertical-text').length > 0 ? 'vertical' : 'horizontal';
        } else if ($el.find('.table-screen').length > 0) {
            type = 'screen';
            params.shape = $el.find('.vertical-text').length > 0 ? 'vertical' : 'horizontal';
        } else if ($el.find('.table-pillar').length > 0) {
            type = 'pillar';
            params.shape = $el.find('.vertical-text').length > 0 ? 'vertical' : 'horizontal';
        } else if ($el.find('.table-fan').length > 0) {
            type = 'fan';
        } else if ($el.find('.table-trashcan').length > 0) {
            type = 'trashcan';
        } else if ($el.find('.table-bulletin').length > 0) {
            type = 'bulletin';
            params.shape = $el.find('.vertical-text').length > 0 ? 'vertical' : 'horizontal';
        } else {
            type = 'grid';
            params.rows = $el.data('rows') || 1;
            params.cols = $el.data('cols') || 1;
        }
        params.seats = seatsData;

        layout.push({
            type: type,
            x: pos.left, y: pos.top, w: width, h: height,
            params: params
        });
    });

    return { layout: layout };
}

export function restoreLayoutData(data, forceRegen = false) {
    if (data.students) {
        state.students = data.students; 
        if (data.currentClassName) {
            state.currentClassName = data.currentClassName;
        } else {
            state.currentClassName = '';
        }
        updateStudentCountBadge();
    }

    if (data.layout) {
        $('#seat-layer').empty();

        data.layout.forEach(item => {
            const restoreConfig = {
                x: item.x, y: item.y, w: item.w, h: item.h,
                params: item.params,
                forceRegen: forceRegen
            };

            if (item.type === 'round' || item.type === 'rect' || item.type === 'rect_h' || item.type === 'rect_v') {
                const count = item.params.seats ? item.params.seats.length : 0;
                createTableGroup(item.type, count, restoreConfig);
            } else if (item.type === 'grid') {
                createGrid(item.params.rows, item.params.cols, restoreConfig);
            } else {
                createFurniture(item.type, restoreConfig);
            }
        });

        assignSeats();
    }
}

export function assignSeats(previousAssignments = null) {
    $('.seat').removeClass('filled').text('');
    let seatList = [];

    $('.seat').each(function () {
        const rect = this.getBoundingClientRect();
        seatList.push({
            element: $(this),
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            assigned: false
        });
    });

    const usedNames = new Set();

    if (previousAssignments) {
        previousAssignments.forEach(prev => {
            let nearest = null;
            let minDist = Infinity;
            seatList.forEach(seat => {
                if (!seat.assigned) {
                    const dist = Math.hypot(seat.x - prev.x, seat.y - prev.y);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = seat;
                    }
                }
            });

            if (nearest) {
                nearest.element.addClass('filled').text(prev.name);
                nearest.assigned = true;
                adjustFontSize(nearest.element);
                usedNames.add(prev.name);
            }
        });
    }

    seatList.sort((a, b) => {
        if (Math.abs(a.y - b.y) > 20) return a.y - b.y;
        return a.x - b.x;
    });

    let studentIndex = 0;
    seatList.forEach(seat => {
        if (!seat.assigned) {
            while (studentIndex < state.students.length && usedNames.has(state.students[studentIndex])) {
                studentIndex++;
            }
            if (studentIndex < state.students.length) {
                const name = state.students[studentIndex];
                seat.element.addClass('filled').text(name);
                adjustFontSize(seat.element);
                usedNames.add(name);
                studentIndex++;
            }
        }
    });
}

function adjustFontSize($el) {
    $el.css('font-size', AppConfig.fontSize + 'px');
}

export function captureAssignments() {
    const assignments = [];
    $('.seat.filled').each(function () {
        const rect = this.getBoundingClientRect();
        assignments.push({
            name: $(this).text(),
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        });
    });
    return assignments;
}

// --- App Global State ---

export function captureState() {
    const layoutData = captureLayoutState();
    const activityInfo = {
        title: $('#examTitleInput').val(),
        posTop: $('#activity-name-display').css('top'),
        posLeft: $('#activity-name-display').css('left')
    };

    return {
        students: [...state.students],
        currentClassName: state.currentClassName,
        layout: layoutData.layout,
        config: { ...AppConfig },
        activity: activityInfo,
        timestamp: Date.now()
    };
}

export function restoreState(savedState) {
    if (!savedState) return;

    if (savedState.config) Object.assign(AppConfig, savedState.config);
    if (savedState.students) state.students = [...savedState.students];
    if (savedState.currentClassName) state.currentClassName = savedState.currentClassName;
    updateStudentCountBadge();

    if (savedState.activity) {
        if (savedState.activity.title !== undefined) {
            $('#examTitleInput').val(savedState.activity.title);
            updateActivityName();
        }
        if (savedState.activity.posTop && savedState.activity.posLeft) {
            $('#activity-name-display').css({
                top: savedState.activity.posTop,
                left: savedState.activity.posLeft
            });
        }
    }

    $('#seat-layer').empty();
    restoreLayoutData(savedState, true);
    assignSeats();
}

// --- Persistence ---

export function saveToLocal() {
    const stateData = captureState();
    try {
        localStorage.setItem('seatAppAutoSave', JSON.stringify(stateData));
        $('#saveStatus').html('<i class="bi bi-cloud-check"></i> 已儲存');
    } catch (e) {
        console.error("AutoSave Failed", e);
        $('#saveStatus').html('<i class="bi bi-exclamation-triangle"></i> 儲存失敗');
    }
}

export function tryLoadAutoSave() {
    const saved = localStorage.getItem('seatAppAutoSave');
    if (saved) {
        try {
            const stateData = JSON.parse(saved);
            if (stateData.layout || stateData.students) {
                restoreState(stateData);
                console.log("Auto-Save restored");
            }
        } catch (e) {
            console.error("Failed to load auto-save", e);
        }
    }
}

// --- Import / Export ---

export function exportLayout() {
    const layoutState = captureLayoutState();
    const layout = layoutState.layout;

    let $allSeats = $('.seat');
    let seatList = [];
    $allSeats.each(function () {
        const rect = this.getBoundingClientRect();
        seatList.push({
            element: $(this),
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            text: $(this).text()
        });
    });

    seatList.sort((a, b) => {
        if (Math.abs(a.y - b.y) > 20) return a.y - b.y;
        return a.x - b.x;
    });

    const currentStudents = seatList.filter(s => s.text).map(s => s.text);
    const activityInfo = {
        title: $('#examTitleInput').val(),
        posTop: $('#activity-name-display').css('top'),
        posLeft: $('#activity-name-display').css('left')
    };

    const data = {
        students: currentStudents,
        layout: layout,
        activity: activityInfo,
        currentClassName: state.currentClassName,
        classes: state.classLists, // Assuming synced in state
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

export function importLayout(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            restoreLayoutData(data); // Will update state.students

            if (data.activity) {
                if (data.activity.title !== undefined) {
                    $('#examTitleInput').val(data.activity.title);
                    updateActivityName();
                }
                if (data.activity.posTop && data.activity.posLeft) {
                    $('#activity-name-display').css({
                        top: data.activity.posTop,
                        left: data.activity.posLeft
                    });
                }
            }

            if (data.classes) {
                state.classLists = data.classes;
                // Need to persist this? 
                // There is saveClassLists in app.js. 
                // Ideally layout.js triggers a save event or we move class list logic here.
                // For now let's just update state.
                localStorage.setItem('seatAppClassLists', JSON.stringify(state.classLists));
                // app.js listener should pick up? No. 
                // We might need to reload class manager UI.
            }

            saveToLocal(); // Commit
            showAppAlert('匯入成功！');
        } catch (err) {
            console.error(err);
            showAppAlert('匯入失敗: 檔案格式錯誤');
        }
    };
    reader.readAsText(file);
}

export function exportPDF() {
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
    $('.ui-resizable-handle').hide();

    html2pdf().set(opt).from(element).save().then(function () {
        $('.desk-actions').show();
        $('.ui-resizable-handle').css('display', '');
    });
}
