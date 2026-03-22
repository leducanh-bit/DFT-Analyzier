// ==========================================================
// 🟢 MOD_BAND_QE.JS - CHỈ XỬ LÝ QUANTUM ESPRESSO
// ==========================================================
let qeRawBand = "", qeRawDOS = "", qeBandTraces = [], qeDOSTrace = null, qeGapData = null;
let qeIsGapDrawn = false; // Biến ghi nhớ trạng thái bật/tắt đường HOMO-LUMO

function getQeLayout() {
    const yMin = parseFloat(document.getElementById('qeYMin').value) || -6, yMax = parseFloat(document.getElementById('qeYMax').value) || 6;
    const kLines = document.getElementById('qeKptText').value.split('\n');
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

window.renderQePlot = function () {
    if (currentEngine !== 'qe') return;
    Plotly.purge('plot-container');

    let data = [];
    if (qeBandTraces.length > 0) data = data.concat(qeBandTraces);
    if (qeDOSTrace !== null) data.push(qeDOSTrace);
    let maxX = qeBandTraces.length > 0 && qeBandTraces[0].x.length > 0 ? qeBandTraces[0].x[qeBandTraces[0].x.length - 1] : 10;
    data.push({ x: [0, maxX], y: [0, 0], mode: 'lines', line: { color: 'red', width: 1, dash: 'dash' }, xaxis: 'x1', yaxis: 'y1', hoverinfo: 'none' });

    let layout = getQeLayout();

    // Nếu công tắc đang BẬT, tự động nhúng luôn mũi tên và 2 điểm HOMO/LUMO vào bộ vẽ chính
    if (qeIsGapDrawn && qeGapData) {
        layout.annotations = [{ x: qeGapData.lK, y: qeGapData.lE, xref: 'x', yref: 'y', ax: qeGapData.hK, ay: qeGapData.hE, axref: 'x', ayref: 'y', text: `<b>${qeGapData.gap.toFixed(2)} eV</b>`, showarrow: true, arrowhead: 2, arrowcolor: '#d97706', font: { size: 14, color: '#d97706' }, bgcolor: 'white', bordercolor: '#d97706', borderpad: 3 }];
        data.push({ x: [qeGapData.hK, qeGapData.lK], y: [qeGapData.hE, qeGapData.lE], mode: 'markers', marker: { size: 10, color: ['#dc2626', '#2563eb'], line: { color: 'white', width: 1.5 } }, showlegend: false, hoverinfo: 'none' });
    }

    Plotly.newPlot('plot-container', data, layout, { editable: true, displaylogo: false });
}

window.updateQeGraphs = function () {
    if (currentEngine !== 'qe') return;
    const ef = parseFloat(document.getElementById('qeFermiVal').value) || 0;
    const bColor = document.getElementById('qeBandColor').value;
    const dColor = document.getElementById('qeDosColor').value;

    if (qeRawBand) {
        const lines = qeRawBand.split('\n'); qeBandTraces = []; let cK = [], cE = [];
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line === '' || line.startsWith('#')) { if (cK.length > 0) { qeBandTraces.push({ x: cK, y: cE, mode: 'lines', line: { color: bColor, width: 1.5 } }); cK = []; cE = []; } continue; }
            let cols = line.split(/\s+/); if (cols.length >= 2 && !isNaN(cols[0])) { cK.push(parseFloat(cols[0])); cE.push(parseFloat(cols[1]) - ef); }
        }
        if (cK.length > 0) qeBandTraces.push({ x: cK, y: cE, mode: 'lines', line: { color: bColor, width: 1.5 } });

        let hE = -Infinity, lE = Infinity, hK = 0, lK = 0;
        qeBandTraces.forEach(t => { for (let i = 0; i < t.y.length; i++) { let e = t.y[i], k = t.x[i]; if (e <= 0.0001 && e > hE) { hE = e; hK = k; } if (e > 0.0001 && e < lE) { lE = e; lK = k; } } });

        const btn = document.getElementById('qeDrawGapBtn');
        if (hE !== -Infinity && lE !== Infinity) {
            document.getElementById('qeResultBox').style.display = 'block'; let gap = lE - hE;
            if (gap < 0.05) {
                document.getElementById('qeGapType').innerHTML = "Vật liệu Kim loại";
                document.getElementById('qeGapOutput').innerHTML = `Gap ≈ 0 eV<br><span style="font-size:12px; color:#374151; font-weight:normal;">Đường cắt qua mức Fermi</span>`;
                btn.style.display = 'none'; qeGapData = null; qeIsGapDrawn = false;
            } else {
                document.getElementById('qeGapType').innerHTML = Math.abs(hK - lK) < 0.01 ? "🔴 Direct Bandgap" : "🔵 Indirect Bandgap";
                // IN RA THÔNG SỐ HOMO LUMO CỤ THỂ
                document.getElementById('qeGapOutput').innerHTML = `${gap.toFixed(4)} eV<br><span style="font-size:12px; color:#374151; font-weight:normal;">HOMO: ${hE.toFixed(4)} eV | LUMO: ${lE.toFixed(4)} eV</span>`;
                btn.style.display = 'block';
                qeGapData = { hK: hK, hE: hE, lK: lK, lE: lE, gap: gap };
            }
        }

        // Cập nhật trạng thái hiển thị của nút
        btn.innerHTML = qeIsGapDrawn ? "❌ Tắt đường HOMO-LUMO" : "🎯 Kẻ HOMO-LUMO";
        btn.style.background = qeIsGapDrawn ? "#ef4444" : "#10b981"; // Chuyển màu đỏ khi bật
    }
    if (qeRawDOS) {
        const lines = qeRawDOS.split('\n'); let x = [], y = [];
        for (let i = 0; i < lines.length; i++) {
            let cols = lines[i].trim().split(/\s+/);
            if (cols.length >= 2 && !isNaN(cols[0])) { y.push(parseFloat(cols[0]) - ef); x.push(parseFloat(cols[1])); }
        }
        qeDOSTrace = { x: x, y: y, mode: 'lines', line: { color: dColor, width: 2 }, xaxis: 'x2', yaxis: 'y1', fill: 'tozerox' };
    }
    window.renderQePlot();
};

