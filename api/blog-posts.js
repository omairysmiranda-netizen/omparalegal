export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const listRes = await fetch(
      'https://api.github.com/repos/omairysmiranda-netizen/omparalegal/contents/blog',
      { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'omparalegal' } }
    );

    if (!listRes.ok) return res.status(200).json([]);

    const files = await listRes.json();
    const jsonFiles = files.filter(f => f.name.endsWith('.json'));

    const posts = await Promise.all(
      jsonFiles.map(f =>
        fetch(f.download_url).then(r => r.json()).catch(() => null)
      )
    );

    const published = posts
      .filter(p => p && p.published)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json(published);
  } catch (err) {
    return res.status(200).json([]);
  }
}
