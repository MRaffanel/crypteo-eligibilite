module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { latitude, longitude, code_postal } = req.body;
  if (!latitude || !longitude) return res.status(400).json({ error: 'Coordonnées manquantes' });

  const cp = parseInt(code_postal) || 0;
  const isRural = cp > 30000 && (cp < 31000 || cp > 34000);

  const mock = {
    technologies: [
      {
        type: 'ftto',
        name: 'Fibre dédiée FTTO',
        eligible: !isRural,
        available: !isRural,
        debit_down: 1000,
        debit_up: 1000,
        price: 89,
        operator: 'Orange Business'
      },
      {
        type: 'ftth',
        name: 'Fibre mutualisée FTTH',
        eligible: true,
        available: true,
        debit_down: 8000,
        debit_up: 700,
        price: 22,
        operator: 'SFR'
      },
      {
        type: 'vdsl2',
        name: 'VDSL2',
        eligible: !isRural,
        available: !isRural,
        debit_down: 100,
        debit_up: 30,
        price: 12,
        operator: 'Orange'
      },
      {
        type: 'adsl',
        name: 'ADSL',
        eligible: true,
        available: true,
        debit_down: 20,
        debit_up: 1,
        price: 8,
        operator: 'Orange'
      }
    ]
  };

  return res.status(200).json(mock);
};
