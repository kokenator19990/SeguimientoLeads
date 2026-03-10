// ========================================
// OPENCORE STATS — PREMIUM B&W + NEON LOGIC
// ========================================

// --- AUDIO SYSTEM (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playClickSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

// Bind audio to all interactive elements
document.addEventListener('click', (e) => {
    if (e.target.closest('.interactive') || e.target.closest('button') || e.target.closest('a')) {
        playClickSound();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (typeof DASHBOARD_DATA === 'undefined') {
        console.error('Data not loaded');
        return;
    }
    const D = DASHBOARD_DATA;

    document.getElementById('update-date').textContent = `ACTUALIZADO: ${D.updated}`;

    // --- ANIMATED COUNTERS ---
    const animateValue = (id, start, end, duration, formatStr = false) => {
        const obj = document.getElementById(id);
        if (!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 4); // easeOutQuart
            let val = Math.floor(progress * (end - start) + start);

            if (formatStr) {
                val = val.toLocaleString();
            }
            obj.innerHTML = val;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.innerHTML = end.toLocaleString();
            }
        };
        window.requestAnimationFrame(step);
    };

    animateValue('kpi-total-val', 0, D.kpis.total_prospectos, 1500, true);
    animateValue('kpi-contactadas-val', 0, D.kpis.contactadas, 1500, true);
    animateValue('kpi-no-val', 0, D.kpis.no_contactadas, 1500, true);
    animateValue('kpi-reuniones-val', 0, D.kpis.reuniones, 1500, true);

    if (D.indicadores_elite) {
        animateValue('elite-contactos', 0, D.indicadores_elite.contactos, 2000, true);
        animateValue('elite-reuniones', 0, D.indicadores_elite.reuniones, 2000, true);
        animateValue('elite-cerrados', 0, D.indicadores_elite.cerrados, 2000, true);
    }

    // --- RING ANIMATION (COBERTURA TOTAL) ---
    const circle = document.getElementById('cobertura-ring');
    const text = document.getElementById('kpi-cobertura-val');
    const targetPct = D.kpis.cobertura;

    // Circumference of r=45 is approx 283
    const circumference = 283;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = circumference;

    setTimeout(() => {
        const offset = circumference - (targetPct / 100) * circumference;
        circle.style.strokeDashoffset = offset;

        // Animate the text %
        let startTimestamp = null;
        const duration = 2000;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 4);
            let val = (progress * targetPct).toFixed(1);
            text.innerHTML = val + '%';
            if (progress < 1) window.requestAnimationFrame(step);
            else text.innerHTML = targetPct + '%';
        };
        window.requestAnimationFrame(step);

    }, 100);

    // --- BOSS COMMENTS & REACTIONS SYSTEM ---
    function getContactMeta(contactId) {
        const data = JSON.parse(localStorage.getItem('oc_interactions') || '{}');
        return data[contactId] || { reaction: '', comment: '' };
    }

    window.saveContactMeta = function (contactId, key, value) {
        const data = JSON.parse(localStorage.getItem('oc_interactions') || '{}');
        if (!data[contactId]) data[contactId] = { reaction: '', comment: '' };
        data[contactId][key] = value;
        localStorage.setItem('oc_interactions', JSON.stringify(data));
    }

    window.setReaction = function (btn, contactId, reaction) {
        const parent = btn.parentElement;
        Array.from(parent.children).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        saveContactMeta(contactId, 'reaction', reaction);
    }

    const renderContactCard = (c) => {
        const cid = btoa(unescape(encodeURIComponent((c.nombre || '') + (c.empresa || '')))).substring(0, 20);
        const meta = getContactMeta(cid);

        return `
      <div class="contact-card interactive">
        <div class="cc-head">
          <div class="cc-empresa">${c.empresa || 'Sin empresa'}</div>
          <div class="cc-badge">${c.sub_estado || c.segmento}</div>
        </div>
        <div class="cc-nombre">${c.nombre || 'Sin nombre'}</div>
        <div class="cc-meta">
          <div>CORREO: <span>${c.correo || 'N/A'}</span></div>
          ${c.linkedin ? `<div>LINKEDIN: <span><a href="${c.linkedin}" target="_blank" class="accent-cyan">Ver Perfil ↗</a></span></div>` : ''}
          <div>CONTACTO: <span>${c.medio || 'N/A'} - ${c.fecha || 'N/A'}</span></div>
          ${c.proximo ? `<div>PRÓXIMO: <span class="accent-yellow">${c.proximo}</span></div>` : ''}
        </div>
        
        <div class="cc-reactions">
          <div class="react-buttons">
            <button class="btn-react interactive ${meta.reaction === '👍' ? 'active' : ''}" onclick="setReaction(this, '${cid}', '👍')">👍 APROBADO</button>
            <button class="btn-react interactive ${meta.reaction === '⚠️' ? 'active' : ''}" onclick="setReaction(this, '${cid}', '⚠️')">⚠️ REVISAR</button>
            <button class="btn-react interactive ${meta.reaction === '👀' ? 'active' : ''}" onclick="setReaction(this, '${cid}', '👀')">👀 VISTAZO</button>
          </div>
          <textarea class="boss-comment" placeholder="Agregar comentario..." 
                    onchange="saveContactMeta('${cid}', 'comment', this.value)">${meta.comment}</textarea>
          <button class="save-comment-btn interactive">GUARDADO</button>
        </div>
      </div>
    `;
    };

    // --- DETAILS ---
    const contactadasList = document.getElementById('contactadas-list');
    contactadasList.innerHTML = D.contactadas_detail.length ?
        D.contactadas_detail.map(renderContactCard).join('') :
        '<div class="empty-state">No hay contactos recientes.</div>';

    const reunionesList = document.getElementById('reuniones-list');
    reunionesList.innerHTML = D.reuniones_detail.length ?
        D.reuniones_detail.map(renderContactCard).join('') :
        '<div class="empty-state">No hay reuniones agendadas.</div>';

    // --- TABLE ---
    const tbody = document.getElementById('segment-tbody');
    for (const [seg, vals] of Object.entries(D.segments)) {
        tbody.innerHTML += `<tr><td>${seg}</td><td>${vals.total.toLocaleString()}</td><td>${vals.contactadas}</td><td>${vals.no_contactadas.toLocaleString()}</td></tr>`;
    }

    // --- CHARTS (Neon Accents) ---
    Chart.defaults.color = '#888888';
    Chart.defaults.borderColor = '#222222';
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.font.weight = 600;

    const chartOpts = {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
            y: { beginAtZero: true, grid: { color: '#222' } },
            x: { grid: { display: false } }
        },
        animation: { duration: 2000, easing: 'easeOutQuart' }
    };

    new Chart(document.getElementById('chart-estados'), {
        type: 'bar',
        data: {
            labels: Object.keys(D.subestados),
            datasets: [{
                data: Object.values(D.subestados),
                backgroundColor: ['#00E5FF', '#CCCCCC', '#999999', '#666666', '#444444', '#222222'],
                borderWidth: 0
            }]
        },
        options: chartOpts
    });

    new Chart(document.getElementById('chart-canales'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(D.canales),
            datasets: [{
                data: Object.values(D.canales),
                backgroundColor: ['#00E5FF', '#B200FF', '#444444', '#111111'],
                borderWidth: 2, borderColor: '#0a0a0a'
            }]
        },
        options: {
            responsive: true,
            cutout: '75%',
            plugins: { legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true, boxWidth: 8 } } },
            animation: { duration: 2000, easing: 'easeOutQuart' }
        }
    });

    new Chart(document.getElementById('chart-pipeline'), {
        type: 'bar',
        data: {
            labels: ['TOTAL', 'CONTACTADAS', 'SEGUIMIENTO', 'REUNIONES'],
            datasets: [{
                data: [D.pipeline.total, D.pipeline.contactadas, D.pipeline.en_seguimiento, D.pipeline.reuniones],
                backgroundColor: ['#222222', '#555555', '#AAAAAA', '#E5FF00'],
                borderWidth: 0
            }]
        },
        options: { ...chartOpts, indexAxis: 'y', scales: { x: { beginAtZero: true, grid: { color: '#222' } }, y: { grid: { display: false } } } }
    });

    const convLabels = Object.keys(D.conversion_canal);
    new Chart(document.getElementById('chart-conversion'), {
        type: 'bar',
        data: {
            labels: convLabels,
            datasets: [
                { label: 'CONTACTADOS', data: convLabels.map(c => D.conversion_canal[c].contactados), backgroundColor: '#444' },
                { label: 'REUNIONES', data: convLabels.map(c => D.conversion_canal[c].reuniones), backgroundColor: '#00E5FF' },
            ]
        },
        options: {
            ...chartOpts,
            plugins: { legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } }
        }
    });

    // --- REPORTS ---
    loadReports();
});

