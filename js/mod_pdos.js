// ==========================================================
// 🔴 MOD_PDOS.JS - PHÂN TÍCH PDOS (CÓ NHẬN DIỆN SPIN THÔNG MINH)
// ==========================================================
let pdosTotalState = { rawText: "", color: "#d1d5db", isFilled: true, isVisible: false, isSpin: false, xArray: [], y1Array: [], y2Array: [] };
let pdosFileList = []; let pdosCounter = 0;

function rgbaPdosLocal(hex, alpha) {
    if (!hex) return `rgba(0,0,0,${alpha})`;
    if (hex.startsWith('#')) hex = hex.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    let r = parseInt(hex.slice(0, 2), 16) || 0, g = parseInt(hex.slice(2, 4), 16) || 0, b = parseInt(hex.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// BỘ ĐỌC DỮ LIỆU: TỰ ĐỘNG NHẬN DIỆN FILE TỪ TÍNH DỰA TRÊN HEADER
function extractPdosData(rawText) {
    const lines = rawText.split('\n');
    let x = [], y1 = [], y2 = [];
    let isSpin = false;

    // Quét tìm dấu hiệu Từ tính (up/dw) ở 5 dòng đầu tiên
    for (let i = 0; i < Math.min(5, lines.length); i++) {
        let l = lines[i].toLowerCase();
        if (l.includes('up') || l.includes('dw')) { isSpin = true; break; }
    }

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line === '' || line.startsWith('#')) continue;
        let cols = line.split(/\s+/);

        if (cols.length >= 2 && !isNaN(parseFloat(cols[0]))) {
            x.push(parseFloat(cols[0]));
            y1.push(parseFloat(cols[1])); // Cột 2 luôn là DOS/PDOS (hoặc Spin-Up)

            // CHỈ lấy Cột 3 làm Spin-Down NẾU file đó được xác nhận là có từ tính!
            if (isSpin && cols.length >= 3) {
                y2.push(parseFloat(cols[2]));
            } else {
                y2.push(0); // Tránh việc lấy nhầm Cột 3 (Integral DOS) của file không từ tính
            }
        }
    }
    return { x: x, y1: y1, y2: y2, isSpin: isSpin };
}

function getPdosLayout() {
    const xMin = parseFloat(document.getElementById('pdosXMin').value) || -6, xMax = parseFloat(document.getElementById('pdosXMax').value) || 6;
    return { font: { family: 'Arial', size: 14, color: '#000' }, plot_bgcolor: 'white', paper_bgcolor: 'white', showlegend: true, legend: { x: 0.85, y: 0.98, bgcolor: 'rgba(255,255,255,0.8)', bordercolor: '#000', borderwidth: 1 }, xaxis: { title: 'Energy - E<sub>F</sub> (eV)', range: [xMin, xMax], showline: true, linewidth: 1.5, linecolor: 'black', mirror: true }, yaxis: { title: 'Density of States (states/eV)', showline: true, linewidth: 1.5, linecolor: 'black', mirror: true }, margin: { l: 60, r: 20, t: 40, b: 60 }, shapes: [{ type: 'line', x0: 0, x1: 0, y0: 0, y1: 1, yref: 'paper', line: { color: 'red', width: 1.5, dash: 'dash' } }] };
}

