// ========================================
// OPENCORE STATS — DASHBOARD APP
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    if (typeof DASHBOARD_DATA === 'undefined') {
        console.error('Data not loaded');
        return;
    }
    const D = DASHBOARD_DATA;

    // --- KPIs ---
    document.getElementById('update-date').textContent = `Actualizado: ${D.updated}`;
    document.getElementById('kpi-total-val').textContent = D.kpis.total_prospectos.toLocaleString();
    document.getElementById('kpi-contactadas-val').textContent = D.kpis.contactadas.toLocaleString();
    document.getElementById('kpi-no-val').textContent = D.kpis.no_contactadas.toLocaleString();
    document.getElementById('kpi-reuniones-val').textContent = D.kpis.reuniones.toLocaleString();
    document.getElementById('kpi-tasa-val').textContent = D.kpis.tasa_conversion + '%';

    // --- Seguimientos ---
    document.getElementById('seg-vencidos').textContent = D.seguimientos.vencidos;
    document.getElementById('seg-hoy').textContent = D.seguimientos.hoy;
    document.getElementById('seg-pendientes').textContent = D.seguimientos.pendientes;

    // --- Contactadas Detail ---
    const contactadasCards = document.getElementById('contactadas-cards');
    if (D.contactadas_detail.length === 0) {
        contactadasCards.innerHTML = '<p class="empty-state">No hay contactos registrados aún.</p>';
    } else {
        contactadasCards.innerHTML = D.contactadas_detail.map(c => `
      <div class="contact-card">
        <div class="cc-empresa">${c.empresa || 'Sin empresa'}</div>
        <div class="cc-nombre">${c.nombre || 'Sin nombre'}</div>
        <div class="cc-row">📧 ${c.correo || 'N/A'}</div>
        ${c.linkedin ? `<div class="cc-row">🔗 <a href="${c.linkedin}" target="_blank">LinkedIn</a></div>` : ''}
        <div class="cc-row">📞 ${c.medio || 'N/A'} · ${c.fecha || ''}</div>
        <span class="cc-badge">${c.sub_estado || c.segmento}</span>
      </div>
    `).join('');
    }

    // --- Reuniones Detail ---
    const reunionesCards = document.getElementById('reuniones-cards');
    if (D.reuniones_detail.length === 0) {
        reunionesCards.innerHTML = '<p class="empty-state">No hay reuniones agendadas aún.</p>';
    } else {
        reunionesCards.innerHTML = D.reuniones_detail.map(r => `
      <div class="contact-card">
        <div class="cc-empresa">${r.empresa || 'Sin empresa'}</div>
        <div class="cc-nombre">${r.nombre || 'Sin nombre'}</div>
        <div class="cc-row">📧 ${r.correo || 'N/A'}</div>
        ${r.linkedin ? `<div class="cc-row">🔗 <a href="${r.linkedin}" target="_blank">LinkedIn</a></div>` : ''}
        <div class="cc-row">📅 Contacto: ${r.fecha || 'N/A'}</div>
        ${r.proximo ? `<div class="cc-row">⏰ Próximo: ${r.proximo}</div>` : ''}
        <span class="cc-badge">${r.segmento}</span>
      </div>
    `).join('');
    }

    // --- Segment Table ---
    const tbody = document.getElementById('segment-tbody');
    for (const [seg, vals] of Object.entries(D.segments)) {
        tbody.innerHTML += `<tr><td><strong>${seg}</strong></td><td>${vals.total.toLocaleString()}</td><td>${vals.contactadas}</td><td>${vals.no_contactadas.toLocaleString()}</td></tr>`;
    }

    // --- Chart defaults ---
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(99, 120, 170, 0.15)';
    Chart.defaults.font.family = "'Inter', sans-serif";

    // --- Chart: Estados ---
    new Chart(document.getElementById('chart-estados'), {
        type: 'bar',
        data: {
            labels: Object.keys(D.subestados),
            datasets: [{
                label: 'Prospectos',
                data: Object.values(D.subestados),
                backgroundColor: ['#22c55e', '#ef4444', '#f97316', '#3b82f6', '#8b5cf6', '#64748b'],
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(99,120,170,0.1)' } },
                x: { grid: { display: false } }
            }
        }
    });

    // --- Chart: Canales (Pie) ---
    new Chart(document.getElementById('chart-canales'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(D.canales),
            datasets: [{
                data: Object.values(D.canales),
                backgroundColor: ['#3b82f6', '#f97316', '#22c55e', '#8b5cf6'],
                borderWidth: 0,
                hoverOffset: 8,
            }]
        },
        options: {
            responsive: true,
            cutout: '60%',
            plugins: {
                legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10 } }
            }
        }
    });

    // --- Chart: Pipeline ---
    const pipeLabels = ['Total', 'Contactadas', 'En Seguimiento', 'Reuniones'];
    const pipeValues = [D.pipeline.total, D.pipeline.contactadas, D.pipeline.en_seguimiento, D.pipeline.reuniones];
    new Chart(document.getElementById('chart-pipeline'), {
        type: 'bar',
        data: {
            labels: pipeLabels,
            datasets: [{
                label: 'Pipeline',
                data: pipeValues,
                backgroundColor: ['#1e293b', '#3b82f6', '#f97316', '#22c55e'],
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { beginAtZero: true, grid: { color: 'rgba(99,120,170,0.1)' } },
                y: { grid: { display: false } }
            }
        }
    });

    // --- Chart: Conversión por Canal ---
    const convLabels = Object.keys(D.conversion_canal);
    const convContactados = convLabels.map(c => D.conversion_canal[c].contactados);
    const convReuniones = convLabels.map(c => D.conversion_canal[c].reuniones);
    new Chart(document.getElementById('chart-conversion'), {
        type: 'bar',
        data: {
            labels: convLabels,
            datasets: [
                { label: 'Contactados', data: convContactados, backgroundColor: '#3b82f6', borderRadius: 6, borderSkipped: false },
                { label: 'Reuniones', data: convReuniones, backgroundColor: '#22c55e', borderRadius: 6, borderSkipped: false },
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(99,120,170,0.1)' } },
                x: { grid: { display: false } }
            }
        }
    });

    // --- Reports ---
    loadReports();
});