// --- UI TOGGLERS ---
window.toggleDetail = function (type) {
    const el = document.getElementById(`detail-${type}`);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if (el.style.display === 'block') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// --- REPORTS SYSTEM ---
function getReports() { return JSON.parse(localStorage.getItem('oc_reports_neon') || '[]'); }
function saveReports(reports) { localStorage.setItem('oc_reports_neon', JSON.stringify(reports)); }

function loadReports() {
    const reports = getReports();
    const list = document.getElementById('reports-list');
    if (reports.length === 0) {
        list.innerHTML = '<div class="empty-state">No hay reportes.</div>';
        return;
    }
    list.innerHTML = reports.map((r, i) => `
    <div class="report-item interactive">
      <div class="ri-head">
        <div>
          <div class="ri-title">${r.title}</div>
          <div class="ri-date">${r.date}</div>
        </div>
        <button class="ri-delete interactive" onclick="deleteReport(${i})">ELIMINAR</button>
      </div>
      <div class="ri-desc">${r.desc.replace(/\n/g, '<br>')}</div>
      ${r.img ? `<img class="ri-img" src="${r.img}" alt="Adjunto">` : ''}
    </div>
  `).join('');
}

window.openReportModal = () => document.getElementById('modal-overlay').classList.add('active');
window.closeReportModal = () => {
    document.getElementById('modal-overlay').classList.remove('active');
    document.getElementById('report-form').reset();
    document.getElementById('img-preview').innerHTML = '';
};

window.saveReport = (e) => {
    e.preventDefault();
    const title = document.getElementById('report-title').value;
    const desc = document.getElementById('report-desc').value;
    const fileInput = document.getElementById('report-img');

    const finalize = (imgData) => {
        const reports = getReports();
        reports.unshift({
            title, desc, img: imgData,
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
    } else finalize(null);
};

window.deleteReport = (index) => {
    if (confirm('¿Eliminar reporte?')) {
        const reports = getReports();
        reports.splice(index, 1);
        saveReports(reports);
        loadReports();
    }
};

document.getElementById('report-img').addEventListener('change', function () {
    const preview = document.getElementById('img-preview');
    if (this.files.length > 0) {
        const reader = new FileReader();
        reader.onload = (e) => { preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`; };
        reader.readAsDataURL(this.files[0]);
    } else preview.innerHTML = '';
});
