// ==========================================================
// 🔵 MOD_BAND_W90.JS - CHỈ XỬ LÝ WANNIER90
// ==========================================================
let w90RawBand = "", w90RawDOS = "", w90BandTraces = [], w90DOSTrace = null, w90GapData = null;
let w90IsGapDrawn = false; // Biến ghi nhớ trạng thái bật/tắt đường HOMO-LUMO

function getW90Layout() {
    const yMin = parseFloat(document.getElementById('w90YMin').value) || -6, yMax = parseFloat(document.getElementById('w90YMax').value) || 6;
    const kLines = document.getElementById('w90KptText').value.split('\n');
    let tickVals = [], tickText = [], verticalShapes = [];
    kLines.forEach(line => {
        let parts = line.trim().split(/\s+/);
        if (parts.length >= 2 && !isNaN(parseFloat(parts[0]))) {
            tickVals.push(parseFloat(parts[0])); tickText.push(parts[1].toLowerCase() === 'gamma' ? 'Γ' : parts[1]);
            verticalShapes.push({ type: 'line', x0: parseFloat(parts[0]), x1: parseFloat(parts[0]), y0: 0, y1: 1, yref: 'paper', line: { color: '#000000', width: 1, dash: 'solid' } });
        }
    });
    return { font: { family: 'Arial', size: 14, color: '#000' }, plot_bgcolor: 'white', paper_bgcolor: 'white', showlegend: false, grid: { rows: 1, columns: 2, pattern: 'independent' }, xaxis: { domain: [0, 0.65], tickvals: tickVals, ticktext: tickText, showline: true, linewidth: 1.5, linecolor: 'black', mirror: true }, xaxis2: { title: 'DOS (arb. unit)', domain: [0.7, 1], showline: true, linewidth: 1.5, linecolor: 'black', mirror: true }, yaxis: { title: 'Energy - E<sub>F</sub> (eV)', range: [yMin, yMax], showline: true, linewidth: 1.5, linecolor: 'black', mirror: true }, margin: { l: 60, r: 20, t: 40, b: 60 }, shapes: verticalShapes };
}

window.renderW90Plot = function () {
    if (currentEngine !== 'w90') return;
    Plotly.purge('plot-container');

    let data = [];
    if (w90BandTraces.length > 0) data = data.concat(w90BandTraces);
    if (w90DOSTrace !== null) data.push(w90DOSTrace);
    let maxX = w90BandTraces.length > 0 && w90BandTraces[0].x.length > 0 ? w90BandTraces[0].x[w90BandTraces[0].x.length - 1] : 10;
    data.push({ x: [0, maxX], y: [0, 0], mode: 'lines', line: { color: 'red', width: 1, dash: 'dash' }, xaxis: 'x1', yaxis: 'y1', hoverinfo: 'none' });

    let layout = getW90Layout();

    // Nếu công tắc đang BẬT, nhúng luôn mũi tên và điểm vào bộ vẽ chính
    if (w90IsGapDrawn && w90GapData) {
        layout.annotations = [{ x: w90GapData.lK, y: w90GapData.lE, xref: 'x', yref: 'y', ax: w90GapData.hK, ay: w90GapData.hE, axref: 'x', ayref: 'y', text: `<b>${w90GapData.gap.toFixed(2)} eV</b>`, showarrow: true, arrowhead: 2, arrowcolor: '#1d4ed8', font: { size: 14, color: '#1d4ed8' }, bgcolor: 'white', bordercolor: '#1d4ed8', borderpad: 3 }];
        data.push({ x: [w90GapData.hK, w90GapData.lK], y: [w90GapData.hE, w90GapData.lE], mode: 'markers', marker: { size: 10, color: ['#dc2626', '#2563eb'], line: { color: 'white', width: 1.5 } }, showlegend: false, hoverinfo: 'none' });
    }

    Plotly.newPlot('plot-container', data, layout, { editable: true, displaylogo: false });
}

