let map, marker, buildingLayer, addressLayer;
let selectedAddress = null;

const EMAILJS_SERVICE_ID  = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';

document.addEventListener('DOMContentLoaded', function() {
  if (typeof emailjs !== 'undefined') emailjs.init(EMAILJS_PUBLIC_KEY);

  map = L.map('map', { center: [46.6, 2.35], zoom: 6, zoomControl: false });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    maxZoom: 20
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  buildingLayer = L.layerGroup().addTo(map);
  addressLayer  = L.layerGroup().addTo(map);

  map.on('zoomend moveend', onMapChange);
  map.on('zoom', function() {
    document.getElementById('zoom-level').textContent = 'Zoom: ' + map.getZoom();
  });

  const input = document.getElementById('address-input');
  let debounce;
  input.addEventListener('input', function() {
    clearTimeout(debounce);
    const q = this.value.trim();
    document.getElementById('clear-btn').classList.toggle('visible', q.length > 0);
    if (q.length < 3) { document.getElementById('suggestions').innerHTML = ''; return; }
    debounce = setTimeout(() => fetchSuggestions(q), 260);
  });

  document.addEventListener('click', function(e) {
    if (!document.getElementById('search-box').contains(e.target))
      document.getElementById('suggestions').innerHTML = '';
  });
});

function onMapChange() {
  const zoom = map.getZoom();
  const hint = document.getElementById('zoom-hint');

  if (zoom >= 17) {
    hint.classList.remove('visible');
    fetchBuildings();
  } else if (zoom >= 14) {
    hint.classList.add('visible');
    buildingLayer.clearLayers();
    fetchAddressDots();
  } else {
    hint.classList.remove('visible');
    buildingLayer.clearLayers();
    addressLayer.clearLayers();
  }
}

// ─── Bâtiments via Overpass
let buildingDebounce;
function fetchBuildings() {
  clearTimeout(buildingDebounce);
  buildingDebounce = setTimeout(async function() {
    const b = map.getBounds();
    const query = `[out:json][timeout:10];(way["building"](${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}););out body;>;out skel qt;`;

    try {
      const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      const data = await res.json();
      renderBuildings(data);
    } catch(e) {
      fetchAddressDots();
    }
  }, 400);
}

function renderBuildings(data) {
  buildingLayer.clearLayers();
  addressLayer.clearLayers();

  const nodes = {};
  data.elements.filter(e => e.type === 'node').forEach(n => { nodes[n.id] = [n.lat, n.lon]; });

  data.elements.filter(e => e.type === 'way' && e.nodes).forEach(way => {
    const coords = way.nodes.map(id => nodes[id]).filter(Boolean);
    if (coords.length < 3) return;

    const poly = L.polygon(coords, {
      color: '#F7941D',
      weight: 1.5,
      opacity: 0.8,
      fillColor: '#F7941D',
      fillOpacity: 0.12
    });

    poly.on('mouseover', function() {
      this.setStyle({ fillOpacity: 0.3, weight: 2 });
    });
    poly.on('mouseout', function() {
      this.setStyle({ fillOpacity: 0.12, weight: 1.5 });
    });
    poly.on('click', function() {
      const center = poly.getBounds().getCenter();
      reverseGeocode(center.lat, center.lng);
    });

    buildingLayer.addLayer(poly);
  });
}

