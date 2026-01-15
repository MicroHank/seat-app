
import { showAppAlert, showAppConfirm } from './utils.js';

let drawnStudentHistory = new Set();
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playBeep(frequency = 800, duration = 0.1, type = 'sine') {
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    oscillator.stop(audioCtx.currentTime + duration);
}

function getLotteryCandidates(excludeHistory) {
    let candidates = [];
    $('.seat').each(function () {
        const name = $(this).text().trim();
        if (name) {
            if (excludeHistory && drawnStudentHistory.has(name)) {
                // Skip
            } else {
                candidates.push({ el: $(this), name: name });
            }
        }
    });
    return candidates;
}

export function initLottery() {
    $('#modalLottery').on('show.bs.modal', function () {
        const exclude = $('#lotteryExclude').is(':checked');
        const pool = getLotteryCandidates(exclude);
        $('#lotteryPoolSize').text(`名單剩餘: ${pool.length} 人`);
        $('#lotteryCount').attr('max', pool.length > 0 ? pool.length : 1);
        if (pool.length === 0) $('#lotteryCount').val(0);
        else if ($('#lotteryCount').val() > pool.length) $('#lotteryCount').val(pool.length);
    });

    $('#lotteryPerTable').on('change', function () {
        const isPerTable = $(this).is(':checked');
        $('#lotteryCount').prop('disabled', isPerTable);
        if (isPerTable) $('#lotteryCount').addClass('opacity-50');
        else $('#lotteryCount').removeClass('opacity-50');
    });

    $('#lotteryExclude').on('change', function () {
        const exclude = $(this).is(':checked');
        const pool = getLotteryCandidates(exclude);
        $('#lotteryPoolSize').text(`名單剩餘: ${pool.length} 人`);
        $('#lotteryCount').attr('max', pool.length > 0 ? pool.length : 1);
    });

    $('#btnStartLottery').click(function () {
        const isPerTable = $('#lotteryPerTable').is(':checked');
        const exclude = $('#lotteryExclude').is(':checked');
        const allCandidates = getLotteryCandidates(exclude);

        if (allCandidates.length === 0) {
            showAppAlert('沒有可抽籤的人員！');
            return;
        }

        let winners = [];
        let candidatesForAnim = allCandidates;

        if (isPerTable) {
            $('.desk-group').each(function () {
                const groupCandidates = [];
                $(this).find('.seat').each(function () {
                    const name = $(this).text().trim();
                    if (name) {
                        if (exclude && drawnStudentHistory.has(name)) {
                            // Skip
                        } else {
                            groupCandidates.push({ el: $(this), name: name });
                        }
                    }
                });

                if (groupCandidates.length > 0) {
                    const randIndex = Math.floor(Math.random() * groupCandidates.length);
                    winners.push(groupCandidates[randIndex]);
                }
            });

            if (winners.length === 0) {
                showAppAlert('各桌皆無符合條件的人員！');
                return;
            }
        } else {
            const count = parseInt($('#lotteryCount').val()) || 1;
            if (allCandidates.length < count) {
                showAppAlert('名單人數不足！');
                return;
            }
            const shuffled = allCandidates.sort(() => 0.5 - Math.random());
            winners = shuffled.slice(0, count);
        }

        $('#modalLottery').modal('hide');
        runLotteryAnimation(candidatesForAnim, winners);
    });

    $('#btnResetLotteryHistory').click(function () {
        showAppConfirm('確定要清除所有已抽籤紀錄嗎？', function () {
            drawnStudentHistory.clear();
            $('.seat').removeClass('drawing-winner drawn-finished');
            const exclude = $('#lotteryExclude').is(':checked');
            const pool = getLotteryCandidates(exclude);
            $('#lotteryPoolSize').text(`名單剩餘: ${pool.length} 人`);
        });
    });
}

function runLotteryAnimation(candidates, winners) {
    let step = 0;
    const totalSteps = 25;
    const initialDelay = 50;

    function nextStep() {
        const t = step / totalSteps;
        const delay = initialDelay + (350 * (t * t));

        $('.seat').removeClass('drawing-active');

        if (step >= totalSteps) {
            finishLottery(winners);
            playBeep(1200, 0.3, 'triangle');
            return;
        }

        const count = winners.length;
        for (let i = 0; i < count; i++) {
            const randIndex = Math.floor(Math.random() * candidates.length);
            const item = candidates[randIndex];
            item.el.addClass('drawing-active');
        }

        playBeep(800 + (step * 20), 0.08);

        step++;
        setTimeout(nextStep, delay);
    }
    nextStep();
}

function finishLottery(winners) {
    $('.seat').removeClass('drawing-active');
    $('.seat').removeClass('drawing-winner');

    const resultHtml = [];
    winners.forEach(w => {
        w.el.addClass('drawing-winner');
        w.el.addClass('drawn-finished');
        drawnStudentHistory.add(w.name);
        resultHtml.push(`<div class="result-badge">${w.name}</div>`);
    });

    $('#lotteryResultList').html(resultHtml.join(''));
    setTimeout(() => {
        $('#modalLotteryResult').modal('show');
    }, 500);
}
