// Seats Module
import { AppConfig } from './config.js';

let onStateCommit = null; // Callback to commit state after changes

export function init(callbacks) {
    if (callbacks.onStateCommit) onStateCommit = callbacks.onStateCommit;
}

export function adjustFontSize($el) {
    const name = $el.text();
    // Use Config
    const size = AppConfig.fontSize;
    $el.css('font-size', size + 'px');
}

export function captureAssignments() {
    const assignments = [];
    $('.seat.filled').each(function() {
        const rect = this.getBoundingClientRect();
        assignments.push({
            name: $(this).text(),
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        });
    });
    return assignments;
}

export function assignSeats(students, currentMode, previousAssignments = null) {
    // Clear all seats
    $('.seat').removeClass('filled').text('');

    let $allSeats = $('.seat');
    let seatList = [];

    $allSeats.each(function () {
        // Get center position of the seat on screen to be robust against scaling
        const rect = this.getBoundingClientRect();
        seatList.push({
            element: $(this),
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            assigned: false
        });
    });

    // Sticky Logic: Try to place previous assignments nearest to their old spot
    const usedNames = new Set();
    
    if (previousAssignments) {
        previousAssignments.forEach(prev => {
            // Find nearest available seat
            let nearest = null;
            let minDist = Infinity;

            seatList.forEach(seat => {
                if (!seat.assigned) {
                    // Euclidean distance
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

    // Sort remaining empty seats for new students
    // Sort: Primary Y, Secondary X
    seatList.sort((a, b) => {
        if (Math.abs(a.y - b.y) > 20) return a.y - b.y;
        return a.x - b.x;
    });

    // Fill remaining students who are NOT in usedNames
    let studentIndex = 0;
    seatList.forEach(seat => {
        if (!seat.assigned) {
            // Find next unused student
            while(studentIndex < students.length && usedNames.has(students[studentIndex])) {
                studentIndex++;
            }
            
            if (studentIndex < students.length) {
                const name = students[studentIndex];
                seat.element.addClass('filled').text(name);
                adjustFontSize(seat.element);
                usedNames.add(name); // Just in case duplicate names logic needed later
                studentIndex++;
            }
        }
    });

    rebindSeatInteractions(currentMode);
}

// Logic to rebind drag/drop based on mode
export function rebindSeatInteractions(mode) {
    if (mode === 'desk') {
        // Disable Interactions
        try { $(".seat").draggable("disable"); } catch (e) { }
        try { $(".seat").droppable("disable"); } catch (e) { }
    } else {
        // Enable Interactions
        try { $(".seat").draggable("destroy"); } catch (e) { }
        
        $(".seat").draggable({
            helper: function () {
                const text = $(this).text();
                return $(`<div class="seat-drag-helper">${text}</div>`);
            },
            appendTo: "body",
            cursor: "grabbing",
            cursorAt: { top: 20, left: 20 },
            zIndex: 1000,
            disabled: true // Default disabled, enabled for .filled below
        });

        $(".seat").droppable({
            accept: ".seat.filled",
            disabled: true,
            tolerance: "touch",
            hoverClass: "ui-droppable-hover",
            drop: function (event, ui) {
                const $source = ui.draggable;
                const $target = $(this);

                const sourceName = $source.text();
                const targetName = $target.text();

                // Visual Swap
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

                adjustFontSize($source);
                adjustFontSize($target);

                if (onStateCommit) onStateCommit();
            }
        });

        try { $(".seat.filled").draggable("enable"); } catch (e) { }
        try { $(".seat").droppable("enable"); } catch (e) { }
    }
}
