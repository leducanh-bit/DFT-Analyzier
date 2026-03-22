// ==========================================================
// 🧭 UI_NAV.JS - HỆ THỐNG ĐIỀU HƯỚNG VÀ CHUYỂN TAB
// ==========================================================

document.getElementById('engineSelect').addEventListener('change', function (e) {
    currentEngine = e.target.value;

    ['qe', 'w90', 'pdos', 'optical', 'optical_w90'].forEach(id => {
        let el = document.getElementById('workspace-' + id);
        if (el) el.style.display = 'none';
    });

    Plotly.purge('plot-container');

    let activeEl = document.getElementById('workspace-' + currentEngine);
    if (activeEl) activeEl.style.display = 'block';

    setTimeout(() => {
        if (currentEngine === 'qe' && window.renderQePlot) window.renderQePlot();
        else if (currentEngine === 'w90' && window.renderW90Plot) window.renderW90Plot();
        else if (currentEngine === 'pdos' && window.updatePdosGraph) window.updatePdosGraph();
        else if (currentEngine === 'optical') {
            Plotly.newPlot('plot-container', [], { font: { family: 'Arial', size: 14 }, plot_bgcolor: 'white', paper_bgcolor: 'white', xaxis: { title: 'Energy (eV)', range: [0, 15], mirror: true, showline: true, linewidth: 1.5, linecolor: 'black' }, yaxis: { title: 'Dielectric Constant', mirror: true, showline: true, linewidth: 1.5, linecolor: 'black' }, margin: { l: 80, r: 20, t: 40, b: 60 } }, { displaylogo: false });
        }
        else if (currentEngine === 'optical_w90') {
            Plotly.newPlot('plot-container', [], { font: { family: 'Arial', size: 14 }, plot_bgcolor: 'white', paper_bgcolor: 'white', xaxis: { title: 'Energy (eV)', range: [0, 15], mirror: true, showline: true, linewidth: 1.5, linecolor: 'black' }, yaxis: { title: 'Dielectric Constant (W90)', mirror: true, showline: true, linewidth: 1.5, linecolor: 'black' }, margin: { l: 80, r: 20, t: 40, b: 60 } }, { displaylogo: false });
        }
    }, 50);
});

document.addEventListener("DOMContentLoaded", function () {
    let selectEl = document.getElementById('engineSelect');
    selectEl.value = 'qe';
    selectEl.dispatchEvent(new Event('change'));
});