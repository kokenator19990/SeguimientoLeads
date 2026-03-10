// ========================================
// OPENCORE STATS — GOOGLE SHEETS LIVE (V3.0)
// ========================================

// Pub key del documento publicado en Google Sheets
const PUB_KEY = '2PACX-1vR3QU-L6FxcRuM4okfwd3BS-1xBGJVHFbjlekbbdeeAbxuSG5Yrm7GlxT2PotYOW58K6mNiZMh3dm7K';
const SHEETS_TO_LOAD = [
    { name: 'CUENTAS_VIP_TOP', gid: '1329255400', label: 'VIP Top' },
    { name: 'INTELIGENCIA_MERCADO', gid: '1464700851', label: 'Intelig. Mercado' },
    { name: 'BASE_COMPLETA_LIMPIA', gid: '107987896', label: 'Base Completa' }
];

// --- AUDIO SYSTEM ---
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

document.addEventListener('click', (e) => {
    if (e.target.closest('.interactive') || e.target.closest('button') || e.target.closest('a')) {
        playClickSound();
    }
});

// --- DATA PROCESSING STRUCTURE ---
let D = {
    kpis: { total_prospectos: 0, contactadas: 0, no_contactadas: 0, reuniones: 0, tasa_conversion: 0, cobertura: 0 },
    segments: {},
    subestados: { "Reunión agendada": 0, "No Reunión": 0, "No le interesó": 0, "Lo verá": 0, "Me llamará": 0, "Otro": 0 },
    canales: { "LinkedIn": 0, "Correo": 0, "Teléfono": 0, "WhatsApp": 0, "Referido": 0, "Contacto Directo": 0 },
    conversion_canal: {},
    pipeline: { total: 0, contactadas: 0, en_seguimiento: 0, reuniones: 0 },
    indicadores_elite: { contactos: 0, reuniones: 0, cerrados: 0 },
    contactadas_detail: [],
    reuniones_detail: [],
    updated: "Conectando..."
};

// Internal counters equivalent to extract_to_json.py
let subestados_list = Object.keys(D.subestados);
let canales_list = Object.keys(D.canales);
// cross counters
let canal_contactados = {};
let canal_reuniones = {};
canales_list.forEach(c => { canal_contactados[c] = 0; canal_reuniones[c] = 0; });
let pipeline_seguimiento = 0;
let proyectos_cerrados = 0;

let seen_contactadas = new Set();
let seen_reuniones = new Set();

SHEETS_TO_LOAD.forEach(s => {
    D.segments[s.label] = { total: 0, contactadas: 0, no_contactadas: 0 };
});