window.updateW90Graphs = function () {
    if (currentEngine !== 'w90') return;
    const ef = parseFloat(document.getElementById('w90FermiVal').value) || 0;
    const bColor = document.getElementById('w90BandColor').value;
    const dColor = document.getElementById('w90DosColor').value;

    if (w90RawBand) {
        const lines = w90RawBand.split('\n'); w90BandTraces = []; let cK = [], cE = [];
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line === '' || line.startsWith('#')) { if (cK.length > 0) { w90BandTraces.push({ x: cK, y: cE, mode: 'lines', line: { color: bColor, width: 1.5 } }); cK = []; cE = []; } continue; }
            let cols = line.split(/\s+/); if (cols.length >= 2 && !isNaN(cols[0])) { cK.push(parseFloat(cols[0])); cE.push(parseFloat(cols[1]) - ef); }
        }
        if (cK.length > 0) w90BandTraces.push({ x: cK, y: cE, mode: 'lines', line: { color: bColor, width: 1.5 } });

        let hE = -Infinity, lE = Infinity, hK = 0, lK = 0;
        w90BandTraces.forEach(t => { for (let i = 0; i < t.y.length; i++) { let e = t.y[i], k = t.x[i]; if (e <= 0.0001 && e > hE) { hE = e; hK = k; } if (e > 0.0001 && e < lE) { lE = e; lK = k; } } });

        const btn = document.getElementById('w90DrawGapBtn');
        if (hE !== -Infinity && lE !== Infinity) {
            document.getElementById('w90ResultBox').style.display = 'block'; let gap = lE - hE;
            if (gap < 0.05) {
                document.getElementById('w90GapType').innerHTML = "Vật liệu Kim loại";
                document.getElementById('w90GapOutput').innerHTML = `Gap ≈ 0 eV<br><span style="font-size:12px; color:#374151; font-weight:normal;">Đường cắt qua mức Fermi</span>`;
                btn.style.display = 'none'; w90GapData = null; w90IsGapDrawn = false;
            } else {
                document.getElementById('w90GapType').innerHTML = Math.abs(hK - lK) < 0.01 ? "🔴 Direct Bandgap" : "🔵 Indirect Bandgap";
                // IN RA THÔNG SỐ HOMO LUMO CỤ THỂ
                document.getElementById('w90GapOutput').innerHTML = `${gap.toFixed(4)} eV<br><span style="font-size:12px; color:#374151; font-weight:normal;">HOMO: ${hE.toFixed(4)} eV | LUMO: ${lE.toFixed(4)} eV</span>`;
                btn.style.display = 'block';
                w90GapData = { hK: hK, hE: hE, lK: lK, lE: lE, gap: gap };
            }
        }

        // Cập nhật trạng thái hiển thị của nút
        btn.innerHTML = w90IsGapDrawn ? "❌ Tắt đường HOMO-LUMO" : "🎯 Kẻ HOMO-LUMO";
        btn.style.background = w90IsGapDrawn ? "#ef4444" : "#3b82f6"; // Chuyển màu đỏ khi bật
    }
    if (w90RawDOS) {
        const lines = w90RawDOS.split('\n'); let x = [], y = [];
        for (let i = 0; i < lines.length; i++) {
            let cols = lines[i].trim().split(/\s+/);
            if (cols.length >= 2 && !isNaN(cols[0])) { y.push(parseFloat(cols[0]) - ef); x.push(parseFloat(cols[1])); }
        }
        w90DOSTrace = { x: x, y: y, mode: 'lines', line: { color: dColor, width: 2 }, xaxis: 'x2', yaxis: 'y1', fill: 'tozerox' };
    }
    window.renderW90Plot();
};

// CÔNG TẮC BẬT/TẮT HOMO-LUMO
window.toggleW90Gap = function () {
    if (!w90GapData) return;
    w90IsGapDrawn = !w90IsGapDrawn;
    window.updateW90Graphs();
};