// ─── Points adresses (zoom intermédiaire)
let addrDebounce;
function fetchAddressDots() {
  clearTimeout(addrDebounce);
  addrDebounce = setTimeout(async function() {
    const center = map.getCenter();
    addressLayer.clearLayers();
    try {
      const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=a&lat=${center.lat}&lon=${center.lng}&limit=40`);
      const data = await res.json();
      (data.features || []).forEach(f => {
        const [lng, lat] = f.geometry.coordinates;
        const dot = L.circleMarker([lat, lng], {
          radius: 5, fillColor: '#F7941D', fillOpacity: 0.8,
          color: '#fff', weight: 1.5
        });
        dot.bindTooltip(f.properties.label, { direction: 'top', offset: [0,-6], className: 'building-popup' });
        dot.on('click', () => pickAddress(f));
        addressLayer.addLayer(dot);
      });
    } catch(e) {}
  }, 400);
}

// ─── Reverse geocode au clic bâtiment
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://api-adresse.data.gouv.fr/reverse/?lat=${lat}&lon=${lng}`);
    const data = await res.json();
    if (data.features && data.features.length > 0) {
      pickAddress(data.features[0]);
    }
  } catch(e) {}
}

// ─── Autocomplétion
async function fetchSuggestions(query) {
  try {
    const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=6&autocomplete=1`);
    const data = await res.json();
    renderSuggestions(data.features || []);
  } catch(e) {}
}

function renderSuggestions(features) {
  const container = document.getElementById('suggestions');
  container.innerHTML = '';
  if (!features.length) return;
  features.forEach(f => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/></svg>${f.properties.label}`;
    div.addEventListener('click', () => pickAddress(f));
    container.appendChild(div);
  });
}

function pickAddress(feature) {
  const p = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  selectedAddress = { label: p.label, numero: p.housenumber||'', nom_voie: p.street||p.name||'', code_postal: p.postcode||'', nom_commune: p.city||'', latitude: lat, longitude: lng };

  document.getElementById('address-input').value = p.label;
  document.getElementById('clear-btn').classList.add('visible');
  document.getElementById('suggestions').innerHTML = '';

  map.flyTo([lat, lng], 18, { duration: 1.2 });

  if (marker) map.removeLayer(marker);
  const icon = L.divIcon({
    html: `<div style="width:18px;height:18px;background:#F7941D;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(247,148,29,0.3),0 2px 12px rgba(0,0,0,0.4)"></div>`,
    className: '', iconSize: [24,24], iconAnchor: [12,12]
  });
  marker = L.marker([lat, lng], { icon }).addTo(map).bindPopup(`<b>${p.label}</b>`).openPopup();

  const btn = document.getElementById('test-btn');
  btn.style.display = 'flex';
}

function clearSearch() {
  document.getElementById('address-input').value = '';
  document.getElementById('clear-btn').classList.remove('visible');
  document.getElementById('suggestions').innerHTML = '';
  document.getElementById('test-btn').style.display = 'none';
  selectedAddress = null;
  if (marker) { map.removeLayer(marker); marker = null; }
}

// ─── Test éligibilité
async function testEligibility() {
  if (!selectedAddress) return;
  const panel = document.getElementById('results-panel');
  panel.classList.add('open');
  document.getElementById('panel-addr').textContent = selectedAddress.label;
  document.getElementById('map').classList.add('panel-open');
  setTimeout(() => map.invalidateSize(), 400);

  document.getElementById('results-content').innerHTML = `<div class="loading"><div class="spinner"></div>Analyse en cours...</div>`;

  try {
    const res = await fetch('/api/eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: selectedAddress.latitude, longitude: selectedAddress.longitude,
        numero: selectedAddress.numero, nom_voie: selectedAddress.nom_voie,
        code_postal: selectedAddress.code_postal, nom_commune: selectedAddress.nom_commune
      })
    });
    const data = await res.json();
    lastResults = data;
    displayResults(data);
  } catch(e) {
    document.getElementById('results-content').innerHTML = `<div style="padding:30px;text-align:center;font-size:13px;color:#f87171">Impossible de contacter l'API.</div>`;
  }
}

