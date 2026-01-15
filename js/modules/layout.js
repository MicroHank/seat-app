// Layout Module
import { AppConfig, getSeatSize } from './config.js';

let enableSnap = false;
let onLayoutChange = null; // Callback for when layout changes (drag stop, resize stop)
const SNAP_SIZE = 20;

export function init(callbacks) {
    if (callbacks.onLayoutChange) onLayoutChange = callbacks.onLayoutChange;
}

export function setEnableSnap(enabled) {
    enableSnap = enabled;
    updateDraggableSnap();
}

function updateDraggableSnap() {
    try {
        const options = enableSnap ? { grid: [SNAP_SIZE, SNAP_SIZE] } : { grid: false };
        $(".desk-group.ui-draggable").draggable("option", options);
    } catch (e) { console.warn(e); }
}

export function redrawLayout() {
    const layoutData = captureLayoutState();
    $('#seat-layer').empty();
    restoreLayoutData(layoutData, true);
    // Note: App needs to call assignSeats after this
}

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
            if ($el.find('.vertical-table').length > 0) {
                type = 'rect_v';
            } else {
                type = 'rect_h';
            }
        } else if ($el.find('.table-lectern').length > 0) {
            type = 'lectern';
            const isVertical = $el.find('.vertical-text').length > 0;
            params.shape = isVertical ? 'vertical' : 'horizontal';
        } else if ($el.find('.table-whiteboard').length > 0) {
            type = 'whiteboard';
            const isVertical = $el.find('.vertical-text').length > 0;
            params.shape = isVertical ? 'vertical' : 'horizontal';
        } else if ($el.find('.table-door').length > 0) {
            type = 'door';
            const isVertical = $el.find('.vertical-text').length > 0;
            params.shape = isVertical ? 'vertical' : 'horizontal';
        } else if ($el.find('.table-cabinet').length > 0) {
            type = 'cabinet';
            const isVertical = $el.find('.vertical-text').length > 0;
            params.shape = isVertical ? 'vertical' : 'horizontal';
        } else if ($el.find('.table-window').length > 0) {
            type = 'window';
            const isVertical = $el.find('.vertical-text').length > 0;
            params.shape = isVertical ? 'vertical' : 'horizontal';
        } else if ($el.find('.table-aircon').length > 0) {
            type = 'aircon';
            const isVertical = $el.find('.vertical-text').length > 0;
            params.shape = isVertical ? 'vertical' : 'horizontal';
        } else if ($el.find('.table-screen').length > 0) {
            type = 'screen';
            const isVertical = $el.find('.vertical-text').length > 0;
            params.shape = isVertical ? 'vertical' : 'horizontal';
        } else if ($el.find('.table-pillar').length > 0) {
            type = 'pillar';
            const isVertical = $el.find('.vertical-text').length > 0;
            params.shape = isVertical ? 'vertical' : 'horizontal';
        } else if ($el.find('.table-fan').length > 0) {
            type = 'fan';
        } else if ($el.find('.table-trashcan').length > 0) {
            type = 'trashcan';
        } else if ($el.find('.table-bulletin').length > 0) {
            type = 'bulletin';
            const isVertical = $el.find('.vertical-text').length > 0;
            params.shape = isVertical ? 'vertical' : 'horizontal';
        } else {
            type = 'grid';
            params.rows = $el.data('rows') || 1;
            params.cols = $el.data('cols') || 1;
        }
        params.seats = seatsData;

        layout.push({
            type: type,
            x: pos.left,
            y: pos.top,
            w: width,
            h: height,
            params: params
        });
    });

    return { layout: layout };
}