// ================= LẮNG NGHE SỰ KIỆN =================
document.getElementById('w90BandInput').addEventListener('change', e => { let f = e.target.files[0]; if (!f) return; let r = new FileReader(); r.onload = ev => { w90RawBand = ev.target.result; window.updateW90Graphs(); }; r.readAsText(f); e.target.value = ''; });
document.getElementById('w90DosInput').addEventListener('change', e => { let f = e.target.files[0]; if (!f) return; let r = new FileReader(); r.onload = ev => { w90RawDOS = ev.target.result; window.updateW90Graphs(); }; r.readAsText(f); e.target.value = ''; });
document.getElementById('w90FermiInput').addEventListener('change', e => { let f = e.target.files[0]; if (!f) return; let r = new FileReader(); r.onload = ev => { let t = ev.target.result; let ef = (t.match(/Fermi.*?energy.*?\s+([-+]?\d*\.?\d+)/i) || t.match(/highest occupied.*?level[^\d]*([-+]?\d*\.?\d+)/i)); if (ef) { document.getElementById('w90FermiVal').value = parseFloat(ef[1]); window.updateW90Graphs(); alert("✅ Đã nạp Fermi W90"); } }; r.readAsText(f); e.target.value = ''; });
document.getElementById('w90KptInput').addEventListener('change', e => { let f = e.target.files[0]; if (!f) return; let r = new FileReader(); r.onload = ev => { let t = ev.target.result.split('\n'), c = 0, str = ""; t.forEach(l => { let p = l.trim().split(/\s+/); if (p.length >= 3 && !isNaN(p[1])) { str += `${parseFloat(p[2]).toFixed(4)} ${p[0].toUpperCase() === 'G' ? 'Gamma' : p[0]}\n`; c++; } }); if (c > 0) { document.getElementById('w90KptText').value = str.trim(); window.renderW90Plot(); } }; r.readAsText(f); e.target.value = ''; });

document.getElementById('w90UpdateBtn').addEventListener('click', window.updateW90Graphs);
['w90BandColor', 'w90DosColor', 'w90YMin', 'w90YMax', 'w90FermiVal'].forEach(id => { document.getElementById(id).addEventListener('change', window.updateW90Graphs); });
document.getElementById('w90KptText').addEventListener('input', window.renderW90Plot);

