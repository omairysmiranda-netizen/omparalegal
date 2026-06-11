export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { first_name, last_name, email, service, message } = req.body;

  if (!first_name || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await Promise.all([
      sendEmail({ first_name, last_name, email, service, message }),
      createHubSpotContact({ first_name, last_name, email, service, message }),
    ]);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Submission failed' });
  }
}

async function sendEmail({ first_name, last_name, email, service, message }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'omparalegal.com <onboarding@resend.dev>',
      to: 'omairysmiranda@gmail.com',
      subject: `New Lead - omparalegal.com`,
      html: `
        <h2>New contact form submission</h2>
        <p><strong>Name:</strong> ${first_name} ${last_name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Service:</strong> ${service || 'Not specified'}</p>
        <p><strong>Message:</strong><br>${message}</p>
      `,
    }),
  });
  if (!r.ok) throw new Error(`Resend error: ${await r.text()}`);
}

async function createHubSpotContact({ first_name, last_name, email, service, message }) {
  const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        firstname: first_name,
        lastname: last_name,
        email: email,
        hs_lead_status: 'NEW',
        message: `Service: ${service || 'Not specified'}\n\n${message}`,
      },
    }),
  });
  if (!r.ok) {
    const err = await r.json();
    if (err.category === 'CONFLICT') return;
    throw new Error(`HubSpot error: ${JSON.stringify(err)}`);
  }
}