window.updatePdosGraph = function () {
    if (currentEngine !== 'pdos') return;
    Plotly.purge('plot-container');

    const ef = parseFloat(document.getElementById('pdosFermiInput').value) || 0;
    let spinToggleEl = document.getElementById('pdosSpinMode');
    const isSpinMode = spinToggleEl ? spinToggleEl.checked : false; // Kiểm tra xem công tắc đang Bật hay Tắt
    let data = [];

    // HÀM VẼ CHUNG: Xử lý thông minh dựa vào trạng thái công tắc và loại file
    function addTraceToData(item, name, color, isFilled, isSpinFile) {
        let sx = item.xArray.map(v => v - ef);
        let fillMode = isFilled ? 'tozeroy' : 'none';
        let fillColor = isFilled ? rgbaPdosLocal(color, 0.4) : 'transparent';

        if (isSpinMode && isSpinFile) {
            // NẾU BẬT SPIN VÀ FILE LÀ TỪ TÍNH: Vẽ cánh bướm đối xứng
            data.push({ x: sx, y: item.y1Array, mode: 'lines', name: `${name} (↑)`, line: { color: color, width: 1.5 }, fill: fillMode, fillcolor: fillColor });

            let yDown = item.y2Array.map(v => -Math.abs(v)); // Lấy Cột 3 nhân với -1
            data.push({ x: sx, y: yDown, mode: 'lines', name: `${name} (↓)`, line: { color: color, width: 1.5, dash: 'dot' }, fill: fillMode, fillcolor: fillColor });
        } else {
            // NẾU TẮT SPIN (Hoặc file không từ tính):
            // - File từ tính: Vẽ tổng (Y1 + Y2) để ra Total DOS thực tế
            // - File không từ tính: Y2 bằng 0, nên cũng chỉ vẽ Y1 bình thường
            let yTotal = isSpinFile ? item.y1Array.map((val, idx) => val + item.y2Array[idx]) : item.y1Array;
            data.push({ x: sx, y: yTotal, mode: 'lines', name: name, line: { color: color, width: 1.5 }, fill: fillMode, fillcolor: fillColor });
        }
    }

    if (pdosTotalState.isVisible && pdosTotalState.xArray.length > 0) {
        addTraceToData(pdosTotalState, 'Total DOS', pdosTotalState.color, pdosTotalState.isFilled, pdosTotalState.isSpin);
    }

    pdosFileList.forEach(i => {
        if (i.isVisible) addTraceToData(i, i.label, i.color, i.isFilled, i.isSpin);
    });

    Plotly.newPlot('plot-container', data, getPdosLayout(), { editable: true, displaylogo: false });
}

window.renderPdosUIList = function () {
    const area = document.getElementById('pdosControlArea'); area.innerHTML = '';
    let uniqueLabels = [...new Set(pdosFileList.filter(i => !i.id.includes('sum')).map(i => i.label))];
    let selectHtml = '<option value="">-- Chọn Orbital --</option>';
    uniqueLabels.forEach(lbl => { selectHtml += `<option value="${lbl}">Chọn tất cả [ ${lbl} ]</option>`; });
    document.getElementById('smartSelectDropdown').innerHTML = selectHtml;

    pdosFileList.forEach(item => {
        let isCh = item.isChecked ? 'checked' : '', eye = item.isVisible ? '👁️' : '🚫', fi = item.isFilled ? 'checked' : '';
        let bg = item.isVisible ? '#ffffff' : '#f9fafb', border = item.isVisible ? '1px solid #3b82f6' : '1px solid #ddd';
        area.insertAdjacentHTML('beforeend', `
            <div style="display: flex; align-items: center; background: ${bg}; padding: 6px; border: ${border}; border-radius: 4px; margin-bottom: 5px;">
                <input type="checkbox" onchange="window.togglePdosCheck('${item.id}', this.checked)" ${isCh} style="margin-right: 8px; width: 16px; height: 16px;">
                <input type="color" value="${item.color}" onchange="window.changePdosColor('${item.id}', this.value)" style="width: 22px; height: 22px; border: none; cursor: pointer; border-radius: 3px;">
                <input type="text" value="${item.label}" oninput="window.changePdosLabel('${item.id}', this.value)" style="flex: 1; margin: 0 5px; padding: 4px; border: 1px solid #ccc; font-size: 12px; font-weight: bold; color: #333;">
                <label style="margin: 0 5px; cursor: pointer;"><input type="checkbox" ${fi} onchange="window.togglePdosFill('${item.id}', this.checked)" style="margin-right:2px;"> ⬛</label>
                <span onclick="window.togglePdosVisibility('${item.id}')" style="cursor: pointer; font-size: 16px; margin-right: 8px;">${eye}</span>
                <span onclick="window.deletePdos('${item.id}')" style="cursor: pointer; font-size: 14px; color: red;">❌</span>
            </div>`);
    });
}

