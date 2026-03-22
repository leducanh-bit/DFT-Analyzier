// ==========================================================
// 🟣 MOD_OPTICAL.JS - MODULE PHÂN TÍCH QUANG HỌC BẤT BẠI
// ==========================================================
let optData = { eps1: null, eps2: null, eels: null };
let optDirsState = [
    { id: 'xx', label: 'Phương xx', color: '#ef4444', isChecked: true, isDashed: false, isFilled: false },
    { id: 'yy', label: 'Phương yy', color: '#3b82f6', isChecked: false, isDashed: false, isFilled: false },
    { id: 'zz', label: 'Phương zz', color: '#10b981', isChecked: false, isDashed: false, isFilled: false },
    { id: 'avg', label: 'Trung bình', color: '#000000', isChecked: true, isDashed: false, isFilled: true }
];

function rgbaLocal(hex, alpha) {
    if (!hex) return `rgba(0,0,0,${alpha})`;
    if (hex.startsWith('#')) hex = hex.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    let r = parseInt(hex.slice(0, 2), 16) || 0, g = parseInt(hex.slice(2, 4), 16) || 0, b = parseInt(hex.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function renderOptDirUI() {
    const area = document.getElementById('optDirControlArea'); if (!area) return; area.innerHTML = '';
    optDirsState.forEach(item => {
        let isCh = item.isChecked ? 'checked' : '', isDa = item.isDashed ? 'checked' : '', isFi = item.isFilled ? 'checked' : '', fw = item.id === 'avg' ? 'bold' : 'normal';
        area.insertAdjacentHTML('beforeend', `<div style="display: flex; align-items: center; padding: 4px; border-bottom: 1px solid #e9d5ff;"><input type="checkbox" ${isCh} onchange="window.updateOptDir('${item.id}', 'check', this.checked)" style="margin-right: 5px;"><input type="color" value="${item.color}" onchange="window.updateOptDir('${item.id}', 'color', this.value)" style="width: 20px; height: 20px; padding: 0; border: none; cursor: pointer; border-radius: 3px;"><span style="flex: 1; margin-left: 8px; font-size: 12px; font-weight: ${fw}; color: #4c1d95;">${item.label}</span><label style="font-size: 11px; cursor: pointer; margin-right: 8px; color: #6b7280;"><input type="checkbox" ${isDa} onchange="window.updateOptDir('${item.id}', 'dash', this.checked)"> ➖</label><label style="font-size: 11px; cursor: pointer; color: #6b7280;"><input type="checkbox" ${isFi} onchange="window.updateOptDir('${item.id}', 'fill', this.checked)"> ⬛</label></div>`);
    });
}
renderOptDirUI();

window.updateOptDir = (id, type, val) => { let i = optDirsState.find(x => x.id === id); if (type === 'check') i.isChecked = val; if (type === 'color') i.color = val; if (type === 'dash') i.isDashed = val; if (type === 'fill') i.isFilled = val; window.drawOptical(); };

function parseOptFile(rawText) {
    const lines = rawText.split('\n'); let data = { E: [], xx: [], yy: [], zz: [], avg: [] };
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim(); if (line === '' || line.startsWith('#')) continue;
        let cols = line.split(/\s+/);
        if (cols.length >= 2) {
            let e = parseFloat(cols[0]); if (isNaN(e)) continue;
            let xx = parseFloat(cols[1]), yy = cols.length > 2 ? parseFloat(cols[2]) : xx, zz = cols.length > 3 ? parseFloat(cols[3]) : xx;
            data.E.push(e); data.xx.push(xx); data.yy.push(yy); data.zz.push(zz); data.avg.push((xx + yy + zz) / 3.0);
        }
    } return data;
}

document.getElementById('optEpsrInput').addEventListener('change', e => { let f = e.target.files[0]; if (!f) return; let r = new FileReader(); r.onload = ev => { optData.eps1 = parseOptFile(ev.target.result); alert("✅ Đã nạp ε1"); window.drawOptical(); }; r.readAsText(f); });
document.getElementById('optEpsiInput').addEventListener('change', e => { let f = e.target.files[0]; if (!f) return; let r = new FileReader(); r.onload = ev => { optData.eps2 = parseOptFile(ev.target.result); alert("✅ Đã nạp ε2"); window.drawOptical(); }; r.readAsText(f); });
document.getElementById('optEelsInput').addEventListener('change', e => { let f = e.target.files[0]; if (!f) return; let r = new FileReader(); r.onload = ev => { optData.eels = parseOptFile(ev.target.result); alert("✅ Đã nạp EELS"); window.drawOptical(); }; r.readAsText(f); });

window.drawOptical = function () {
    if (!optData.eps1 || !optData.eps2) return;
    Plotly.purge('plot-container'); // QUÉT DỌN RÁC TRƯỚC KHI VẼ

    const type = document.getElementById('optPlotType').value, xAxis = document.getElementById('optXAxis').value;
    const xMin = parseFloat(document.getElementById('optXMin').value) || (xAxis === 'nm' ? 200 : 0);
    const xMax = parseFloat(document.getElementById('optXMax').value) || (xAxis === 'nm' ? 1000 : 15);

    let selectedDirs = optDirsState.filter(item => item.isChecked); if (selectedDirs.length === 0) return alert("Chọn ít nhất 1 hướng!");
    let traces = [];

    selectedDirs.forEach(item => {
        let xArr = [], yArr1 = [], yArr2 = [];
        let minLen = Math.min(optData.eps1.E.length, optData.eps2.E.length);

        for (let i = 0; i < minLen; i++) {
            let E = optData.eps1.E[i]; if (E <= 0.01 && xAxis === 'nm') continue;
            let e1 = optData.eps1[item.id][i], e2 = optData.eps2[item.id][i];
            let mod = Math.sqrt(e1 * e1 + e2 * e2);
            let n = Math.sqrt(Math.max(0, (mod + e1) / 2));
            let k = Math.sqrt(Math.max(0, (mod - e1) / 2));

            let val1 = 0, val2 = null;
            if (type === 'dielectric') { val1 = e1; val2 = e2; }
            else if (type === 'refractive') { val1 = n; val2 = k; }
            else if (type === 'absorption') { val1 = 101325 * k * E; }
            else if (type === 'reflectivity') { val1 = (Math.pow(n - 1, 2) + k * k) / (Math.pow(n + 1, 2) + k * k); }
            else if (type === 'tauc_direct') { val1 = Math.pow(101325 * k * E * E, 2); }
            else if (type === 'tauc_indirect') { val1 = Math.pow(101325 * k * E * E, 0.5); }
            else if (type === 'eels') { if (optData.eels && optData.eels[item.id]) val1 = optData.eels[item.id][i]; else val1 = e2 / (e1 * e1 + e2 * e2); }

            yArr1.push(val1); if (val2 !== null) yArr2.push(val2);
            xArr.push(xAxis === 'nm' ? (1240.0 / E) : E);
        }

        let lineDash = item.isDashed ? 'dash' : 'solid';
        if (type === 'dielectric' || type === 'refractive') {
            let tr1 = { x: xArr, y: yArr1, mode: 'lines', name: type === 'dielectric' ? `ε₁ (${item.id})` : `n (${item.id})`, line: { color: item.color, width: 2, dash: lineDash } };
            if (item.isFilled) { tr1.fill = 'tozeroy'; tr1.fillcolor = rgbaLocal(item.color, 0.3); }
            traces.push(tr1);
            traces.push({ x: xArr, y: yArr2, mode: 'lines', name: type === 'dielectric' ? `ε₂ (${item.id})` : `k (${item.id})`, line: { color: item.color, width: 2, dash: 'dot' } });
        } else {
            let nTitle = type === 'absorption' ? `Absorption α (${item.id})` : type === 'reflectivity' ? `Reflectivity R (${item.id})` : type === 'eels' ? `EELS (${item.id})` : `Tauc Plot (${item.id})`;
            let tr1 = { x: xArr, y: yArr1, mode: 'lines', name: nTitle, line: { color: item.color, width: 2, dash: lineDash } };
            if (item.isFilled) { tr1.fill = 'tozeroy'; tr1.fillcolor = rgbaLocal(item.color, 0.3); }
            traces.push(tr1);
        }
    });

    let yTitle = type === 'dielectric' ? 'Dielectric Constant' : type === 'absorption' ? 'Absorption Coefficient α (cm⁻¹)' : type === 'refractive' ? 'Index' : type === 'reflectivity' ? 'Reflectivity R' : type === 'tauc_direct' ? '(αhν)² (eV/cm)²' : type === 'tauc_indirect' ? '(αhν)^0.5 (eV/cm)^0.5' : 'Loss Function L(ω)';
    Plotly.newPlot('plot-container', traces, { font: { family: 'Arial', size: 14 }, plot_bgcolor: 'white', paper_bgcolor: 'white', xaxis: { title: xAxis === 'nm' ? 'Wavelength (nm)' : 'Energy (eV)', range: [xMin, xMax], mirror: true, showline: true, linewidth: 1.5, linecolor: 'black' }, yaxis: { title: yTitle, mirror: true, showline: true, linewidth: 1.5, linecolor: 'black', rangemode: 'tozero' }, margin: { l: 80, r: 20, t: 40, b: 60 } });
}

document.getElementById('optDrawBtn').addEventListener('click', window.drawOptical);
document.getElementById('optXAxis').addEventListener('change', function (e) { document.getElementById('optXMin').value = e.target.value === 'nm' ? 200 : 0; document.getElementById('optXMax').value = e.target.value === 'nm' ? 1000 : 15; window.drawOptical(); });
document.getElementById('optPlotType').addEventListener('change', window.drawOptical);