export function restoreLayoutData(data, forceRegen = false) {
    if (data.layout) {
        // Clear Canvas
        $('#seat-layer').empty();

        data.layout.forEach(item => {
            const restoreConfig = {
                x: item.x,
                y: item.y,
                w: item.w,
                h: item.h,
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
    }
}

export function initInteractions() {
    const dragOptions = {
        containment: "#classroom-container",
        scroll: false,
        stack: ".desk-group",
        cancel: ".ui-resizable-handle",
        start: function (e, ui) { },
        stop: function (e, ui) {
            if(onLayoutChange) onLayoutChange();
        }
    };

    if (enableSnap) {
        dragOptions.grid = [SNAP_SIZE, SNAP_SIZE];
    }

    $(".desk-group:not(.ui-draggable)").draggable(dragOptions);

    $(".desk-group:not(.ui-resizable)").each(function () {
        const originalW = $(this).width();
        const originalH = $(this).height();
        $(this).data('orig-w', originalW);
        $(this).data('orig-h', originalH);

        $(this).resizable({
            aspectRatio: false,
            handles: 'se',
            resize: function (event, ui) {
                const $content = $(this).find('.desk-content');
                const baseW = parseFloat($content.css('width'));
                const baseH = parseFloat($content.css('height'));

                const newW = ui.size.width;
                const newH = ui.size.height;

                const scaleX = newW / baseW;
                const scaleY = newH / baseH;

                $content.css({
                    'transform': `scale(${scaleX}, ${scaleY})`
                });
            },
            stop: function (event, ui) {
                if(onLayoutChange) onLayoutChange();
            }
        });
    });
}

export function createTableGroup(shape, seatCount, restoreConfig = null) {
    const containerW = $('#classroom-container').width();
    const containerH = $('#classroom-container').height();

    let startX, startY;

    if (restoreConfig) {
        startX = restoreConfig.x;
        startY = restoreConfig.y;
    } else {
        startX = Math.random() * (containerW - 200) + 50;
        startY = Math.random() * (containerH - 200) + 50;
    }

    const $group = $(`<div class="desk-group" style="left: ${startX}px; top: ${startY}px;"></div>`);
    const $content = $(`<div class="desk-content"></div>`);
    const $actions = $(`<div class="desk-actions">
        <i class="bi bi-pencil-fill btn-edit-group" title="Edit Seat Count"></i>
        <i class="bi bi-x-lg btn-delete-group" title="Remove Table"></i>
    </div>`);

    $group.append($actions);

    let initialW, initialH;

    if (shape === 'round') {
        const seatSz = getSeatSize('round') || 60;
        let radius = Math.max(70, (seatCount * (seatSz + 5)) / (2 * Math.PI));
        let tableDiameter = (radius - (seatSz / 2) - 10) * 2;

        const $table = $(`<div class="table-shape table-round">Table</div>`);
        $table.css({
            width: tableDiameter + 'px',
            height: tableDiameter + 'px',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
        });
        $content.append($table);

        const size = radius * 2 + seatSz;
        initialW = size;
        initialH = size;
        $group.css({ width: size, height: size });
        $content.css({ width: size, height: size });

        const regenerate = (restoreConfig && restoreConfig.forceRegen);

        if (restoreConfig && restoreConfig.params && restoreConfig.params.seats && !regenerate) {
            restoreConfig.params.seats.forEach(s => {
                const $seat = $(`<div class="seat"></div>`);
                $seat.css({ left: s.x, top: s.y });
                $content.append($seat);
            });
        } else {
            const centerX = size / 2;
            const centerY = size / 2;
            for (let i = 0; i < seatCount; i++) {
                const angle = (i * 2 * Math.PI) / seatCount;
                const left = centerX + Math.cos(angle) * radius - (seatSz / 2);
                const top = centerY + Math.sin(angle) * radius - (seatSz / 2);
                const $seat = $(`<div class="seat"></div>`);
                $seat.css({
                    left: left,
                    top: top,
                    width: seatSz + 'px',
                    height: seatSz + 'px'
                });
                $content.append($seat);
            }
        }

    } else if (shape === 'rect' || shape === 'rect_h') {
        const seatSz = getSeatSize('rect_h');
        const half = Math.ceil(seatCount / 2);
        const tableWidth = half * (seatSz + 10);
        const tableHeight = seatSz * 1;

        const groupW = tableWidth;
        const groupH = tableHeight + (seatSz * 2) + 20;

        initialW = groupW;
        initialH = groupH;

        $group.css({ width: groupW, height: groupH });
        $content.css({ width: groupW, height: groupH });

        const $table = $(`<div class="table-shape table-rect"></div>`);
        $table.css({
            width: tableWidth,
            height: tableHeight,
            position: 'absolute',
            top: (groupH - tableHeight) / 2,
            left: (groupW - tableWidth) / 2
        });
        $content.append($table);

        const regenerate = (restoreConfig && restoreConfig.forceRegen);

        if (restoreConfig && restoreConfig.params && restoreConfig.params.seats && !regenerate) {
            restoreConfig.params.seats.forEach(s => {
                const $seat = $(`<div class="seat"></div>`);
                $seat.css({ left: s.x, top: s.y, width: seatSz + 'px', height: seatSz + 'px' });
                $content.append($seat);
            });
        } else {
            for (let i = 0; i < seatCount; i++) {
                const $seat = $(`<div class="seat"></div>`);
                let top, left;
                if (i < half) {
                    top = (groupH - tableHeight) / 2 - seatSz - 5;
                    left = 5 + i * (seatSz + 10);
                } else {
                    const idx = i - half;
                    top = (groupH - tableHeight) / 2 + tableHeight + 5;
                    left = 5 + idx * (seatSz + 10);
                }
                $seat.css({ top: top, left: left, width: seatSz + 'px', height: seatSz + 'px' });
                $content.append($seat);
            }
        }
    } else if (shape === 'rect_v') {
        const seatSz = getSeatSize('rect_v');
        const half = Math.ceil(seatCount / 2);
        const tableWidth = seatSz * 1;
        const tableHeight = half * (seatSz + 10);

        const groupW = tableWidth + (seatSz * 2) + 20;
        const groupH = tableHeight;

        initialW = groupW;
        initialH = groupH;

        $group.css({ width: groupW, height: groupH });
        $content.css({ width: groupW, height: groupH });

        const $table = $(`<div class="table-shape table-rect vertical-table"></div>`);
        $table.css({
            width: tableWidth,
            height: tableHeight,
            position: 'absolute',
            top: (groupH - tableHeight) / 2,
            left: (groupW - tableWidth) / 2
        });
        $content.append($table);

        const regenerate = (restoreConfig && restoreConfig.forceRegen);

        if (restoreConfig && restoreConfig.params && restoreConfig.params.seats && !regenerate) {
            restoreConfig.params.seats.forEach(s => {
                const $seat = $(`<div class="seat"></div>`);
                $seat.css({ left: s.x, top: s.y, width: seatSz + 'px', height: seatSz + 'px' });
                $content.append($seat);
            });
        } else {
            for (let i = 0; i < seatCount; i++) {
                const $seat = $(`<div class="seat"></div>`);
                let top, left;
                if (i < half) {
                    left = (groupW - tableWidth) / 2 - seatSz - 5;
                    top = 5 + i * (seatSz + 10);
                } else {
                    const idx = i - half;
                    left = (groupW - tableWidth) / 2 + tableWidth + 5;
                    top = 5 + idx * (seatSz + 10);
                }
                $seat.css({ top: top, left: left, width: seatSz + 'px', height: seatSz + 'px' });
                $content.append($seat);
            }
        }
    }

    $group.append($content);
    $('#seat-layer').append($group);

    if (restoreConfig && restoreConfig.w && restoreConfig.h) {
        $group.css({ width: restoreConfig.w, height: restoreConfig.h });
        const scaleX = restoreConfig.w / initialW;
        const scaleY = restoreConfig.h / initialH;
        $content.css('transform', `scale(${scaleX}, ${scaleY})`);
    }

    initInteractions();
}

export function createGrid(rows, cols, restoreConfig = null) {
    const containerW = $('#classroom-container').width();
    const seatSz = getSeatSize('grid');

    let startX, startY;
    if (restoreConfig) {
        startX = restoreConfig.x;
        startY = restoreConfig.y;
    } else {
        startX = 50;
        startY = 50;
    }

    const gapX = 30;
    const gapY = 30;

    const groupW = cols * seatSz + (cols - 1) * gapX;
    const groupH = rows * seatSz + (rows - 1) * gapY;
    const initialW = groupW;

    const $group = $(`<div class="desk-group" style="left: ${startX}px; top: ${startY}px; width: ${groupW}px; height: ${groupH}px;"></div>`);
    $group.data('rows', rows);
    $group.data('cols', cols);

    const $content = $(`<div class="desk-content"></div>`);
    $content.css({ width: groupW, height: groupH });

    const $actions = $(`<div class="desk-actions">
        <i class="bi bi-pencil-fill btn-edit-group" title="Edit Rows/Cols"></i>
        <i class="bi bi-x-lg btn-delete-group" title="Remove Table"></i>
    </div>`);
    $group.append($actions);

    if (restoreConfig && restoreConfig.params && restoreConfig.params.seats) {
        restoreConfig.params.seats.forEach(s => {
            const $seat = $(`<div class="seat"></div>`);
            $seat.css({ left: s.x, top: s.y, width: seatSz + 'px', height: seatSz + 'px' });
            $content.append($seat);
        });
    } else {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const $seat = $(`<div class="seat"></div>`);
                const left = c * (seatSz + gapX);
                const top = r * (seatSz + gapY);
                $seat.css({ top: top, left: left, width: seatSz + 'px', height: seatSz + 'px' });
                $content.append($seat);
            }
        }
    }

    $group.append($content);
    $('#seat-layer').append($group);

    if (restoreConfig && restoreConfig.w && restoreConfig.h) {
        $group.css({ width: restoreConfig.w, height: restoreConfig.h });
        const scaleX = restoreConfig.w / initialW;
        const scaleY = restoreConfig.h / groupH;
        $content.css('transform', `scale(${scaleX}, ${scaleY})`);
    }

    initInteractions();
}


export function createFurniture(type, restoreConfig = null) {
    const containerW = $('#classroom-container').width();
    const containerH = $('#classroom-container').height();
    let label = "";
    let width = 100;
    let height = 50;
    let className = "";
    let shape = (restoreConfig && restoreConfig.params && restoreConfig.params.shape) ? restoreConfig.params.shape : 'horizontal';

    switch (type) {
        case 'lectern': label = "講台"; width = 150; height = 60; className = "table-lectern"; break;
        case 'whiteboard': label = "白板"; width = 200; height = 20; className = "table-whiteboard"; break;
        case 'door': label = "門"; width = 80; height = 10; className = "table-door"; break;
        case 'cabinet': label = "櫃子"; width = 100; height = 40; className = "table-cabinet"; break;
        case 'window': label = "窗戶"; width = 100; height = 10; className = "table-window"; break;
        case 'aircon': label = "冷氣"; width = 80; height = 30; className = "table-aircon"; break;
        case 'screen': label = "投影幕"; width = 120; height = 10; className = "table-screen"; break;
        case 'pillar': label = "柱子"; width = 40; height = 80; className = "table-pillar"; break;
        case 'fan': label = "電扇"; width = 50; height = 50; className = "table-fan"; break;
        case 'trashcan': label = "垃圾桶"; width = 40; height = 40; className = "table-trashcan"; break;
        case 'bulletin': label = "佈告欄"; width = 150; height = 10; className = "table-bulletin"; break;
    }

    if (shape === 'vertical') {
        let tmp = width; width = height; height = tmp;
    }

    let startX, startY;
    if (restoreConfig) {
        startX = restoreConfig.x;
        startY = restoreConfig.y;
    } else {
        startX = containerW / 2 - (width / 2);
        startY = containerH / 2 - (height / 2);
    }

    const initialW = width;
    const initialH = height;

    const $group = $(`<div class="desk-group" style="left: ${startX}px; top: ${startY}px; width: ${width}px; height: ${height}px;"></div>`);
    const $content = $(`<div class="desk-content"></div>`);
    $content.css({ width: width, height: height });

    const $actions = $(`<div class="desk-actions"><i class="bi bi-x-lg btn-delete-group" title="Remove Item"></i></div>`);

    const isVertical = (shape === 'vertical');
    const $table = $(`<div class="table-shape ${className} ${isVertical ? 'vertical-text' : ''}">${label}</div>`);
    $table.css({ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 });

    $content.append($table);
    $group.append($actions);
    $group.append($content);

    $('#seat-layer').append($group);

    if (restoreConfig && restoreConfig.w && restoreConfig.h) {
        $group.css({ width: restoreConfig.w, height: restoreConfig.h });
        const scaleX = restoreConfig.w / initialW;
        const scaleY = restoreConfig.h / initialH;
        $content.css('transform', `scale(${scaleX}, ${scaleY})`);
    }

    initInteractions();
}
