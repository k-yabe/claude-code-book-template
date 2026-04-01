export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { html, name } = req.body || {};
  if (!html) return res.status(400).json({ error: 'html is required' });

  const vercelToken = process.env.VERCEL_DEPLOY_TOKEN;
  if (!vercelToken) {
    return res.status(200).json({ error: 'VERCEL_DEPLOY_TOKEN not configured', fallback: true });
  }

  const projectName = (name || 'lp-wireframe').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();

  try {
    // Deploy using Vercel API v13
    const response = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: projectName,
        files: [
          { file: 'index.html', data: html }
        ],
        projectSettings: {
          framework: null
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Vercel API error: ${errText}` });
    }

    const data = await response.json();
    return res.status(200).json({
      url: `https://${data.url}`,
      deploymentId: data.id,
      readyState: data.readyState
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
