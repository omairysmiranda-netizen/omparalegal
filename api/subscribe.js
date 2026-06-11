export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { first_name, email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        firstname: first_name || '',
        email,
        lifecyclestage: 'subscriber',
        hs_lead_status: 'NEW',
        message: 'Newsletter subscriber via omparalegal.com',
      },
    }),
  });

  if (!r.ok) {
    const err = await r.json();
    if (err.category === 'CONFLICT') return res.status(200).json({ ok: true });
    return res.status(500).json({ error: 'HubSpot error' });
  }

  return res.status(200).json({ ok: true });
}
