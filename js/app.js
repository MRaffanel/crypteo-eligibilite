let map, marker;
let selectedAddress = null;

const EMAILJS_SERVICE_ID  = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';

document.addEventListener('DOMContentLoaded', function() {
  if (typeof emailjs !== 'undefined') emailjs.init(EMAILJS_PUBLIC_KEY);

  map = L.map('map', { center: [46.6, 2.35], zoom: 6, zoomControl: false });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    maxZoom: 20
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  const input = document.getElementById('address-input');
  let debounce;
  input.addEventListener('input', function() {
    clearTimeout(debounce);
    const q = this.value.trim();
    if (q.length < 3) { document.getElementById('suggestions').innerHTML = ''; return; }
    debounce = setTimeout(() => fetchSuggestions(q), 280);
  });

  document.addEventListener('click', function(e) {
    if (!document.getElementById('search-box').contains(e.target))
      document.getElementById('suggestions').innerHTML = '';
  });
});

async function fetchSuggestions(query) {
  try {
    const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=6&autocomplete=1`);
    const data = await res.json();
    renderSuggestions(data.features || []);
  } catch(e) { console.error('Erreur adresse:', e); }
}

function renderSuggestions(features) {
  const container = document.getElementById('suggestions');
  container.innerHTML = '';
  if (!features.length) return;
  features.forEach(f => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.textContent = f.properties.label;
    div.addEventListener('click', () => pickAddress(f));
    container.appendChild(div);
  });
}

function pickAddress(feature) {
  const p = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  selectedAddress = {
    label: p.label,
    numero: p.housenumber || '',
    nom_voie: p.street || p.name || '',
    code_postal: p.postcode || '',
    nom_commune: p.city || '',
    latitude: lat,
    longitude: lng
  };
  document.getElementById('address-input').value = p.label;
  document.getElementById('suggestions').innerHTML = '';
  map.flyTo([lat, lng], 18, { duration: 1.5 });
  if (marker) map.removeLayer(marker);
  const icon = L.divIcon({
    html: `<div style="width:16px;height:16px;background:#e91e8c;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 3px rgba(233,30,140,0.35),0 2px 10px rgba(0,0,0,0.5)"></div>`,
    className: '', iconSize: [22,22], iconAnchor: [11,11]
  });
  marker = L.marker([lat, lng], { icon }).addTo(map).bindPopup(`<b style="font-size:12px">${p.label}</b>`).openPopup();
  const btn = document.getElementById('test-btn');
  btn.style.display = 'flex';
}

async function testEligibility() {
  if (!selectedAddress) return;
  const panel = document.getElementById('results-panel');
  panel.classList.add('open');
  document.getElementById('map').classList.add('panel-open');
  setTimeout(() => map.invalidateSize(), 350);
  document.getElementById('results-content').innerHTML = `
    <div class="loading"><div class="spinner"></div>Analyse en cours...</div>`;
  try {
    const res = await fetch('/api/eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: selectedAddress.latitude,
        longitude: selectedAddress.longitude,
        numero: selectedAddress.numero,
        nom_voie: selectedAddress.nom_voie,
        code_postal: selectedAddress.code_postal,
        nom_commune: selectedAddress.nom_commune
      })
    });
    const data = await res.json();
    lastResults = data;
    displayResults(data);
  } catch(e) {
    document.getElementById('results-content').innerHTML =
      `<div style="padding:30px;text-align:center;font-size:13px;color:#f87171">Impossible de contacter l'API.</div>`;
  }
}