// --- FETCH FROM GOOGLE PUBLIC CSV ---
async function fetchAndProcessData() {
    try {
        let all_rows = [];

        for (let sheetDef of SHEETS_TO_LOAD) {
            // Requerimiento: El google sheets DEBE estar publicado en la web
            const url = `https://docs.google.com/spreadsheets/d/e/${PUB_KEY}/pub?output=csv&gid=${sheetDef.gid}`;
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`No se pudo cargar la pestaña ${sheetDef.name}. ¿Está publicado el documento en la web?`);
                continue;
            }
            const csvText = await response.text();

            // Parse with PapaParse
            const result = Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                transformHeader: h => h.trim()
            });

            // Iterate rows and aggregate
            result.data.forEach((row, rowIndex) => {
                let empresa = row["Empresa"];
                if (!empresa || empresa.trim() === "") return; // Skip empty rows

                let estado = row["Estado Contacto"];
                let sub = row["Sub-Estado"];
                let medio = row["Medio de Contacto"];
                let nombre = row["Nombre Contacto"] || row["Nombre"] || row["Contacto"];
                let correo = row["Email de Contacto"] || row["Email"] || row["Correo"];
                let linkedin = row["LinkedIn"];
                let fecha = row["Fecha Contacto"];
                let proximo = row["Próximo Seguimiento"];

                // ID Unico basado en fila y pestaña (igual que nuevo formato local)
                let id_key = `${sheetDef.name}_${rowIndex}`;

                D.kpis.total_prospectos++;
                D.segments[sheetDef.label].total++;

                let is_contactada = (estado === "Contactada");

                if (is_contactada && !seen_contactadas.has(id_key)) {
                    seen_contactadas.add(id_key);
                    D.kpis.contactadas++;
                    D.segments[sheetDef.label].contactadas++;

                    D.contactadas_detail.push({
                        empresa, nombre, correo, linkedin, medio, sub_estado: sub, fecha, segmento: sheetDef.label
                    });

                    if (D.subestados[sub] !== undefined) D.subestados[sub]++;
                    if (sub === "Lo verá" || sub === "Me llamará") pipeline_seguimiento++;

                    if (D.canales[medio] !== undefined) {
                        D.canales[medio]++;
                        canal_contactados[medio]++;
                    }

                    if (sub && (sub.toLowerCase().includes("cerrad") || sub.toLowerCase().includes("ganad") || sub.toLowerCase().includes("client"))) {
                        proyectos_cerrados++;
                    }
                }

                if (sub === "Reunión agendada" && !seen_reuniones.has(id_key)) {
                    seen_reuniones.add(id_key);
                    D.kpis.reuniones++;

                    if (D.canales[medio] !== undefined) canal_reuniones[medio]++;

                    D.reuniones_detail.push({
                        empresa, nombre, correo, linkedin, fecha, proximo, segmento: sheetDef.label
                    });
                }
            });

            // Calc no contactadas for segment
            D.segments[sheetDef.label].no_contactadas = D.segments[sheetDef.label].total - D.segments[sheetDef.label].contactadas;
        }

        // Post-processing math
        D.kpis.no_contactadas = D.kpis.total_prospectos - D.kpis.contactadas;
        D.kpis.tasa_conversion = D.kpis.contactadas > 0 ? (D.kpis.reuniones / D.kpis.contactadas * 100).toFixed(1) : 0;
        D.kpis.cobertura = D.kpis.total_prospectos > 0 ? (D.kpis.contactadas / D.kpis.total_prospectos * 100).toFixed(1) : 0;

        canales_list.forEach(c => {
            let ct = canal_contactados[c];
            let re = canal_reuniones[c];
            D.conversion_canal[c] = {
                contactados: ct,
                reuniones: re,
                tasa: ct > 0 ? (re / ct * 100).toFixed(1) : 0
            };
        });

        D.pipeline.total = D.kpis.total_prospectos;
        D.pipeline.contactadas = D.kpis.contactadas;
        D.pipeline.en_seguimiento = pipeline_seguimiento;
        D.pipeline.reuniones = D.kpis.reuniones;

        D.indicadores_elite.contactos = D.kpis.contactadas;
        D.indicadores_elite.reuniones = D.kpis.reuniones;
        D.indicadores_elite.cerrados = proyectos_cerrados;

        let now = new Date();
        D.updated = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} (EN VIVO)`;

        // Limit details
        D.contactadas_detail = D.contactadas_detail.slice(0, 8);
        D.reuniones_detail = D.reuniones_detail.slice(0, 8);

        // Render UI
        renderDashboard();

    } catch (error) {
        console.error("Error fetching live data:", error);
        document.getElementById('update-date').innerHTML = `<span style='color:red;'>Error de conexión: CSV no publicado o URL errónea</span>`;
    }
}

// --- BOOTSTRAP APP ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('update-date').textContent = "Consultando Google Sheets en vivo...";
    fetchAndProcessData();
});


// ========================================
// RENDER UI LAYER (ORIGINAL CHARTJS LOGIC)
// ========================================

function renderDashboard() {
    document.getElementById('update-date').textContent = `ACTUALIZADO: ${D.updated}`;

    // --- ANIMATED COUNTERS ---
    const animateValue = (id, start, end, duration, formatStr = false) => {
        const obj = document.getElementById(id);
        if (!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            let val = Math.floor(progress * (end - start) + start);

            if (formatStr) val = val.toLocaleString();
            obj.innerHTML = val;

            if (progress < 1) window.requestAnimationFrame(step);
            else obj.innerHTML = end.toLocaleString();
        };
        window.requestAnimationFrame(step);
    };

    animateValue('kpi-total-val', 0, D.kpis.total_prospectos, 1500, true);
    animateValue('kpi-contactadas-val', 0, D.kpis.contactadas, 1500, true);
    animateValue('kpi-no-val', 0, D.kpis.no_contactadas, 1500, true);
    animateValue('kpi-reuniones-val', 0, D.kpis.reuniones, 1500, true);

    animateValue('elite-contactos', 0, D.indicadores_elite.contactos, 2000, true);
    animateValue('elite-reuniones', 0, D.indicadores_elite.reuniones, 2000, true);
    animateValue('elite-cerrados', 0, D.indicadores_elite.cerrados, 2000, true);

    // --- RING ANIMATION ---
    const circle = document.getElementById('cobertura-ring');
    const text = document.getElementById('kpi-cobertura-val');
    const targetPct = D.kpis.cobertura;
    const circumference = 283;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = circumference;

    setTimeout(() => {
        const offset = circumference - (targetPct / 100) * circumference;
        circle.style.strokeDashoffset = offset;

        let startTimestamp = null;
        const duration = 2000;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            let val = (progress * targetPct).toFixed(1);
            text.innerHTML = val + '%';
            if (progress < 1) window.requestAnimationFrame(step);
            else text.innerHTML = targetPct + '%';
        };
        window.requestAnimationFrame(step);
    }, 100);

    // --- CONTACT CARDS ---
    window.saveContactMeta = function (contactId, key, value) {
        const data = JSON.parse(localStorage.getItem('oc_interactions') || '{}');
        if (!data[contactId]) data[contactId] = { reaction: '', comment: '' };
        data[contactId][key] = value;
        localStorage.setItem('oc_interactions', JSON.stringify(data));
    };

    window.setReaction = function (btn, contactId, reaction) {
        const parent = btn.parentElement;
        Array.from(parent.children).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        window.saveContactMeta(contactId, 'reaction', reaction);
    };

    const renderContactCard = (c) => {
        const cid = btoa(unescape(encodeURIComponent((c.nombre || '') + (c.empresa || '')))).substring(0, 20);
        const data = JSON.parse(localStorage.getItem('oc_interactions') || '{}');
        const meta = data[cid] || { reaction: '', comment: '' };

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
        </div>
        <div class="cc-reactions">
          <div class="react-buttons">
            <button class="btn-react interactive ${meta.reaction === '👍' ? 'active' : ''}" onclick="setReaction(this, '${cid}', '👍')">👍 APROBADO</button>
            <button class="btn-react interactive ${meta.reaction === '⚠️' ? 'active' : ''}" onclick="setReaction(this, '${cid}', '⚠️')">⚠️ REV</button>
          </div>
        </div>
      </div>`;
    };

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
    tbody.innerHTML = '';
    for (const [seg, vals] of Object.entries(D.segments)) {
        tbody.innerHTML += `<tr><td>${seg}</td><td>${vals.total.toLocaleString()}</td><td>${vals.contactadas}</td><td>${vals.no_contactadas.toLocaleString()}</td></tr>`;
    }

    // --- CHARTS ---
    const ctxEstados = document.getElementById('chart-estados').getContext('2d');
    const ctxCanales = document.getElementById('chart-canales').getContext('2d');
    const ctxPipeline = document.getElementById('chart-pipeline').getContext('2d');
    const ctxConversion = document.getElementById('chart-conversion').getContext('2d');

    // Gradient Generators
    const getGrad = (ctx, c1, c2) => {
        const g = ctx.createLinearGradient(0, 0, 0, 350);
        g.addColorStop(0, c1);
        g.addColorStop(1, c2);
        return g;
    };
    const getGradH = (ctx, c1, c2) => {
        const g = ctx.createLinearGradient(0, 0, 400, 0);
        g.addColorStop(0, c1);
        g.addColorStop(1, c2);
        return g;
    };

    // Global Chart Settings for Premium Look
    Chart.defaults.color = '#A0AEC0';
    Chart.defaults.font.family = "'Space Grotesk', 'Inter', sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.font.weight = 500;

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(10, 10, 15, 0.95)',
                titleColor: '#00E5FF',
                titleFont: { size: 13, family: "'Space Grotesk', sans-serif", weight: 'bold' },
                bodyColor: '#ffffff',
                bodyFont: { size: 12, family: "'Inter', sans-serif" },
                borderColor: 'rgba(0, 229, 255, 0.2)',
                borderWidth: 1,
                padding: 14,
                cornerRadius: 8,
                displayColors: true,
                boxPadding: 6,
                usePointStyle: true
            }
        },
        interaction: { mode: 'index', intersect: false },
        animation: { duration: 2500, easing: 'easeOutQuart' },
        elements: {
            bar: { borderRadius: 4, borderSkipped: false }
        }
    };

    const commonScales = {
        y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.03)', drawBorder: false },
            border: { display: false }
        },
        x: {
            grid: { display: false, drawBorder: false },
            border: { display: false }
        }
    };

    // 1. ESTADO DE GESTIÓN (Vertical Bar)
    if (window.cEstados) window.cEstados.destroy();
    window.cEstados = new Chart(ctxEstados, {
        type: 'bar',
        data: {
            labels: Object.keys(D.subestados),
            datasets: [{
                label: 'Gestiones',
                data: Object.values(D.subestados),
                backgroundColor: [
                    getGrad(ctxEstados, '#00E5FF', 'rgba(0, 229, 255, 0.05)'),
                    getGrad(ctxEstados, '#B200FF', 'rgba(178, 0, 255, 0.05)'),
                    getGrad(ctxEstados, '#FF2A2A', 'rgba(255, 42, 42, 0.05)'),
                    getGrad(ctxEstados, '#E5FF00', 'rgba(229, 255, 0, 0.05)'),
                    getGrad(ctxEstados, '#00FFAA', 'rgba(0, 255, 170, 0.05)'),
                    getGrad(ctxEstados, '#888888', 'rgba(136, 136, 136, 0.05)')
                ],
                borderColor: ['#00E5FF', '#B200FF', '#FF2A2A', '#E5FF00', '#00FFAA', '#888888'],
                borderWidth: 1.5,
                hoverBackgroundColor: ['#00E5FF', '#B200FF', '#FF2A2A', '#E5FF00', '#00FFAA', '#888888'],
                barPercentage: 0.6
            }]
        },
        options: { ...commonOptions, scales: commonScales }
    });

    // 2. CANAL DE CONTACTO (Doughnut)
    if (window.cCanales) window.cCanales.destroy();
    window.cCanales = new Chart(ctxCanales, {
        type: 'doughnut',
        data: {
            labels: Object.keys(D.canales),
            datasets: [{
                data: Object.values(D.canales),
                backgroundColor: ['#00E5FF', '#B200FF', '#E5FF00', '#FF2A2A', '#00FFAA', '#444444'],
                borderWidth: 0,
                hoverOffset: 20,
                spacing: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '82%',
            layout: { padding: 10 },
            plugins: {
                legend: {
                    position: 'right',
                    labels: { usePointStyle: true, pointStyle: 'circle', padding: 20, color: '#A0AEC0', font: { size: 11 } }
                },
                tooltip: commonOptions.plugins.tooltip
            },
            animation: { animateScale: true, animateRotate: true, duration: 3000, easing: 'easeOutExpo' }
        }
    });

    // 3. EMBUDO DE VENTAS (Horizontal Bar)
    if (window.cPipeline) window.cPipeline.destroy();
    window.cPipeline = new Chart(ctxPipeline, {
        type: 'bar',
        data: {
            labels: ['TOTAL', 'CONTACTADAS', 'SEGUIMIENTO', 'REUNIONES'],
            datasets: [{
                label: 'Oportunidades',
                data: [D.pipeline.total, D.pipeline.contactadas, D.pipeline.en_seguimiento, D.pipeline.reuniones],
                backgroundColor: [
                    getGradH(ctxPipeline, '#444444', 'rgba(68, 68, 68, 0.05)'),
                    getGradH(ctxPipeline, '#B200FF', 'rgba(178, 0, 255, 0.05)'),
                    getGradH(ctxPipeline, '#00E5FF', 'rgba(0, 229, 255, 0.05)'),
                    getGradH(ctxPipeline, '#E5FF00', 'rgba(229, 255, 0, 0.05)')
                ],
                borderColor: ['#666666', '#B200FF', '#00E5FF', '#E5FF00'],
                borderWidth: 1.5,
                hoverBackgroundColor: ['#666666', '#B200FF', '#00E5FF', '#E5FF00'],
                barPercentage: 0.5
            }]
        },
        options: {
            ...commonOptions,
            indexAxis: 'y',
            scales: {
                x: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.03)', drawBorder: false }, border: { display: false } },
                y: { grid: { display: false, drawBorder: false }, border: { display: false } }
            }
        }
    });

    // 4. TASA DE ÉXITO POR CANAL (Grouped Bar)
    const convLabels = Object.keys(D.conversion_canal);
    if (window.cConversion) window.cConversion.destroy();
    window.cConversion = new Chart(ctxConversion, {
        type: 'bar',
        data: {
            labels: convLabels,
            datasets: [
                {
                    label: 'CONTACTADOS',
                    data: convLabels.map(c => D.conversion_canal[c].contactados),
                    backgroundColor: getGrad(ctxConversion, '#444444', 'rgba(68, 68, 68, 0.05)'),
                    borderColor: '#666666',
                    borderWidth: 1.5,
                    barPercentage: 0.7
                },
                {
                    label: 'REUNIONES',
                    data: convLabels.map(c => D.conversion_canal[c].reuniones),
                    backgroundColor: getGrad(ctxConversion, '#00E5FF', 'rgba(0, 229, 255, 0.05)'),
                    borderColor: '#00E5FF',
                    borderWidth: 1.5,
                    barPercentage: 0.7
                },
            ]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: { usePointStyle: true, pointStyle: 'circle', color: '#A0AEC0', padding: 20 }
                }
            },
            scales: commonScales
        }
    });

    loadReports();
}