function displayResults(data) {
  const admin = isAdmin();
  const container = document.getElementById('results-content');
  const techs = data.technologies || data.offers || data.results || [];
  const eligible = Array.isArray(techs) ? techs.some(t => t.eligible !== false && t.available !== false) : false;

  let html = '';
  if (admin) html += `<div class="admin-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Vue administrateur</div>`;

  html += `<div class="status-badge ${eligible ? 'status-eligible' : 'status-not-eligible'}">
    ${eligible
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Éligible'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Non éligible'
    }
  </div>`;

  if (Array.isArray(techs) && techs.length > 0) {
    const groups = {
      'Fibre dédiée':     techs.filter(t => ['ftto','sdsl_fo','fiber_dedicated'].includes(t.type||t.infrastructure_type)),
      'Fibre mutualisée': techs.filter(t => ['ftth','fttb','fiber_shared'].includes(t.type||t.infrastructure_type)),
      'Cuivre':           techs.filter(t => ['adsl','vdsl','vdsl2','sdsl'].includes(t.type||t.infrastructure_type)),
    };
    const other = techs.filter(t => !Object.values(groups).flat().includes(t));
    if (other.length) groups['Autres'] = other;

    let delay = 0;
    for (const [label, list] of Object.entries(groups)) {
      if (!list.length) continue;
      html += `<div class="section-label">${label}</div>`;
      list.forEach(t => { html += renderCard(t, admin, delay); delay += 50; });
    }
  } else {
    html += `<p style="font-size:13px;color:rgba(255,255,255,0.35);text-align:center;padding:30px 0">Aucune offre disponible.</p>`;
  }

  container.innerHTML = html;
}

function renderCard(tech, admin, delay=0) {
  const available = tech.eligible !== false && tech.available !== false;
  const name = tech.name || tech.infrastructure_type || tech.type || 'Offre';
  const down = tech.debit_down || tech.download_speed || tech.max_download || null;
  const up   = tech.debit_up   || tech.upload_speed   || tech.max_upload   || null;
  let adminHtml = '';
  if (admin) {
    const price    = tech.price || tech.prix || null;
    const operator = tech.operator || tech.operateur || null;
    if (price || operator) adminHtml = `<div class="admin-block">${price?`<div class="admin-row"><span>Prix d'achat HT</span><span>${price} €/mois</span></div>`:''} ${operator?`<div class="admin-row"><span>Opérateur infra</span><span>${operator}</span></div>`:''}</div>`;
  }
  return `<div class="tech-card" style="animation-delay:${delay}ms">
    <div class="tech-card-top">
      <span class="tech-name">${name}</span>
      <span class="avail-pill ${available?'avail-yes':'avail-no'}">${available?'Disponible':'Indisponible'}</span>
    </div>
    <div class="tech-speeds">
      <span>↓ <span class="speed-val">${fmtSpeed(down)}</span></span>
      <span>↑ <span class="speed-val">${fmtSpeed(up)}</span></span>
    </div>
    ${adminHtml}
  </div>`;
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
  setTimeout(() => map.invalidateSize(), 400);
}

function openContact() {
  if (selectedAddress) document.getElementById('contact-address').value = selectedAddress.label;
  document.getElementById('contact-success').style.display = 'none';
  document.getElementById('contact-error').style.display   = 'none';
  document.getElementById('contact-modal').classList.add('open');
}

function closeContact() { document.getElementById('contact-modal').classList.remove('open'); }

async function sendContact() {
  const firstname = document.getElementById('contact-firstname').value.trim();
  const lastname  = document.getElementById('contact-lastname').value.trim();
  const email     = document.getElementById('contact-email').value.trim();
  const errEl     = document.getElementById('contact-error');
  const okEl      = document.getElementById('contact-success');
  const btn       = document.getElementById('contact-submit');
  errEl.style.display = okEl.style.display = 'none';
  if (!firstname || !lastname || !email) { errEl.textContent = 'Prénom, nom et email obligatoires.'; errEl.style.display = 'block'; return; }
  btn.disabled = true; btn.textContent = 'Envoi...';
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: 'commercial@crypteo.fr',
      from_name: `${firstname} ${lastname}`,
      company: document.getElementById('contact-company').value || 'Non renseigné',
      address: document.getElementById('contact-address').value || 'Non renseignée',
      phone:   document.getElementById('contact-phone').value   || 'Non renseigné',
      from_email: email,
      message: document.getElementById('contact-message').value || "Demande d'éligibilité."
    });
    okEl.style.display = 'block';
    setTimeout(closeContact, 3000);
  } catch(e) {
    errEl.textContent = "Erreur lors de l'envoi."; errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Envoyer la demande';
  }
}
