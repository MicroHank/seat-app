
// UI Helpers
export function showAppAlert(message) {
    $('#genericAlertMessage').text(message);
    const modal = new bootstrap.Modal(document.getElementById('modalGenericAlert'));
    modal.show();
}

export function showAppConfirm(message, callback) {
    $('#genericConfirmMessage').text(message);
    const modalEl = document.getElementById('modalGenericConfirm');
    const modal = new bootstrap.Modal(modalEl);

    // Unbind previous clicks to avoid multiple triggers
    $('#btnGenericConfirmYes').off('click').on('click', function () {
        callback();
        modal.hide();
    });

    modal.show();
}

export function updateActivityName() {
    const title = $('#examTitleInput').val() || '活動名稱';
    $('#activity-name-display').text(title);
}
