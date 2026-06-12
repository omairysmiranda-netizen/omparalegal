export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const topics = [
      'Adjustment of Status: step-by-step guide for applicants',
      'What happens at a naturalization interview',
      'VAWA: immigration protection for domestic violence survivors',
      'How to respond to a Request for Evidence (RFE) from USCIS',
      'Family petitions: I-130 process explained',
      'Consular processing vs adjustment of status: which path is right for you',
      'Common mistakes that delay immigration applications',
      'What is the Visa Bulletin and how does it affect your case',
      'Unlawful presence waivers: who qualifies and how to apply',
      'DACA renewals: what you need to know in 2026',
      'How immigration court works: a guide for respondents',
      'Employment authorization: how to apply for a work permit',
      'Asylum process explained: steps from application to decision',
      'What documents do you need for an adjustment of status interview',
      'Removal defense: what options do you have if you receive a deportation order',
    ];

    const today = new Date();
    const topicIndex = today.getDate() % topics.length;
    const topic = topics[topicIndex];
    const dateStr = today.toISOString().split('T')[0];
    const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const prompt = `You are a bilingual immigration paralegal content writer for omparalegal.com, the website of Omairys Miranda, a Senior Immigration Paralegal with 10+ years of experience based in Central Florida.

Write a professional, informative blog post about: "${topic}"

RULES:
- Write in both English and Spanish (clearly separated)
- Tone: professional but accessible, warm, authoritative
- Length: 400-600 words per language
- Include practical tips the reader can act on
- Never give legal advice, always note that paralegal services are not legal advice
- End with a call to action to contact Omairys Miranda at omparalegal.com
- No em dashes, use commas or colons instead
- Format as JSON with this exact structure:
{
  "title_en": "...",
  "title_es": "...",
  "summary_en": "One sentence summary in English",
  "summary_es": "One sentence summary in Spanish",
  "category_en": "one of: Family Petitions, Adjustment of Status, Citizenship, VAWA, RFE, Asylum, Removal Defense, Work Permits, General",
  "category_es": "Spanish translation of category",
  "content_en": "Full HTML content in English using only p, h3, ul, li tags",
  "content_es": "Full HTML content in Spanish using only p, h3, ul, li tags"
}

Respond with ONLY the JSON, no extra text.`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return res.status(500).json({ error: 'Claude API error', detail: err });
    }

    const claudeData = await claudeRes.json();
    const raw = claudeData.content[0].text.trim();

    let post;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      post = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse Claude JSON', raw: raw.slice(0, 300) });
    }

    post.date = dateStr;
    post.slug = slug;
    post.published = false;

    const fileContent = Buffer.from(JSON.stringify(post, null, 2)).toString('base64');
    const githubRes = await fetch(
      `https://api.github.com/repos/omairysmiranda-netizen/omparalegal/contents/drafts/${dateStr}-${slug}.json`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Draft: ${post.title_en}`,
          content: fileContent,
        }),
      }
    );

    if (!githubRes.ok) {
      const err = await githubRes.text();
      return res.status(500).json({ error: 'GitHub error', detail: err });
    }

    const approveUrl = `https://omparalegal.com/api/approve-blog?file=${dateStr}-${slug}.json`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'omparalegal.com <onboarding@resend.dev>',
        to: 'omairysmiranda@gmail.com',
        subject: `Blog Draft Ready: ${post.title_en}`,
        html: `
          <div style="font-family:sans-serif;max-width:680px;margin:0 auto;padding:24px;">
            <div style="background:#16253D;padding:20px 24px;margin-bottom:24px;">
              <h1 style="color:#C49A4A;font-size:18px;margin:0;">OM Paralegal - Blog Draft</h1>
            </div>
            <h2 style="color:#16253D;">${post.title_en}</h2>
            <p style="color:#6B6B6B;font-size:14px;">Category: ${post.category_en} | Date: ${dateStr}</p>
            <p style="color:#2C2C2C;">${post.summary_en}</p>
            <hr style="border:1px solid #D4CFC8;margin:24px 0;"/>
            <div style="color:#2C2C2C;font-size:15px;line-height:1.7;">${post.content_en}</div>
            <hr style="border:1px solid #D4CFC8;margin:24px 0;"/>
            <h3 style="color:#16253D;">Version en Espanol</h3>
            <h4 style="color:#2A7F8F;">${post.title_es}</h4>
            <div style="color:#2C2C2C;font-size:15px;line-height:1.7;">${post.content_es}</div>
            <div style="margin-top:32px;text-align:center;">
              <a href="${approveUrl}" style="display:inline-block;background:#C49A4A;color:#16253D;font-weight:700;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;padding:16px 40px;text-decoration:none;">
                APPROVE AND PUBLISH
              </a>
              <p style="color:#6B6B6B;font-size:12px;margin-top:12px;">Click to publish this post to omparalegal.com</p>
            </div>
          </div>
        `,
      }),
    });

    return res.status(200).json({ ok: true, title: post.title_en, slug });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