function renderTotalDosUI() {
    const area = document.getElementById('totalDosControlArea'); if (!pdosTotalState.xArray || pdosTotalState.xArray.length === 0) { area.innerHTML = ''; return; }
    let eyeIcon = pdosTotalState.isVisible ? '👁️' : '🚫', bg = pdosTotalState.isVisible ? '#e0f2fe' : '#f3f4f6', fillChecked = pdosTotalState.isFilled ? 'checked' : '';
    area.innerHTML = `
        <div style="display: flex; align-items: center; background: ${bg}; padding: 6px; border: 1px solid #0284c7; border-radius: 4px; margin-top: 5px;">
            <span style="font-size: 11px; font-weight: bold; margin-right: 5px; color: #0284c7;">TOTAL:</span>
            <input type="color" value="${pdosTotalState.color}" onchange="window.changeTotalColor(this.value)" style="width: 22px; height: 22px; padding: 0; border: none; cursor: pointer; border-radius: 3px;">
            <span style="flex: 1; margin: 0 8px; font-size: 12px; font-weight: bold; color: #333;">Total DOS</span>
            <label style="margin: 0 5px; cursor: pointer; font-size: 12px;"><input type="checkbox" ${fillChecked} onchange="window.toggleTotalFill(this.checked)" style="margin-right:3px;"> ⬛</label>
            <span onclick="window.toggleTotalVis()" style="cursor: pointer; font-size: 16px; margin-right: 8px;">${eyeIcon}</span>
            <span onclick="window.deleteTotal()" style="cursor: pointer; font-size: 14px; color: red;">❌</span>
        </div>`;
}

window.toggleTotalFill = (chk) => { pdosTotalState.isFilled = chk; window.updatePdosGraph(); renderTotalDosUI(); };
window.toggleTotalVis = () => { pdosTotalState.isVisible = !pdosTotalState.isVisible; window.updatePdosGraph(); renderTotalDosUI(); };
window.changeTotalColor = (col) => { pdosTotalState.color = col; window.updatePdosGraph(); renderTotalDosUI(); };
window.deleteTotal = () => { pdosTotalState = { rawText: "", color: "#d1d5db", isFilled: true, isVisible: false, xArray: [] }; window.updatePdosGraph(); renderTotalDosUI(); };

window.togglePdosCheck = (id, chk) => { pdosFileList.find(i => i.id === id).isChecked = chk; };
window.changePdosColor = (id, col) => { pdosFileList.find(i => i.id === id).color = col; window.updatePdosGraph(); };
window.changePdosLabel = (id, lbl) => { pdosFileList.find(i => i.id === id).label = lbl; window.updatePdosGraph(); };
window.togglePdosFill = (id, chk) => { pdosFileList.find(i => i.id === id).isFilled = chk; window.updatePdosGraph(); window.renderPdosUIList(); };
window.togglePdosVisibility = (id) => { let item = pdosFileList.find(i => i.id === id); item.isVisible = !item.isVisible; window.updatePdosGraph(); window.renderPdosUIList(); };
window.deletePdos = (id) => { pdosFileList = pdosFileList.filter(i => i.id !== id); window.renderPdosUIList(); window.updatePdosGraph(); };

document.getElementById('pdosAutoFermiInput').addEventListener('change', e => {
    let f = e.target.files[0]; if (!f) return; let r = new FileReader();
    r.onload = ev => {
        let t = ev.target.result;
        let ef = (t.match(/Fermi.*?energy.*?\s+([-+]?\d*\.?\d+)/i) || t.match(/highest occupied.*?level[^\d]*([-+]?\d*\.?\d+)/i));
        if (ef) { document.getElementById('pdosFermiInput').value = parseFloat(ef[1]); window.updatePdosGraph(); alert("✅ Lấy Fermi PDOS thành công"); }
    }; r.readAsText(f); e.target.value = '';
});

document.getElementById('pdosTotalInput').addEventListener('change', e => {
    let f = e.target.files[0]; if (!f) return; let r = new FileReader();
    r.onload = ev => {
        let d = extractPdosData(ev.target.result);
        pdosTotalState.xArray = d.x; pdosTotalState.y1Array = d.y1; pdosTotalState.y2Array = d.y2; pdosTotalState.isSpin = d.isSpin;
        pdosTotalState.isVisible = true; pdosTotalState.isFilled = true;
        renderTotalDosUI(); window.updatePdosGraph(); alert(`✅ Nạp Total DOS thành công! ${d.isSpin ? '(Phát hiện Từ tính 🧲)' : ''}`);
    };
    r.readAsText(f); e.target.value = '';
});

