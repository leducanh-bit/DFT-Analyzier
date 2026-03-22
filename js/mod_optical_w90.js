// ==========================================================
// 🟣 MOD_OPTICAL_W90.JS - PHÂN TÍCH QUANG HỌC KUBO ĐA FILE
// ==========================================================
let w90OptKuboFiles = [];
let w90OptCounter = 0;
const w90OptColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#000000'];

// HÀM CHUYỂN MÀU CỤC BỘ (Khắc phục 100% lỗi sập màn hình khi Fill)
function hexToRgbaLocal(hex, alpha) {
    if (!hex) return `rgba(0,0,0,${alpha})`;
    if (hex.startsWith('#')) hex = hex.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    let r = parseInt(hex.slice(0, 2), 16) || 0;
    let g = parseInt(hex.slice(2, 4), 16) || 0;
    let b = parseInt(hex.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function parseW90KuboData(rawText) {
    const lines = rawText.split('\n');
    let x = [], e1_internal = [], e2_internal = [];
    const FOUR_PI = 4 * Math.PI;

    for (let i = 0; i < lines.length; i++) {
        let cols = lines[i].trim().split(/\s+/);
        if (cols.length >= 2 && !isNaN(parseFloat(cols[0]))) {
            let E = parseFloat(cols[0]);
            let s1 = parseFloat(cols[1]);
            let s2 = cols.length >= 3 ? parseFloat(cols[2]) : 0;

            if (E < 1e-6) {
                x.push(0); e1_internal.push(1); e2_internal.push(0);
                continue;
            }

            let e1 = 1 - (FOUR_PI * s2) / E;
            let e2 = (FOUR_PI * s1) / E;

            x.push(E); e1_internal.push(e1); e2_internal.push(e2);
        }
    }
    return { x: x, e1: e1_internal, e2: e2_internal };
}

window.renderW90OptUI = function () {
    const area = document.getElementById('w90OptControlArea'); if (!area) return; area.innerHTML = '';
    w90OptKuboFiles.forEach(item => {
        let isCh = item.isChecked ? 'checked' : '', isDa = item.isDashed ? 'checked' : '', isFi = item.isFilled ? 'checked' : '';
        area.insertAdjacentHTML('beforeend', `
            <div style="display: flex; align-items: center; background: #fff; padding: 6px; border: 1px solid #c7d2fe; border-radius: 4px; margin-bottom: 5px;">
                <input type="checkbox" onchange="window.toggleW90KuboCheck('${item.id}', this.checked)" ${isCh} style="margin-right: 8px;">
                <input type="color" value="${item.color}" onchange="window.changeW90KuboColor('${item.id}', this.value)" style="width: 22px; height: 22px; border: none; cursor: pointer; border-radius: 3px;">
                <input type="text" value="${item.label}" oninput="window.changeW90KuboLabel('${item.id}', this.value)" style="flex: 1; margin: 0 5px; padding: 4px; border: 1px solid #ccc; font-size: 12px; font-weight: bold; color: #333;">
                <label style="margin: 0 5px; cursor: pointer; font-size: 11px;" title="Nét đứt"><input type="checkbox" ${isDa} onchange="window.toggleW90KuboDash('${item.id}', this.checked)"> ➖</label>
                <label style="margin: 0 5px; cursor: pointer; font-size: 11px;" title="Đổ bóng"><input type="checkbox" ${isFi} onchange="window.toggleW90KuboFill('${item.id}', this.checked)"> ⬛</label>
                <span onclick="window.deleteW90Kubo('${item.id}')" style="cursor: pointer; font-size: 14px; color: red; margin-left: 5px;">❌</span>
            </div>`);
    });
}

window.drawW90Optical = function () {
    if (currentEngine !== 'optical_w90') return;
    Plotly.purge('plot-container'); // Rửa sạch đồ thị cũ

    const type = document.getElementById('w90OptPlotType').value;
    const xAxis = document.getElementById('w90OptXAxis').value;
    const xMin = parseFloat(document.getElementById('w90OptXMin').value) || (xAxis === 'nm' ? 200 : 0);
    const xMax = parseFloat(document.getElementById('w90OptXMax').value) || (xAxis === 'nm' ? 1000 : 15);

    let traces = [];

    w90OptKuboFiles.forEach(item => {
        if (!item.isChecked) return;

        let rawPoints = [];

        for (let i = 0; i < item.x.length; i++) {
            let E = item.x[i]; if (E <= 0.01 && xAxis === 'nm') continue;
            let v1 = item.e1[i], v2 = item.e2[i];

            let mod = Math.sqrt(v1 * v1 + v2 * v2);
            let n = Math.sqrt(Math.max(0, (mod + v1) / 2));
            let k = Math.sqrt(Math.max(0, (mod - v1) / 2));

            let res1 = 0, res2 = null;
            if (type === 'dielectric') { res1 = v1; res2 = v2; }
            else if (type === 'refractive') { res1 = n; res2 = k; }
            else if (type === 'absorption') { res1 = 101325 * k * E; }
            else if (type === 'reflectivity') { res1 = (Math.pow(n - 1, 2) + k * k) / (Math.pow(n + 1, 2) + k * k); }
            else if (type === 'tauc_direct') { res1 = Math.pow(101325 * k * E * E, 2); }
            else if (type === 'tauc_indirect') { res1 = Math.pow(101325 * k * E * E, 0.5); }
            else if (type === 'eels') { res1 = v2 / (v1 * v1 + v2 * v2); }

            rawPoints.push({ xVal: xAxis === 'nm' ? (1240.0 / E) : E, y1: res1, y2: res2 });
        }

        // Sắp xếp tăng dần (Chống lật trục nm và lỗi hình học của Plotly)
        rawPoints.sort((a, b) => a.xVal - b.xVal);

        let xArr = rawPoints.map(p => p.xVal);
        let yArr1 = rawPoints.map(p => p.y1);
        let yArr2 = rawPoints.map(p => p.y2);

        let lineDash = item.isDashed ? 'dash' : 'solid';

        if (type === 'dielectric' || type === 'refractive') {
            let tr1 = { x: xArr, y: yArr1, mode: 'lines', name: type === 'dielectric' ? `Re (${item.label})` : `n (${item.label})`, line: { color: item.color, width: 2, dash: lineDash } };
            // DÙNG HÀM CỤC BỘ Ở ĐÂY ĐỂ TRÁNH LỖI SẬP WEB
            if (item.isFilled) { tr1.fill = 'tozeroy'; tr1.fillcolor = hexToRgbaLocal(item.color, 0.3); }
            traces.push(tr1);

            traces.push({ x: xArr, y: yArr2, mode: 'lines', name: type === 'dielectric' ? `Im (${item.label})` : `k (${item.label})`, line: { color: item.color, width: 2, dash: 'dot' } });
        } else {
            let nTitle = type === 'absorption' ? `α (${item.label})` : type === 'reflectivity' ? `R (${item.label})` : type === 'eels' ? `EELS (${item.label})` : `Tauc (${item.label})`;
            let tr1 = { x: xArr, y: yArr1, mode: 'lines', name: nTitle, line: { color: item.color, width: 2, dash: lineDash } };
            // DÙNG HÀM CỤC BỘ Ở ĐÂY
            if (item.isFilled) { tr1.fill = 'tozeroy'; tr1.fillcolor = hexToRgbaLocal(item.color, 0.3); }
            traces.push(tr1);
        }
    });

    let yTitle = type === 'dielectric' ? 'Real & Imaginary (ε)' : type === 'absorption' ? 'Absorption Coefficient α (cm⁻¹)' : type === 'refractive' ? 'Index' : type === 'reflectivity' ? 'Reflectivity R' : type === 'tauc_direct' ? '(αhν)² (eV/cm)²' : type === 'tauc_indirect' ? '(αhν)^0.5 (eV/cm)^0.5' : 'Loss Function L(ω)';
    Plotly.newPlot('plot-container', traces, { font: { family: 'Arial', size: 14 }, plot_bgcolor: 'white', paper_bgcolor: 'white', xaxis: { title: xAxis === 'nm' ? 'Wavelength (nm)' : 'Energy (eV)', range: [xMin, xMax], mirror: true, showline: true, linewidth: 1.5, linecolor: 'black' }, yaxis: { title: yTitle, mirror: true, showline: true, linewidth: 1.5, linecolor: 'black', rangemode: 'tozero' }, margin: { l: 80, r: 20, t: 40, b: 60 } });
}

function handleW90KuboFiles(files) {
    if (files.length === 0) return;
    let validFiles = Array.from(files).filter(f => f.name.includes('.dat') || f.name.includes('.txt'));
    if (validFiles.length === 0) return alert("❌ Không tìm thấy file hợp lệ!");

    let filesRead = 0;
    validFiles.forEach((file) => {
        let r = new FileReader();
        r.onload = ev => {
            let convertedData = parseW90KuboData(ev.target.result);
            if (convertedData.x.length > 0) {
                let shortName = file.name;
                let match = shortName.match(/_([xyz]{2})\./i);
                if (match) shortName = match[1];
                else shortName = shortName.replace('.dat', '');

                w90OptKuboFiles.push({
                    id: 'w90k_' + (w90OptCounter++),
                    label: shortName,
                    color: w90OptColors[w90OptKuboFiles.length % w90OptColors.length],
                    isChecked: false,
                    isFilled: false, isDashed: false,
                    x: convertedData.x, e1: convertedData.e1, e2: convertedData.e2
                });
            }
            filesRead++;
            if (filesRead === validFiles.length) { window.renderW90OptUI(); window.drawW90Optical(); }
        };
        r.readAsText(file);
    });
}

document.getElementById('w90OptKuboInput').addEventListener('change', e => { handleW90KuboFiles(e.target.files); e.target.value = ''; });
document.getElementById('w90OptMultiInput').addEventListener('change', e => { handleW90KuboFiles(e.target.files); e.target.value = ''; });

// KẾT NỐI SỰ KIỆN GIAO DIỆN
window.toggleW90KuboCheck = (id, chk) => { w90OptKuboFiles.find(i => i.id === id).isChecked = chk; window.drawW90Optical(); };
window.changeW90KuboColor = (id, col) => { w90OptKuboFiles.find(i => i.id === id).color = col; window.drawW90Optical(); };
window.changeW90KuboLabel = (id, lbl) => { w90OptKuboFiles.find(i => i.id === id).label = lbl; window.drawW90Optical(); };
window.toggleW90KuboDash = (id, chk) => { w90OptKuboFiles.find(i => i.id === id).isDashed = chk; window.drawW90Optical(); };
window.toggleW90KuboFill = (id, chk) => { w90OptKuboFiles.find(i => i.id === id).isFilled = chk; window.drawW90Optical(); window.renderW90OptUI(); };
window.deleteW90Kubo = (id) => { w90OptKuboFiles = w90OptKuboFiles.filter(i => i.id !== id); window.renderW90OptUI(); window.drawW90Optical(); };

['w90OptXAxis', 'w90OptPlotType', 'w90OptXMin', 'w90OptXMax'].forEach(id => document.getElementById(id).addEventListener('change', function (e) {
    if (id === 'w90OptXAxis') {
        document.getElementById('w90OptXMin').value = e.target.value === 'nm' ? 200 : 0;
        document.getElementById('w90OptXMax').value = e.target.value === 'nm' ? 1000 : 15;
    }
    window.drawW90Optical();
}));

// ==========================================================
// TÍNH TRUNG BÌNH ĐẲNG HƯỚNG (AVERAGE) TỪ CÁC FILE RỜI
// ==========================================================
let btnAvg = document.getElementById('w90CalcAvgBtn');
if (btnAvg) {
    btnAvg.addEventListener('click', function () {
        let f_xx = w90OptKuboFiles.find(f => f.label.toLowerCase() === 'xx');
        let f_yy = w90OptKuboFiles.find(f => f.label.toLowerCase() === 'yy');
        let f_zz = w90OptKuboFiles.find(f => f.label.toLowerCase() === 'zz');

        if (!f_xx || !f_yy || !f_zz) {
            return alert("❌ Bạn cần upload đủ 3 file có tên/nhãn là 'xx', 'yy' và 'zz' để tính trung bình!");
        }

        let e1_avg = [], e2_avg = [];
        let minLen = Math.min(f_xx.x.length, f_yy.x.length, f_zz.x.length);

        for (let i = 0; i < minLen; i++) {
            e1_avg.push((f_xx.e1[i] + f_yy.e1[i] + f_zz.e1[i]) / 3.0);
            e2_avg.push((f_xx.e2[i] + f_yy.e2[i] + f_zz.e2[i]) / 3.0);
        }

        w90OptKuboFiles.unshift({
            id: 'w90k_' + (w90OptCounter++),
            label: 'Average',
            color: '#000000',
            isChecked: true,
            isFilled: true,
            isDashed: false,
            x: f_xx.x.slice(0, minLen),
            e1: e1_avg,
            e2: e2_avg
        });

        window.renderW90OptUI();
        window.drawW90Optical();
    });
}