// Gắn dây thần kinh cho nút Toggle
document.getElementById('w90DrawGapBtn').addEventListener('click', window.toggleW90Gap);
// ==========================================================
// 🚀 TỰ ĐỘNG NỘI SUY PARABOL & TÍNH KHỐI LƯỢNG HIỆU DỤNG (W90)
// ==========================================================
let btnW90Mass = document.getElementById('calcW90MassBtn');
if (btnW90Mass) {
    btnW90Mass.addEventListener('click', function () {
        let plotDiv = document.getElementById('plot-container');
        if (!plotDiv || !plotDiv.data || plotDiv.data.length === 0) {
            return alert("❌ Bạn phải vẽ đồ thị W90 Band trước khi tính!");
        }

        let data = plotDiv.data;
        let vbm = { x: 0, y: -Infinity, traceIdx: -1, ptIdx: -1 };
        let cbm = { x: 0, y: Infinity, traceIdx: -1, ptIdx: -1 };

        // 1. Quét tìm VBM và CBM trên đồ thị
        data.forEach((trace, tIdx) => {
            if (trace.mode !== 'lines' || !trace.y || trace.line.dash === 'dash' || trace.line.dash === 'dot') return;

            for (let i = 0; i < trace.y.length; i++) {
                let y = trace.y[i];
                let x = trace.x[i];
                if (y <= 0 && y > vbm.y) vbm = { x: x, y: y, traceIdx: tIdx, ptIdx: i };
                if (y > 0 && y < cbm.y) cbm = { x: x, y: y, traceIdx: tIdx, ptIdx: i };
            }
        });

        if (vbm.traceIdx === -1 || cbm.traceIdx === -1) {
            return alert("❌ Không tìm thấy đỉnh/đáy phù hợp! Hãy đảm bảo mức Fermi đã trượt về 0.");
        }

        // 2. Thuật toán Fit Parabol
        function fitParabola(traceIdx, ptIdx) {
            let trace = data[traceIdx];
            let pts = 6;
            let xArr = [], yArr = [];

            let start = Math.max(0, ptIdx - pts);
            let end = Math.min(trace.x.length - 1, ptIdx + pts);

            for (let i = start; i <= end; i++) {
                xArr.push(trace.x[i]);
                yArr.push(trace.y[i]);
            }

            let n = xArr.length;
            let s1 = 0, s2 = 0, s3 = 0, s4 = 0, sy = 0, sxy = 0, sx2y = 0;
            for (let i = 0; i < n; i++) {
                let x = xArr[i], y = yArr[i];
                s1 += x; s2 += x * x; s3 += Math.pow(x, 3); s4 += Math.pow(x, 4);
                sy += y; sxy += x * y; sx2y += x * x * y;
            }

            let D = s4 * (s2 * n - s1 * s1) - s3 * (s3 * n - s1 * s2) + s2 * (s3 * s1 - s2 * s2);
            let Da = sx2y * (s2 * n - s1 * s1) - s3 * (sxy * n - sy * s1) + s2 * (sxy * s1 - sy * s2);
            let Db = s4 * (sxy * n - sy * s1) - sx2y * (s3 * n - s1 * s2) + s2 * (s3 * sy - sxy * s2);
            let Dc = s4 * (s2 * sy - s1 * sxy) - s3 * (s3 * sy - sxy * s2) + sx2y * (s3 * s1 - s2 * s2);

            return { a: Da / D, b: Db / D, c: Dc / D, xMin: xArr[0], xMax: xArr[xArr.length - 1] };
        }

        let fitVBM = fitParabola(vbm.traceIdx, vbm.ptIdx);
        let fitCBM = fitParabola(cbm.traceIdx, cbm.ptIdx);

        // 3. Quy đổi Khối lượng (Trục k của W90 cũng dùng đơn vị 1/Angstrom)
        const CONSTANT = 3.80998;
        let m_h = Math.abs(CONSTANT / (2 * fitVBM.a));
        let m_e = Math.abs(CONSTANT / (2 * fitCBM.a));

        // 4. In kết quả chuẩn HTML (GIAO DIỆN THẺ HIỆN ĐẠI)
        let resArea = document.getElementById('w90MassResultArea');
        resArea.style.cssText = 'margin-top: 15px; display: block;'; // Xóa viền cũ xấu xí
        resArea.innerHTML = `
            <div style="display: flex; gap: 10px;">
                <div style="flex: 1; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="font-size: 11px; color: #1d4ed8; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">🔵 Lỗ trống (VBM)</div>
                    <div style="font-size: 14px; color: #1e3a8a; margin-top: 8px;">m<sup>*</sup><sub>h</sub> = <span style="font-size: 22px; font-weight: 900;">${m_h.toFixed(3)}</span> m<sub>0</sub></div>
                </div>
                <div style="flex: 1; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="font-size: 11px; color: #b91c1c; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">🔴 Điện tử (CBM)</div>
                    <div style="font-size: 14px; color: #7f1d1d; margin-top: 8px;">m<sup>*</sup><sub>e</sub> = <span style="font-size: 22px; font-weight: 900;">${m_e.toFixed(3)}</span> m<sub>0</sub></div>
                </div>
            </div>
        `;

        // 5. Vẽ đè đường nội suy
        let traceVBM_Fit = { x: [], y: [], mode: 'lines', name: 'VBM Fit', line: { color: 'blue', width: 3, dash: 'dot' } };
        let traceCBM_Fit = { x: [], y: [], mode: 'lines', name: 'CBM Fit', line: { color: 'red', width: 3, dash: 'dot' } };

        for (let i = 0; i <= 50; i++) {
            let x_v = fitVBM.xMin + (fitVBM.xMax - fitVBM.xMin) * (i / 50);
            traceVBM_Fit.x.push(x_v);
            traceVBM_Fit.y.push(fitVBM.a * x_v * x_v + fitVBM.b * x_v + fitVBM.c);

            let x_c = fitCBM.xMin + (fitCBM.xMax - fitCBM.xMin) * (i / 50);
            traceCBM_Fit.x.push(x_c);
            traceCBM_Fit.y.push(fitCBM.a * x_c * x_c + fitCBM.b * x_c + fitCBM.c);
        }

        Plotly.addTraces('plot-container', [traceVBM_Fit, traceCBM_Fit]);
        alert("✅ Tính toán m* từ Wannier90 thành công!");
    });
}