// CÔNG TẮC BẬT/TẮT HOMO-LUMO
window.toggleQeGap = function () {
    if (!qeGapData) return;
    qeIsGapDrawn = !qeIsGapDrawn; // Lật ngược trạng thái (Bật -> Tắt, Tắt -> Bật)
    window.updateQeGraphs();      // Gọi cập nhật để vẽ lại toàn bộ
};

// ================= LẮNG NGHE SỰ KIỆN =================
document.getElementById('qeBandInput').addEventListener('change', e => { let f = e.target.files[0]; if (!f) return; let r = new FileReader(); r.onload = ev => { qeRawBand = ev.target.result; window.updateQeGraphs(); }; r.readAsText(f); e.target.value = ''; });
document.getElementById('qeDosInput').addEventListener('change', e => { let f = e.target.files[0]; if (!f) return; let r = new FileReader(); r.onload = ev => { qeRawDOS = ev.target.result; window.updateQeGraphs(); }; r.readAsText(f); e.target.value = ''; });
document.getElementById('qeFermiInput').addEventListener('change', e => { let f = e.target.files[0]; if (!f) return; let r = new FileReader(); r.onload = ev => { let t = ev.target.result; let ef = (t.match(/Fermi.*?energy.*?\s+([-+]?\d*\.?\d+)/i) || t.match(/highest occupied.*?level[^\d]*([-+]?\d*\.?\d+)/i)); if (ef) { document.getElementById('qeFermiVal').value = parseFloat(ef[1]); window.updateQeGraphs(); alert("✅ Đã nạp Fermi QE"); } }; r.readAsText(f); e.target.value = ''; });
document.getElementById('qeKptInput').addEventListener('change', e => { let f = e.target.files[0]; if (!f) return; let r = new FileReader(); r.onload = ev => { let t = ev.target.result, m, c = 0, str = "", rx = t.match(/high-symmetry/i) ? /high-symmetry point[^\n]*?x coordinate\s+([-+]?\d*\.?\d+)/gi : /x\s+coordinate\s+([-+]?\d*\.?\d+)/gi, lbls = ['Gamma', 'M', 'K', 'Gamma', 'Z', 'A', 'R', 'X']; while ((m = rx.exec(t)) !== null) { str += `${parseFloat(m[1]).toFixed(4)} ${lbls[c % lbls.length]}\n`; c++; } if (c > 0) { document.getElementById('qeKptText').value = str.trim(); window.renderQePlot(); } }; r.readAsText(f); e.target.value = ''; });

document.getElementById('qeUpdateBtn').addEventListener('click', window.updateQeGraphs);
['qeBandColor', 'qeDosColor', 'qeYMin', 'qeYMax', 'qeFermiVal'].forEach(id => { document.getElementById(id).addEventListener('change', window.updateQeGraphs); });
document.getElementById('qeKptText').addEventListener('input', window.renderQePlot);

