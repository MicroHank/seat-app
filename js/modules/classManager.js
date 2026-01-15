
import { state } from './state.js';
import { updateStudentCountBadge, showAppAlert, showAppConfirm } from './utils.js';
import { assignSeats, saveToLocal } from './layout.js';

let pendingImportSlotId = null;

export function loadClassLists() {
    const saved = localStorage.getItem('seatAppClassLists');
    if (saved) {
        try {
            state.classLists = JSON.parse(saved);
        } catch (e) {
            console.error("Failed to load class lists", e);
            state.classLists = [];
        }
    } else {
        state.classLists = [];
    }
}

export function saveClassLists() {
    localStorage.setItem('seatAppClassLists', JSON.stringify(state.classLists));
    renderClassManager();
}

function renderClassManager() {
    const $container = $('#classListContainer');
    $container.empty();

    if (state.classLists.length === 0) {
        $container.html('<div class="text-center text-secondary py-3">尚未建立任何班級名冊</div>');
    } else {
        state.classLists.forEach(cls => {
            const count = cls.students ? cls.students.length : 0;
            const safeName = $('<div>').text(cls.name || '未命名班級').html();

            const html = `
                <div class="card bg-black border-secondary mb-1">
                    <div class="card-body p-2 d-flex align-items-center">
                        <i class="bi bi-people-fill fs-4 text-warning me-3"></i>
                        <div class="flex-grow-1">
                            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary input-class-name mb-1" 
                                data-id="${cls.id}" value="${safeName}" style="max-width: 250px;">
                            <div class="small text-secondary">
                                <span class="badge bg-secondary me-2">${count} 人</span>
                                <span class="text-muted" style="font-size: 0.8rem;">ID: ${cls.id}</span>
                            </div>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-outline-success btn-sm btn-class-apply" data-id="${cls.id}" title="套用此名單">
                                <i class="bi bi-check-lg me-1"></i>套用
                            </button>
                            <button class="btn btn-outline-info btn-sm btn-class-update" data-id="${cls.id}" title="匯入/更新 Excel">
                                <i class="bi bi-upload"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-sm btn-class-delete" data-id="${cls.id}" title="刪除">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            $container.append(html);
        });
    }
}

export function initClassManager() {
    $('#modalClassManager').on('show.bs.modal', function () {
        loadClassLists();
        renderClassManager();
    });

    $('#btnAddClassSlot').click(function () {
        const newId = 'class_' + Date.now();
        state.classLists.push({
            id: newId,
            name: '新班級 ' + (state.classLists.length + 1),
            students: []
        });
        saveClassLists();
    });

    $(document).on('change', '.input-class-name', function () {
        const id = $(this).data('id');
        const newName = $(this).val();
        const cls = state.classLists.find(c => c.id === id);
        if (cls) {
            cls.name = newName;
            localStorage.setItem('seatAppClassLists', JSON.stringify(state.classLists));
        }
    });

    $(document).on('click', '.btn-class-delete', function () {
        const id = $(this).data('id');
        showAppConfirm('確定要刪除此班級名冊嗎？', function () {
            state.classLists = state.classLists.filter(c => c.id !== id);
            saveClassLists();
        });
    });

    $(document).on('click', '.btn-class-update', function () {
        pendingImportSlotId = $(this).data('id');
        $('#classSlotInput').click();
    });

    $('#classSlotInput').on('change', function (e) {
        const file = e.target.files[0];
        if (!file || !pendingImportSlotId) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                const newStudents = [];
                json.forEach(row => {
                    row.forEach(cell => {
                        if (cell && cell.toString().trim() !== "") {
                            newStudents.push(cell.toString().trim());
                        }
                    });
                });

                const cls = state.classLists.find(c => c.id === pendingImportSlotId);
                if (cls) {
                    cls.students = newStudents;
                    saveClassLists();
                    showAppAlert(`成功匯入 ${newStudents.length} 人至「${cls.name}」！`);
                }
            } catch (err) {
                console.error(err);
                showAppAlert('匯入失敗: 檔案格式錯誤');
            }
        };
        reader.readAsArrayBuffer(file);
        $('#classSlotInput').val('');
    });

    $(document).on('click', '.btn-class-apply', function () {
        const id = $(this).data('id');
        const cls = state.classLists.find(c => c.id === id);
        if (cls && cls.students) {
            state.students = [...cls.students];
            state.currentClassName = cls.name;
            updateStudentCountBadge();

            assignSeats();
            saveToLocal(); // Helper from layout.js

            $('#modalClassManager').modal('hide');
            showAppAlert(`已切換至: ${cls.name} (${state.students.length}人)`);
        }
    });

    loadClassLists();
}
