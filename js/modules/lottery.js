// Lottery Module
let drawnStudentHistory = new Set();

export function getLotteryCandidates(excludeHistory) {
    let candidates = [];
    $('.seat').each(function() {
        const name = $(this).text().trim();
        if (name) {
            if (excludeHistory && drawnStudentHistory.has(name)) {
                // Skip
            } else {
                candidates.push({
                    el: $(this),
                    name: name
                });
            }
        }
    });
    return candidates;
}

export function resetHistory(excludeChecked) {
     drawnStudentHistory.clear();
     $('.seat').removeClass('drawing-winner drawn-finished'); // Clear visual
}

export function startLottery(count, exclude, callback) {
    const candidates = getLotteryCandidates(exclude);

    if (candidates.length < count) {
        alert('名單人數不足！');
        return;
    }
    if (candidates.length === 0) {
        alert('沒有可抽籤的人員！');
        return;
    }

    if (callback) callback(); // Invoke callback (e.g. hide modal)

    // Start Animation
    const shuffled = candidates.sort(() => 0.5 - Math.random());
    const winners = shuffled.slice(0, count);
    
    runLotteryAnimation(candidates, winners);
}

function runLotteryAnimation(candidates, winners) {
    let step = 0;
    const totalSteps = 30;
    const initialDelay = 50;
    
    function nextStep() {
        const t = step / totalSteps;
        const delay = initialDelay + (400 * (t * t)); 

        $('.seat').removeClass('drawing-active');

        if (step >= totalSteps) {
            finishLottery(winners);
            return;
        }

        const count = winners.length;
        for(let i=0; i<count; i++) {
            const randIndex = Math.floor(Math.random() * candidates.length);
            const item = candidates[randIndex];
            item.el.addClass('drawing-active');
        }

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

    // Show Result
    $('#lotteryResultList').html(resultHtml.join(''));
    
    setTimeout(() => {
        $('#modalLotteryResult').modal('show');
    }, 500);
}
