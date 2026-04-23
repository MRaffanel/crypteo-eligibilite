export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { latitude, longitude, numero, nom_voie, code_postal, nom_commune } = req.body;
  if (!latitude || !longitude) return res.status(400).json({ error: 'Coordonnées manquantes' });

  const API_KEY    = process.env.NETWO_API_KEY;
  const ACTOR_SLUG = process.env.NETWO_ACTOR_SLUG;
  if (!API_KEY || !ACTOR_SLUG) return res.status(500).json({ error: 'Variables env manquantes' });

  try {
    const params = new URLSearchParams();
    params.append('latitude',  latitude.toString());
    params.append('longitude', longitude.toString());
    if (numero)      params.append('numero',      numero);
    if (nom_voie)    params.append('nom_voie',    nom_voie);
    if (code_postal) params.append('code_postal', code_postal);
    if (nom_commune) params.append('nom_commune', nom_commune);

    const netwoRes = await fetch(`https://api.netwo.io/api/v1/eligibility?${params.toString()}`, {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        'x-actor-slug':  ACTOR_SLUG,
        'x-api-key':     API_KEY,
      }
    });
    const data = await netwoRes.json();
    return res.status(netwoRes.status).json(data);
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