// --- TOGGLE DETAIL ---
function toggleDetail(type) {
    const el = document.getElementById(`detail-${type}`);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// --- REPORTS SYSTEM ---
function getReports() {
    return JSON.parse(localStorage.getItem('opencore_reports') || '[]');
}

function saveReports(reports) {
    localStorage.setItem('opencore_reports', JSON.stringify(reports));
}

function loadReports() {
    const reports = getReports();
    const list = document.getElementById('reports-list');
    if (reports.length === 0) {
        list.innerHTML = '<p class="empty-state">No hay reportes aún. Crea el primero.</p>';
        return;
    }
    list.innerHTML = reports.map((r, i) => `
    <div class="report-item">
      <div class="ri-head">
        <div>
          <div class="ri-title">${r.title}</div>
          <div class="ri-date">${r.date}</div>
        </div>
        <button class="ri-delete" onclick="deleteReport(${i})">🗑 Eliminar</button>
      </div>
      <div class="ri-desc">${r.desc}</div>
      ${r.img ? `<img class="ri-img" src="${r.img}" alt="Reporte">` : ''}
    </div>
  `).join('');
}

function openReportModal() {
    document.getElementById('modal-overlay').classList.add('active');
}

function closeReportModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.getElementById('report-form').reset();
    document.getElementById('img-preview').innerHTML = '';
}

function saveReport(e) {
    e.preventDefault();
    const title = document.getElementById('report-title').value;
    const desc = document.getElementById('report-desc').value;
    const fileInput = document.getElementById('report-img');

    const finalize = (imgData) => {
        const reports = getReports();
        reports.unshift({
            title,
            desc,
            img: imgData || null,
            date: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        });
        saveReports(reports);
        loadReports();
        closeReportModal();
    };

    if (fileInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = (ev) => finalize(ev.target.result);
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        finalize(null);
    }
}

function deleteReport(index) {
    if (confirm('¿Eliminar este reporte?')) {
        const reports = getReports();
        reports.splice(index, 1);
        saveReports(reports);
        loadReports();
    }
}

// Image preview
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('report-img');
    if (fileInput) {
        fileInput.addEventListener('change', function () {
            const preview = document.getElementById('img-preview');
            if (this.files.length > 0) {
                const reader = new FileReader();
                reader.onload = (e) => { preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`; };
                reader.readAsDataURL(this.files[0]);
            } else {
                preview.innerHTML = '';
            }
        });
    }
});