// Gắn dây thần kinh mới cho nút Kẻ (Đã thành nút Bật/Tắt)
document.getElementById('qeDrawGapBtn').addEventListener('click', window.toggleQeGap);
// ==========================================================
// 🚀 TỰ ĐỘNG NỘI SUY PARABOL & TÍNH KHỐI LƯỢNG HIỆU DỤNG (m*)
// ==========================================================
document.getElementById('calcMassBtn').addEventListener('click', function () {
    let plotDiv = document.getElementById('plot-container');
    if (!plotDiv || !plotDiv.data || plotDiv.data.length === 0) {
        return alert("❌ Bạn phải vẽ Band Structure trước khi tính!");
    }

    let data = plotDiv.data;
    let vbm = { x: 0, y: -Infinity, traceIdx: -1, ptIdx: -1 };
    let cbm = { x: 0, y: Infinity, traceIdx: -1, ptIdx: -1 };

    // 1. Quét toàn bộ đồ thị để tìm VBM (đỉnh dưới 0) và CBM (đáy trên 0)
    data.forEach((trace, tIdx) => {
        // Bỏ qua các đường gióng ngang/dọc không phải là band
        if (trace.mode !== 'lines' || !trace.y || trace.line.dash === 'dash') return;

        for (let i = 0; i < trace.y.length; i++) {
            let y = trace.y[i];
            let x = trace.x[i];
            if (y <= 0 && y > vbm.y) vbm = { x: x, y: y, traceIdx: tIdx, ptIdx: i };
            if (y > 0 && y < cbm.y) cbm = { x: x, y: y, traceIdx: tIdx, ptIdx: i };
        }
    });

    if (vbm.traceIdx === -1 || cbm.traceIdx === -1) {
        return alert("❌ Không tìm thấy khe năng lượng! Vui lòng chỉnh Fermi cho chuẩn.");
    }

    // 2. Hàm Giải hệ phương trình 3 ẩn bằng Cramer để Fit Parabol (y = ax^2 + bx + c)
    function fitParabola(traceIdx, ptIdx) {
        let trace = data[traceIdx];
        let pts = 6; // Lấy 6 điểm dữ liệu mỗi bên cực trị để nội suy
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

    // Tiến hành Fit
    let fitVBM = fitParabola(vbm.traceIdx, vbm.ptIdx);
    let fitCBM = fitParabola(cbm.traceIdx, cbm.ptIdx);

    // 3. Tính Khối lượng hiệu dụng (Hằng số 3.80998 chuyển đổi cho X tính bằng 1/Angstrom)
    const CONSTANT = 3.80998;
    // a của VBM âm (parabol úp), a của CBM dương (parabol ngửa). Ta lấy trị tuyệt đối
    let m_h = Math.abs(CONSTANT / (2 * fitVBM.a));
    let m_e = Math.abs(CONSTANT / (2 * fitCBM.a));

    // 4. In kết quả ra màn hình (GIAO DIỆN THẺ HIỆN ĐẠI)
    let resArea = document.getElementById('massResultArea');
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

    // 5. Vẽ đè đường Parabol nét đứt lên đồ thị để kiểm chứng
    let traceVBM_Fit = { x: [], y: [], mode: 'lines', name: 'VBM Fit', line: { color: 'blue', width: 3, dash: 'dot' } };
    let traceCBM_Fit = { x: [], y: [], mode: 'lines', name: 'CBM Fit', line: { color: 'red', width: 3, dash: 'dot' } };

    // Tự sinh ra 50 điểm để đường cong mượt mà
    for (let i = 0; i <= 50; i++) {
        let x_v = fitVBM.xMin + (fitVBM.xMax - fitVBM.xMin) * (i / 50);
        traceVBM_Fit.x.push(x_v);
        traceVBM_Fit.y.push(fitVBM.a * x_v * x_v + fitVBM.b * x_v + fitVBM.c);

        let x_c = fitCBM.xMin + (fitCBM.xMax - fitCBM.xMin) * (i / 50);
        traceCBM_Fit.x.push(x_c);
        traceCBM_Fit.y.push(fitCBM.a * x_c * x_c + fitCBM.b * x_c + fitCBM.c);
    }

    Plotly.addTraces('plot-container', [traceVBM_Fit, traceCBM_Fit]);
    alert("✅ Tính toán m* thành công! Đã vẽ đường Parabol kiểm chứng.");
});