function displayResults(data) {
  const admin = isAdmin();
  const container = document.getElementById('results-content');
  const techs = data.technologies || data.offers || data.results || data.liaisons || [];
  const eligible = Array.isArray(techs) ? techs.some(t => t.eligible !== false && t.available !== false) : false;
  let html = '';
  if (admin) html += `<div class="admin-tag"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Vue administrateur</div>`;
  if (selectedAddress) html += `<div class="address-card"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${selectedAddress.label}</div>`;
  html += `<div class="status-badge ${eligible ? 'status-eligible' : 'status-not-eligible'}">${eligible ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Éligible' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Non éligible'}</div>`;
  if (Array.isArray(techs) && techs.length > 0) {
    const groups = {
      'Fibre dédiée':     techs.filter(t => ['ftto','sdsl_fo','fiber_dedicated'].includes(t.type||t.infrastructure_type)),
      'Fibre mutualisée': techs.filter(t => ['ftth','fttb','fiber_shared'].includes(t.type||t.infrastructure_type)),
      'Cuivre':           techs.filter(t => ['adsl','vdsl','vdsl2','sdsl'].includes(t.type||t.infrastructure_type)),
    };
    const other = techs.filter(t => !['ftto','sdsl_fo','fiber_dedicated','ftth','fttb','fiber_shared','adsl','vdsl','vdsl2','sdsl'].includes(t.type||t.infrastructure_type));
    if (other.length) groups['Autres'] = other;
    for (const [label, list] of Object.entries(groups)) {
      if (!list.length) continue;
      html += `<div class="section-label">${label}</div>`;
      list.forEach(t => { html += renderCard(t, admin); });
    }
  } else {
    html += `<p style="font-size:13px;color:rgba(255,255,255,0.4);text-align:center;padding:30px 0">Aucune offre disponible.</p>`;
  }
  container.innerHTML = html;
}

function renderCard(tech, admin) {
  const available = tech.eligible !== false && tech.available !== false;
  const name = tech.name || tech.infrastructure_type || tech.type || 'Offre';
  const down = tech.debit_down || tech.download_speed || tech.max_download || null;
  const up   = tech.debit_up   || tech.upload_speed   || tech.max_upload   || null;
  let adminHtml = '';
  if (admin) {
    const price    = tech.price || tech.prix || tech.monthly_price || null;
    const operator = tech.operator || tech.operateur || tech.infrastructure_operator || null;
    if (price || operator) adminHtml = `<div class="admin-block">${price ? `<div class="admin-row"><span>Prix d'achat HT</span><span>${price} €/mois</span></div>` : ''}${operator ? `<div class="admin-row"><span>Opérateur infra</span><span>${operator}</span></div>` : ''}</div>`;
  }
  return `<div class="tech-card"><div class="tech-card-top"><span class="tech-name">${name}</span><span class="avail-pill ${available ? 'avail-yes' : 'avail-no'}">${available ? 'Disponible' : 'Indisponible'}</span></div><div class="tech-speeds"><span>↓ <span class="speed-val">${fmtSpeed(down)}</span></span><span>↑ <span class="speed-val">${fmtSpeed(up)}</span></span></div>${adminHtml}</div>`;
}

function fmtSpeed(val) {
  if (!val) return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  return n >= 1000 ? `${(n/1000).toFixed(1)} Gbps` : `${Math.round(n)} Mbps`;
}

function closePanel() {
  document.getElementById('results-panel').classList.remove('open');
  document.getElementById('map').classList.remove('panel-open');
  setTimeout(() => map.invalidateSize(), 350);
}

function openContact() {
  if (selectedAddress) document.getElementById('contact-address').value = selectedAddress.label;
  document.getElementById('contact-success').style.display = 'none';
  document.getElementById('contact-error').style.display = 'none';
  document.getElementById('contact-modal').classList.add('open');
}

function closeContact() {
  document.getElementById('contact-modal').classList.remove('open');
}

async function sendContact() {
  const firstname = document.getElementById('contact-firstname').value.trim();
  const lastname  = document.getElementById('contact-lastname').value.trim();
  const company   = document.getElementById('contact-company').value.trim();
  const address   = document.getElementById('contact-address').value.trim();
  const phone     = document.getElementById('contact-phone').value.trim();
  const email     = document.getElementById('contact-email').value.trim();
  const message   = document.getElementById('contact-message').value.trim();
  const errEl     = document.getElementById('contact-error');
  const okEl      = document.getElementById('contact-success');
  const btn       = document.getElementById('contact-submit');
  errEl.style.display = 'none';
  okEl.style.display  = 'none';
  if (!firstname || !lastname || !email) {
    errEl.textContent = 'Prénom, nom et email sont obligatoires.';
    errEl.style.display = 'block';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Envoi en cours...';
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: 'commercial@crypteo.fr',
      from_name: `${firstname} ${lastname}`,
      company: company || 'Non renseigné',
      address: address || 'Non renseignée',
      phone: phone || 'Non renseigné',
      from_email: email,
      message: message || "Demande d'éligibilité."
    });
    okEl.style.display = 'block';
    setTimeout(closeContact, 3500);
  } catch(e) {
    errEl.textContent = "Erreur lors de l'envoi. Merci de réessayer.";
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Envoyer la demande';
  }
}
