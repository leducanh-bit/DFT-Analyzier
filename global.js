// ==========================================================
// 🌟 GLOBALS.JS - BIẾN TOÀN CỤC & GIAO DIỆN HIỆN ĐẠI
// ==========================================================
let currentEngine = 'qe';

window.hexToRgba = function (hex, alpha) {
    if (!hex || typeof hex !== 'string') return `rgba(0,0,0,${alpha})`;
    if (hex.startsWith('#')) hex = hex.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    let r = parseInt(hex.slice(0, 2), 16) || 0, g = parseInt(hex.slice(2, 4), 16) || 0, b = parseInt(hex.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// ==========================================================
// HỆ THỐNG THÔNG BÁO BỌC THÉP (Không thể bị đè cache)
// ==========================================================
window.alert = function (message) {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.warn("Chưa tìm thấy thẻ #toast-container trong HTML", message);
        return;
    }

    const isError = message.includes('❌');
    const toast = document.createElement('div');
    toast.className = `modern-toast ${isError ? 'error' : ''}`;

    let icon = isError ? '❌' : '✅';
    let cleanMsg = message.replace('❌', '').replace('✅', '').trim();

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span style="z-index: 1;">${cleanMsg}</span>
        <div class="toast-progress"></div>
    `;

    container.appendChild(toast);

    // Kích hoạt trượt vào & chạy thanh tiến trình
    setTimeout(() => {
        toast.classList.add('show');
        toast.querySelector('.toast-progress').style.width = '0%';
    }, 10);

    // Thu dọn sau 3 giây
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
};