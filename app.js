// ========================================
// OPENCORE STATS — GOOGLE SHEETS LIVE (V3.0)
// ========================================

// Pub key del documento publicado en Google Sheets
const PUB_KEY = '2PACX-1vRIOuxSOCMCoJKJcCMPZwDhKp2UlBQcCjL_acVAlimbtttsbrR3XuZb1St1zy0C-A';
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
    canal_reuniones: { "LinkedIn": 0, "Correo": 0, "Teléfono": 0, "WhatsApp": 0, "Referido": 0, "Contacto Directo": 0 },
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
        const url = `https://docs.google.com/spreadsheets/d/e/${PUB_KEY}/pub?output=csv`;
        const response = await fetch(url);
        if (!response.ok) {
            console.warn('No se pudo cargar el documento publicado en la web.');
            throw new Error('No se pudo cargar el CSV');
        }
        const csvText = await response.text();

        const result = Papa.parse(csvText, {
            header: false,
            skipEmptyLines: false
        });

        const rows = result.data;
        
        const safeParseInt = (val) => {
            if(!val) return 0;
            const parsed = parseInt(val.toString().replace(/\\./g, '').trim(), 10);
            return isNaN(parsed) ? 0 : parsed;
        };

        const safeParseFloatStr = (val) => {
             if(!val) return "0.0";
             return val.toString().replace(',', '.').replace('%', '').trim();
        };

        // Section 1: KPIs
        D.kpis.total_prospectos = safeParseInt(rows[4][1]);
        D.kpis.contactadas = safeParseInt(rows[4][2]);
        D.kpis.no_contactadas = safeParseInt(rows[4][3]);
        D.kpis.reuniones = safeParseInt(rows[4][4]);
        
        let rawTasa = safeParseFloatStr(rows[4][5]);
        D.kpis.tasa_conversion = parseFloat(rawTasa);
        D.kpis.cobertura = D.kpis.total_prospectos > 0 ? (D.kpis.contactadas / D.kpis.total_prospectos * 100).toFixed(1) : 0;

        // Section 2: Segments (Rows 7-9)
        D.segments['VIP Top'] = {
            total: safeParseInt(rows[7][2]),
            contactadas: safeParseInt(rows[8][2]),
            no_contactadas: safeParseInt(rows[9][2])
        };
        D.segments['Intelig. Mercado'] = {
            total: safeParseInt(rows[7][3]),
            contactadas: safeParseInt(rows[8][3]),
            no_contactadas: safeParseInt(rows[9][3])
        };
        D.segments['Base Completa'] = {
            total: safeParseInt(rows[7][4]),
            contactadas: safeParseInt(rows[8][4]),
            no_contactadas: safeParseInt(rows[9][4])
        };

        // Section 3: Subestados (Rows 12-17)
        D.subestados['Reunión agendada'] = safeParseInt(rows[12][5]);
        D.subestados['No Reunión'] = safeParseInt(rows[13][5]);
        D.subestados['No le interesó'] = safeParseInt(rows[14][5]);
        D.subestados['Lo verá'] = safeParseInt(rows[15][5]);
        D.subestados['Me llamará'] = safeParseInt(rows[16][5]);
        D.subestados['Otro'] = safeParseInt(rows[17][5]);

        pipeline_seguimiento = D.subestados['Lo verá'] + D.subestados['Me llamará'];

        // Section 4: Canal de Contacto (Rows 21-24)
        D.canales['LinkedIn'] = safeParseInt(rows[21][5]);
        D.canales['Correo'] = safeParseInt(rows[22][5]);
        D.canales['Teléfono'] = safeParseInt(rows[23][5]);
        D.canales['Contacto Directo'] = safeParseInt(rows[24][5]);

        // Section 5: Conversiones por Canal (Rows 28-31)
        D.canal_reuniones['LinkedIn'] = safeParseInt(rows[28][2]);
        D.canal_reuniones['Correo'] = safeParseInt(rows[29][2]);
        D.canal_reuniones['Teléfono'] = safeParseInt(rows[30][2]);
        D.canal_reuniones['Contacto Directo'] = safeParseInt(rows[31][2]);

        canales_list.forEach(c => {
            if(D.canales[c] !== undefined) {
               let ct = D.canales[c];
               let re = D.canal_reuniones[c] || 0;
                D.conversion_canal[c] = {
                    contactados: ct,
                    reuniones: re,
                    tasa: ct > 0 ? (re / ct * 100).toFixed(1) : 0
                };
                
                // Keep parallel arrays updated for legacy chart functions
                canal_contactados[c] = ct;
                canal_reuniones[c] = re;
            }
        });

        // Proyectos Cerrados (not in CSV explicitly)
        proyectos_cerrados = 0; 

        D.pipeline.total = D.kpis.total_prospectos;
        D.pipeline.contactadas = D.kpis.contactadas;
        D.pipeline.en_seguimiento = pipeline_seguimiento;
        D.pipeline.reuniones = D.kpis.reuniones;

        D.indicadores_elite.contactos = D.kpis.contactadas;
        D.indicadores_elite.reuniones = D.kpis.reuniones;
        D.indicadores_elite.cerrados = proyectos_cerrados;

        let now = new Date();
        D.updated = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} (EN VIVO)`;

        // Clear details since we don't have row data anymore
        D.contactadas_detail = [];
        D.reuniones_detail = [];

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
    if (tbody) {
        tbody.innerHTML = '';
        for (const [seg, vals] of Object.entries(D.segments)) {
            tbody.innerHTML += `<tr><td>${seg}</td><td>${vals.total.toLocaleString()}</td><td>${vals.contactadas}</td><td>${vals.no_contactadas.toLocaleString()}</td></tr>`;
        }
    }

    // --- ANALYTICS NAV HUB ---
    // Update button numbers
    document.getElementById('nav-contactadas').innerText = D.kpis.contactadas;
    document.getElementById('nav-reuniones').innerText = D.kpis.reuniones;

    // --- CHART FACTORIES ---
    window.currentExpandedChart = null;

    window.closeChart = function() {
      document.getElementById('chart-reveal-panel').classList.remove('active');
      document.querySelectorAll('.analytics-btn').forEach(b => b.classList.remove('active'));
    };

    window.showChart = function(type) {
      // Manage button active states
      document.querySelectorAll('.analytics-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('btn-' + type).classList.add('active');

      const panel = document.getElementById('chart-reveal-panel');
      const titleEl = document.getElementById('crp-title');
      const chartDom = document.getElementById('active-chart');
      
      // Open panel
      panel.classList.add('active');

      if (window.currentExpandedChart) {
          window.currentExpandedChart.dispose();
      }
      window.currentExpandedChart = echarts.init(chartDom, 'dark');

      let option = {};

      if (type === 'contactos') {
          titleEl.innerText = "CONTACTADOS POR TIER";
          // Explicit order: T1 = best prospects, T2 = mid, T3 = rest
          const tierOrder = [
              { tier: 'T1', seg: 'Intelig. Mercado', color: '#00E5FF' },
              { tier: 'T2', seg: 'VIP Top', color: '#B200FF' },
              { tier: 'T3', seg: 'Base Completa', color: '#E5FF00' }
          ];
          const tierLabels = [];
          const tierTotal = [];
          const tierContacted = [];
          const tierBarColors = [];
          tierOrder.forEach(t => {
              const vals = D.segments[t.seg] || { total: 0, contactadas: 0 };
              tierLabels.push(t.tier + ' — ' + t.seg);
              tierTotal.push(vals.total);
              tierContacted.push(vals.contactadas);
              tierBarColors.push(t.color);
          });
          option = {
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: 'rgba(0,229,255,0.3)', width: 1 } }, backgroundColor: 'rgba(10, 10, 15, 0.95)', borderColor: 'rgba(0, 229, 255, 0.3)', textStyle: { color: '#fff', fontFamily: 'Inter' } },
            legend: { top: '0%', right: '0%', textStyle: { color: '#A0AEC0', fontFamily: 'Inter', fontSize: 11 }, icon: 'circle' },
            grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
            xAxis: { type: 'category', data: tierLabels, axisLine: { lineStyle: { color: 'rgba(0, 229, 255, 0.2)' } }, axisLabel: { color: '#A0AEC0', fontFamily: 'Inter', fontSize: 11 } },
            yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(0, 229, 255, 0.04)', type: 'dashed' } }, axisLabel: { color: '#A0AEC0', fontFamily: 'Inter', fontSize: 11 } },
            series: [
                { name: 'CONTACTADOS', type: 'bar', barWidth: '40%',
                  itemStyle: { borderRadius: [6, 6, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#00E5FF' }, { offset: 1, color: 'rgba(0,229,255,0.1)' }]), shadowColor: 'rgba(0,229,255,0.5)', shadowBlur: 15 },
                  label: { show: true, position: 'top', color: '#00E5FF', fontFamily: 'Space Grotesk', fontWeight: 'bold', fontSize: 13, formatter: '{c}' },
                  data: tierContacted }
            ]
          };
      } 
      else if (type === 'canal') {
          titleEl.innerText = "CANAL DE ORIGEN";
          const canalLabels = Object.keys(D.canales);
          const canalValues = Object.values(D.canales);
          const neonColors = ['#00E5FF', '#B200FF', '#E5FF00', '#FF2A6D', '#00FFAA', '#FF6B00'];
          option = {
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: 'rgba(0,229,255,0.3)', width: 1 } }, backgroundColor: 'rgba(10, 10, 15, 0.95)', borderColor: 'rgba(0, 229, 255, 0.3)', textStyle: { color: '#fff', fontFamily: 'Inter' } },
            grid: { left: '3%', right: '4%', bottom: '8%', top: '5%', containLabel: true },
            xAxis: { type: 'category', data: canalLabels, axisLine: { lineStyle: { color: 'rgba(0, 229, 255, 0.2)' } }, axisLabel: { color: '#00E5FF', fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 'bold' } },
            yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(0, 229, 255, 0.04)', type: 'dashed' } }, axisLabel: { color: '#A0AEC0', fontFamily: 'Inter', fontSize: 11 } },
            series: [{
                name: 'Contactos', type: 'bar', barWidth: '45%',
                itemStyle: { borderRadius: [8, 8, 0, 0], color: function(params) { const c = neonColors[params.dataIndex % neonColors.length]; return new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: c }, { offset: 0.7, color: c + '60' }, { offset: 1, color: c + '08' }]); }, shadowBlur: 20 },
                emphasis: { itemStyle: { shadowBlur: 30, shadowColor: 'rgba(0, 229, 255, 0.8)' } },
                data: canalValues,
                label: { show: true, position: 'top', color: '#00E5FF', fontFamily: 'Space Grotesk', fontWeight: 'bold', fontSize: 13, formatter: '{c}' }
            }]
          };
      }
      else if (type === 'reuniones') {
          titleEl.innerText = "REUNIONES AGENDADAS";
          // Only show data if there are actual reuniones
          const hasReuniones = D.kpis.reuniones > 0;
          if (hasReuniones) {
              // Build pie from REUNION-SPECIFIC channels (not general contacts)
              const pieColors = ['#00E5FF', '#B200FF', '#E5FF00', '#FF2A6D', '#00FFAA', '#FF6B00'];
              const pieData = Object.keys(D.canal_reuniones).filter(k => D.canal_reuniones[k] > 0).map((k, i) => ({
                  name: k, value: D.canal_reuniones[k],
                  itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [{ offset: 0, color: pieColors[i % pieColors.length] }, { offset: 1, color: pieColors[i % pieColors.length] + '40' }]), shadowColor: pieColors[i % pieColors.length], shadowBlur: 15 }
              }));
              option = {
                backgroundColor: 'transparent',
                tooltip: { trigger: 'item', backgroundColor: 'rgba(10, 10, 15, 0.95)', borderColor: 'rgba(0, 229, 255, 0.3)', textStyle: { color: '#fff', fontFamily: 'Inter' }, borderWidth: 1 },
                legend: { bottom: '0%', left: 'center', textStyle: { color: '#A0AEC0', fontFamily: 'Inter', fontSize: 11 }, itemGap: 20, icon: 'circle' },
                series: [{ name: 'Reuniones', type: 'pie', radius: ['55%', '80%'], center: ['50%', '45%'], avoidLabelOverlap: false, itemStyle: { borderRadius: 10, borderColor: '#141414', borderWidth: 3 }, label: { show: false }, data: pieData }]
              };
          } else {
              // Empty state — elegant placeholder
              option = {
                backgroundColor: 'transparent',
                title: { text: 'SIN REUNIONES AGENDADAS', subtext: 'Las reuniones aparecerán aquí cuando se registren en el CRM', left: 'center', top: 'center',
                  textStyle: { color: '#A0AEC0', fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 },
                  subtextStyle: { color: 'rgba(160,174,192,0.5)', fontFamily: 'Inter', fontSize: 13, lineHeight: 24 }
                },
                series: [{ name: 'Vacío', type: 'pie', radius: ['55%', '80%'], center: ['50%', '45%'], silent: true, itemStyle: { borderRadius: 10, borderColor: '#141414', borderWidth: 3 }, label: { show: false },
                  data: [{ value: 1, name: 'Sin datos', itemStyle: { color: 'rgba(255,255,255,0.03)' } }]
                }]
              };
          }
      }

      window.currentExpandedChart.setOption(option);
    };

    fetchOtrosReportes();
}

window.toggleDetail = function (type) {
    const el = document.getElementById(`detail-${type}`);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if (el.style.display === 'block') el.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

// --- FEEDBACK MODAL (FORMSUBMIT.CO — NO REQUIERE CUENTA) ---
// Los comentarios llegan directo a jorge@opencore.cl
// La primera vez, Jorge recibirá un email de confirmación de FormSubmit (solo 1 vez).
const FORMSUBMIT_URL = "https://formsubmit.co/ajax/jorge@opencore.cl";

window.openFeedbackModal = () => {
    document.getElementById('feedback-overlay').classList.add('active');
    document.getElementById('feedback-text').focus();
    const statusDiv = document.getElementById('feedback-status');
    statusDiv.style.display = 'none';
    statusDiv.style.color = '#00FFAA';
    const btn = document.getElementById('feedback-submit-btn');
    btn.style.display = 'block';
    btn.innerText = 'ENVIAR COMENTARIO';
    btn.disabled = false;
};
window.closeFeedbackModal = () => {
    document.getElementById('feedback-overlay').classList.remove('active');
    document.getElementById('feedback-form').reset();
};

const feedbackFormEl = document.getElementById('feedback-form');
if (feedbackFormEl) {
feedbackFormEl.addEventListener('submit', function(e) {
    e.preventDefault();
    const btn = document.getElementById('feedback-submit-btn');
    const statusDiv = document.getElementById('feedback-status');
    const text = document.getElementById('feedback-text').value;

    btn.innerText = "ENVIANDO...";
    btn.disabled = true;

    fetch(FORMSUBMIT_URL, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            _subject: "Comentario Dashboard OpenCORE",
            message: text,
            _captcha: "false",
            _template: "box"
        })
    }).then(response => response.json()).then(data => {
        if (data.success === "true" || data.success === true) {
            btn.style.display = 'none';
            statusDiv.style.display = 'block';
            statusDiv.style.color = '#00FFAA';
            statusDiv.innerText = "¡Comentario enviado con éxito!";
            setTimeout(closeFeedbackModal, 2500);
        } else {
            btn.innerText = "ENVIAR COMENTARIO";
            btn.disabled = false;
            statusDiv.style.display = 'block';
            statusDiv.style.color = '#FF2A6D';
            statusDiv.innerText = data.message || "Error al enviar. Intenta de nuevo.";
        }
    }).catch(error => {
        btn.innerText = "ENVIAR COMENTARIO";
        btn.disabled = false;
        statusDiv.style.display = 'block';
        statusDiv.style.color = '#FF2A6D';
        statusDiv.innerText = "Error de conexión. Intenta de nuevo.";
    });
});
}

// --- OTROS REPORTES (GOOGLE SHEETS) ---
// Pon aquí el link CSV de la pestaña "Otros Reportes" que crees en el Google Sheets.
// Debe tener columnas como: Fecha | Titulo | Descripcion
const REPORTES_CSV_URL = "https://docs.google.com/spreadsheets/d/e/PLACEHOLDER_URL/pub?output=csv";

function fetchOtrosReportes() {
    const box = document.getElementById('reportes-loading');
    if (!box) return;

    if (REPORTES_CSV_URL.includes("PLACEHOLDER")) {
        document.getElementById('otros-reportes-box').innerHTML = `
          <div class="empty-state" style="color:#A0AEC0; font-family:'Inter'; text-align:center; padding: 2rem;">
            <h3 style="margin-bottom: 10px; color:#00E5FF; font-family:'Space Grotesk'; font-size:1.2rem;">¡Pestaña de Reportes Configurable!</h3>
            <p>1. Crea una pestaña llamada "Otros Reportes" en el Excel de Seguimientos.</p>
            <p>2. Dale columnas: <strong>Fecha</strong>, <strong>Titulo</strong>, <strong>Descripcion</strong>.</p>
            <p>3. Publícala en la web como CSV y reemplaza la constante <code style="color:#CCFF00">REPORTES_CSV_URL</code> en app.js.</p>
          </div>`;
        return;
    }

    Papa.parse(REPORTES_CSV_URL, {
        download: true,
        header: true,
        complete: function(results) {
            const data = results.data.filter(r => r.Titulo || r.Descripcion);
            const container = document.getElementById('otros-reportes-box');
            if (data.length === 0) {
                container.innerHTML = '<div class="empty-state">No hay reportes recientes registrados en el Excel.</div>';
                return;
            }
            
            let html = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">';
            data.forEach(r => {
                const date = r.Fecha || new Date().toLocaleDateString('es-CL');
                const title = r.Titulo || 'Reporte';
                const desc = (r.Descripcion || '').replace(/\n/g, '<br>');
                html += `
                <div class="kpi-card interactive" style="padding: 1.5rem; border-top: 2px solid #00E5FF; background: rgba(0, 229, 255, 0.02);">
                  <div style="color:#00E5FF; font-family:'Space Grotesk'; font-size:1.1rem; font-weight:bold; margin-bottom: 5px;">${title}</div>
                  <div style="font-size:0.75rem; color:#A0AEC0; margin-bottom: 12px; letter-spacing: 1px;">${date}</div>
                  <div style="font-family:'Inter'; font-size:0.9rem; line-height:1.5; color:#E2E8F0;">${desc}</div>
                </div>`;
            });
            html += '</div>';
            container.innerHTML = html;
        },
        error: function(err) {
            document.getElementById('otros-reportes-box').innerHTML = `<div class="empty-state" style="color:#FF2A6D;">Error al cargar reportes: ${err.message}</div>`;
        }
    });
}

window.addEventListener('resize', () => {
    if (window.currentExpandedChart) window.currentExpandedChart.resize();
});
