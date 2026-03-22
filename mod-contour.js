// ==========================================================
// 🗺️ MOD_CONTOUR.JS - VẼ BẢN ĐỒ MẬT ĐỘ ĐIỆN TÍCH 2D
// ==========================================================
let contourRawData = "";

document.getElementById('contourFileInput').addEventListener('change', function (e) {
    let f = e.target.files[0]; if (!f) return;
    let r = new FileReader();
    r.onload = ev => {
        contourRawData = ev.target.result;
        alert("✅ Đã nạp thành công dữ liệu lưới 2D!");
    };
    r.readAsText(f);
});

document.getElementById('plotContourBtn').addEventListener('change', window.updateContourPlot); // Lắng nghe đổi màu
document.getElementById('contourColorMap').addEventListener('change', window.updateContourPlot);

document.getElementById('plotContourBtn').addEventListener('click', window.updateContourPlot = function () {
    if (!contourRawData) {
        return alert("❌ Vui lòng nạp file dữ liệu 2D (.dat) trước!");
    }

    currentEngine = 'contour';
    Plotly.purge('plot-container');

    let lines = contourRawData.split('\n');
    let xVals = [], yVals = [], zMatrix = [];
    let currentRow = [];
    let lastY = null;

    // 1. Thuật toán gom 1D thành Ma trận 2D (cực nhanh)
    for (let i = 0; i < lines.length; i++) {
        let parts = lines[i].trim().split(/\s+/);
        if (parts.length < 3 || isNaN(parseFloat(parts[0]))) continue;

        let x = parseFloat(parts[0]);
        let y = parseFloat(parts[1]);
        let v = parseFloat(parts[2]);

        // Nếu tọa độ Y thay đổi -> Xuống hàng mới trong ma trận
        if (lastY !== null && Math.abs(y - lastY) > 1e-5) {
            zMatrix.push(currentRow);
            yVals.push(lastY);
            currentRow = [];
        }

        // Lưu trục X ở dòng đầu tiên
        if (zMatrix.length === 0) {
            xVals.push(x);
        }

        currentRow.push(v);
        lastY = y;
    }
    // Đẩy hàng cuối cùng vào ma trận
    if (currentRow.length > 0) {
        zMatrix.push(currentRow);
        yVals.push(lastY);
    }

    // 2. Cấu hình Plotly
    let cmap = document.getElementById('contourColorMap').value;
    let nLevels = parseInt(document.getElementById('contourLevels').value) || 30;

    // Chỉnh bảng màu RdBu đảo ngược cho Charge Difference (Đỏ = Nhận e, Xanh = Mất e)
    let colorscale = cmap;
    if (cmap === 'RdBu') colorscale = 'RdBu'; // Đảo ngược nếu cần: thêm Reversescale

    let trace = {
        x: xVals,
        y: yVals,
        z: zMatrix,
        type: 'contour',
        colorscale: colorscale,
        reversescale: (cmap === 'RdBu'), // RdBu chuẩn: Đỏ dương, Xanh âm
        autocontour: false,
        ncontours: nLevels,
        contours: {
            coloring: 'heatmap',
            showlines: true,
            width: 0.5,
            color: 'rgba(0,0,0,0.2)' // Vẽ nét đứt mỏng giữa các vùng
        },
        colorbar: {
            title: 'Charge (e)',
            titleside: 'right',
            thickness: 20
        }
    };

    let layout = {
        title: { text: '<b>2D Charge Density Contour</b>', font: { size: 22, color: '#b45309' } },
        xaxis: { title: 'X Coordinate (Å)', showgrid: false, zeroline: false, mirror: true, linewidth: 2, linecolor: 'black' },

        // CHIÊU THỨC "SÁT THỦ": scaleanchor ép tỷ lệ khung hình 1:1, chống méo hình!
        yaxis: { title: 'Y Coordinate (Å)', showgrid: false, zeroline: false, mirror: true, linewidth: 2, linecolor: 'black', scaleanchor: 'x', scaleratio: 1 },

        plot_bgcolor: 'white', paper_bgcolor: 'white', margin: { b: 60, t: 60, l: 60, r: 20 }
    };

    Plotly.newPlot('plot-container', [trace], layout, { displaylogo: false, responsive: true });
});