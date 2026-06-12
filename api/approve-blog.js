export default async function handler(req, res) {
  const { file } = req.query;
  if (!file) return res.status(400).send('Missing file parameter');

  // Fetch the draft from GitHub
  const getRes = await fetch(
    `https://api.github.com/repos/omairysmiranda-netizen/omparalegal/contents/drafts/${file}`,
    { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } }
  );

  if (!getRes.ok) return res.status(404).send('Draft not found');
  const { content: encoded, sha } = await getRes.json();
  const post = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));

  post.published = true;

  // Write to blog/ folder
  const fileContent = Buffer.from(JSON.stringify(post, null, 2)).toString('base64');
  const publishRes = await fetch(
    `https://api.github.com/repos/omairysmiranda-netizen/omparalegal/contents/blog/${file}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Publish blog post: ${post.title_en}`,
        content: fileContent,
      }),
    }
  );

  if (!publishRes.ok) return res.status(500).send('Failed to publish post');

  // Delete the draft
  await fetch(
    `https://api.github.com/repos/omairysmiranda-netizen/omparalegal/contents/drafts/${file}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: `Remove draft: ${file}`, sha }),
    }
  );

  // Redirect to blog page
  res.setHeader('Location', '/blog.html');
  return res.status(302).end();
}
