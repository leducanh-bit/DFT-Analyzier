// ==========================================================
// ⚛️ MOD_BADER.JS - TỰ ĐỘNG PHÂN TÍCH CHUYỂN GIAO ĐIỆN TÍCH
// ==========================================================
let baderOutData = { valences: {}, atoms: [] };
let baderAcfData = [];

// 1. Lắng nghe nạp file .OUT (Quét ZVAL và Thứ tự nguyên tử)
document.getElementById('baderOutInput').addEventListener('change', function (e) {
    let f = e.target.files[0]; if (!f) return;
    let r = new FileReader();
    r.onload = ev => {
        let lines = ev.target.result.split('\n');
        let isSpecies = false, isAtoms = false;
        baderOutData = { valences: {}, atoms: [] }; // Reset toàn bộ

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            // Bắt khối ZVAL
            if (line.includes('atomic species   valence')) { isSpecies = true; continue; }
            if (isSpecies && line === '') { isSpecies = false; }
            if (isSpecies) {
                let parts = line.split(/\s+/);
                if (parts.length >= 2) baderOutData.valences[parts[0]] = parseFloat(parts[1]);
            }

            // Bắt khối Thứ tự nguyên tử (ĐÃ SỬA LỖI LẶP DỮ LIỆU)
            if (line.includes('site n.     atom') && line.includes('positions')) {
                isAtoms = true;
                baderOutData.atoms = []; // Đổ sạch rổ trước khi nhặt lại
                continue;
            }
            if (isAtoms && line === '') { isAtoms = false; }
            if (isAtoms) {
                let parts = line.split(/\s+/);
                if (parts.length >= 2 && !isNaN(parseInt(parts[0]))) {
                    baderOutData.atoms.push(parts[1]);
                }
            }
        }
        document.getElementById('baderOutStatus').innerText = `✅ Đã gắp được ZVAL của ${Object.keys(baderOutData.valences).join(', ')} và ${baderOutData.atoms.length} nguyên tử.`;
    };
    r.readAsText(f);
});

// 2. Lắng nghe nạp file ACF.dat (Quét Charge)
document.getElementById('baderAcfInput').addEventListener('change', function (e) {
    let f = e.target.files[0]; if (!f) return;
    let r = new FileReader();
    r.onload = ev => {
        let lines = ev.target.result.split('\n');
        baderAcfData = []; // Reset
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            // Bỏ qua header và footer (chứa dẫu gạch ngang hoặc chữ cái)
            if (line === '' || line.startsWith('-') || line.includes('X') || line.includes('NUMBER')) continue;
            let parts = line.split(/\s+/);
            if (parts.length >= 5 && !isNaN(parseInt(parts[0]))) {
                baderAcfData.push(parseFloat(parts[4])); // Cột số 5 là CHARGE
            }
        }
        document.getElementById('baderAcfStatus').innerText = `✅ Đã đọc thành công Charge của ${baderAcfData.length} nguyên tử.`;
    };
    r.readAsText(f);
});

// 3. Thực hiện phép trừ và Vẽ biểu đồ Bar Chart
document.getElementById('plotBaderBtn').addEventListener('click', function () {
    if (baderOutData.atoms.length === 0 || baderAcfData.length === 0) {
        return alert("❌ Vui lòng nạp đủ cả 2 file scf.out và ACF.dat trước!");
    }
    if (baderOutData.atoms.length !== baderAcfData.length) {
        return alert(`⚠️ Cảnh báo: Số nguyên tử trong file .out (${baderOutData.atoms.length}) không khớp với ACF.dat (${baderAcfData.length})!`);
    }

    currentEngine = 'bader'; // Đổi cờ engine
    Plotly.purge('plot-container');

    let xLabels = [], yValues = [], colors = [], hoverTexts = [];

    for (let i = 0; i < baderAcfData.length; i++) {
        let species = baderOutData.atoms[i];
        let zval = baderOutData.valences[species] || 0;
        let charge = baderAcfData[i];

        let deltaE = charge - zval; // > 0: Nhận e (Màu Đỏ), < 0: Mất e (Màu Xanh)

        xLabels.push(`${species}${i + 1}`);
        yValues.push(deltaE);
        colors.push(deltaE > 0 ? '#ef4444' : '#3b82f6'); // Đỏ cho Nhận, Xanh cho Mất

        hoverTexts.push(`Nguyên tử: <b>${species}${i + 1}</b><br>ZVAL gốc: ${zval} e<br>Bader Charge: ${charge.toFixed(4)} e<br>Chênh lệch: <b>${deltaE > 0 ? '+' : ''}${deltaE.toFixed(4)} e</b>`);
    }

    let trace = {
        x: xLabels,
        y: yValues,
        type: 'bar',
        marker: { color: colors, line: { color: '#000', width: 1 } },
        text: yValues.map(v => v > 0 ? `+${v.toFixed(2)}` : `${v.toFixed(2)}`),
        textposition: 'outside',
        hoverinfo: 'text',
        hovertext: hoverTexts
    };

    let layout = {
        title: {
            text: '<b>Bader Charge Transfer (Δe)</b>',
            font: { size: 24, color: '#1e3a8a', family: 'Arial' },
            y: 0.95 // Đẩy title lên sát mép trên cùng
        },
        xaxis: {
            title: { text: '<b>Atoms</b>', font: { size: 14, color: '#374151' } },
            tickangle: -45,
            showgrid: false,
            tickfont: { size: 11, color: '#4b5563', weight: 'bold' }
        },
        yaxis: {
            title: { text: '<b>Electron Transfer (e)</b>', font: { size: 14, color: '#374151' } },
            zeroline: true,
            zerolinecolor: '#111827',
            zerolinewidth: 2, // Làm đậm trục số 0
            gridcolor: '#f3f4f6'
        },
        plot_bgcolor: 'white',
        paper_bgcolor: 'white',
        // margin.t (top) được tăng lên 120 để có chỗ rộng rãi cho Ghi chú
        margin: { b: 80, t: 120, l: 70, r: 30 },
        annotations: [{
            // Ghi chú được căn giữa và nằm gọn gàng dưới Title, trên Đồ thị
            x: 0.5, y: 1.15,
            xref: 'paper', yref: 'paper',
            xanchor: 'center', yanchor: 'bottom',
            showarrow: false,
            text: '<span style="color:#dc2626;"><b>🟥 Nhận Electron (Acceptor)</b></span> &nbsp;&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;&nbsp; <span style="color:#2563eb;"><b>🟦 Mất Electron (Donor)</b></span>',
            font: { size: 13, family: 'Arial' },
            bgcolor: '#f8fafc', // Nền xám nhạt
            bordercolor: '#cbd5e1', // Viền mỏng
            borderwidth: 1,
            borderpad: 8, // Đệm viền cho đẹp
            bordercolor: '#94a3b8'
        }]
    };

    Plotly.newPlot('plot-container', [trace], layout, { displaylogo: false });
    alert("✅ Vẽ biểu đồ Bader thành công!");
});