window.toggleDetail = function (type) {
    const el = document.getElementById(`detail-${type}`);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if (el.style.display === 'block') el.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

// --- REPORTS SYSTEM ---
function loadReports() {
    const reports = JSON.parse(localStorage.getItem('oc_reports_neon') || '[]');
    const list = document.getElementById('reports-list');
    list.innerHTML = reports.length ? reports.map((r, i) => `
    <div class="report-item interactive">
      <div class="ri-head"><div><div class="ri-title">${r.title}</div><div class="ri-date">${r.date}</div></div>
      <button class="ri-delete interactive" onclick="deleteReport(${i})">ELIMINAR</button></div>
      <div class="ri-desc">${r.desc.replace(/\n/g, '<br>')}</div>
      ${r.img ? `<img class="ri-img" src="${r.img}" alt="Adjunto">` : ''}
    </div>`).join('') : '<div class="empty-state">No hay reportes.</div>';
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
        const reports = JSON.parse(localStorage.getItem('oc_reports_neon') || '[]');
        reports.unshift({
            title, desc, img: imgData,
            date: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        });
        localStorage.setItem('oc_reports_neon', JSON.stringify(reports));
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
        const reports = JSON.parse(localStorage.getItem('oc_reports_neon') || '[]');
        reports.splice(index, 1);
        localStorage.setItem('oc_reports_neon', JSON.stringify(reports));
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

// --- CHART TOGGLE HANDLER ---
document.querySelectorAll('[data-chart-toggle]').forEach(box => {
    box.addEventListener('click', () => {
        box.classList.toggle('collapsed');
        // After expanding, tell Chart.js to recalculate size
        setTimeout(() => {
            const canvas = box.querySelector('canvas');
            if (canvas) {
                const chartInstance = Chart.getChart(canvas);
                if (chartInstance) chartInstance.resize();
            }
        }, 500);
    });
});