// ==========================================================
// HÀM XỬ LÝ UPLOAD MULTI-FILE PDOS (ĐÃ FIX LỖI NHẬN DIỆN SỐ Ni1, Ni2)
// ==========================================================
function handlePdosFiles(files) {
    if (files.length === 0) return;
    let validFiles = Array.from(files).filter(f => f.name.includes('_atm#') || f.name.includes('.dos'));
    if (validFiles.length === 0) return alert("❌ Không tìm thấy file hợp lệ trong thư mục!");

    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];
    let filesRead = 0;

    validFiles.forEach((file) => {
        let r = new FileReader();
        r.onload = ev => {
            let d = extractPdosData(ev.target.result);
            if (d.x.length > 0) {
                let shortName = file.name;

                // BỘ LỌC MỚI: [A-Za-z0-9_]+ cho phép chứa cả chữ và số (Ni1, Ti2...)
                let m = shortName.match(/\(([A-Za-z0-9_]+)\)_wfc#\d+\(([^)]+)\)/);

                if (m) {
                    shortName = `${m[1]} ${m[2]}`; // Sẽ in ra chuẩn xác: "Ni1 d" hoặc "Ni2 p"
                } else {
                    shortName = shortName.split('.pdos_').pop();
                }

                pdosFileList.push({
                    id: 'p_' + (pdosCounter++),
                    label: shortName,
                    color: colors[pdosFileList.length % colors.length],
                    isVisible: false, isChecked: false, isFilled: false,
                    xArray: d.x, y1Array: d.y1, y2Array: d.y2, isSpin: d.isSpin
                });
            }
            filesRead++;
            if (filesRead === validFiles.length) {
                window.renderPdosUIList();
                window.updatePdosGraph();
                alert(`✅ Đã nạp thành công ${filesRead} file PDOS`);
            }
        };
        r.readAsText(file);
    });
}

document.getElementById('pdosFolderInput').addEventListener('change', e => { handlePdosFiles(e.target.files); e.target.value = ''; });
document.getElementById('pdosMultiInput').addEventListener('change', e => { handlePdosFiles(e.target.files); e.target.value = ''; });

document.getElementById('smartSelectBtn').addEventListener('click', function () {
    let t = document.getElementById('smartSelectDropdown').value; if (!t) return alert("Vui lòng chọn 1 Orbital!");
    pdosFileList.forEach(i => { if (i.label === t && !i.id.includes('sum')) i.isChecked = true; }); window.renderPdosUIList();
});

document.getElementById('sumPdosBtn').addEventListener('click', function () {
    let sel = pdosFileList.filter(i => i.isChecked); if (sel.length < 2) return alert("Chọn ít nhất 2 file để gộp!");
    let cName = prompt("Đặt tên:", `Total ${sel[0].label}`); if (!cName || cName.trim() === "") return;

    let sumY1 = new Array(sel[0].y1Array.length).fill(0);
    let sumY2 = new Array(sel[0].y2Array.length).fill(0);
    let isSpinSum = sel.some(i => i.isSpin); // Nếu có bất kỳ file spin nào thì gộp lại vẫn giữ spin

    sel.forEach(item => {
        for (let i = 0; i < item.y1Array.length; i++) {
            sumY1[i] += item.y1Array[i] || 0;
            sumY2[i] += item.y2Array[i] || 0;
        }
        item.isVisible = false; item.isChecked = false;
    });
    pdosFileList.unshift({ id: 'p_sum_' + (pdosCounter++), label: cName, color: '#000000', isVisible: true, isChecked: false, isFilled: false, xArray: sel[0].xArray, y1Array: sumY1, y2Array: sumY2, isSpin: isSpinSum });
    window.renderPdosUIList(); window.updatePdosGraph();
});

// Gắn bộ lắng nghe cho công tắc Spin (Nếu có)
let spinToggle = document.getElementById('pdosSpinMode');
if (spinToggle) spinToggle.addEventListener('change', window.updatePdosGraph);

document.getElementById('pdosXMin').addEventListener('change', window.updatePdosGraph);
document.getElementById('pdosXMax').addEventListener('change', window.updatePdosGraph);
document.getElementById('pdosFermiInput').addEventListener('change', window.updatePdosGraph);