export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { fileKey, token } = req.body || {};
  if (!fileKey || !token) return res.status(400).json({ error: 'fileKey and token are required' });

  try {
    const response = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
      headers: { 'X-Figma-Token': token }
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Figma API error: ${response.status} ${errText}` });
    }

    const data = await response.json();
    const frames = [];

    // Recursively extract frames from the Figma document
    function extractFrames(node, depth = 0) {
      if (depth > 3) return; // limit depth
      if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'SECTION') {
        frames.push({
          name: node.name,
          type: node.type,
          width: node.absoluteBoundingBox?.width,
          height: node.absoluteBoundingBox?.height,
          childCount: node.children?.length || 0
        });
      }
      if (node.children && depth < 2) {
        node.children.forEach(child => extractFrames(child, depth + 1));
      }
    }

    if (data.document) {
      extractFrames(data.document);
    }

    return res.status(200).json({ frames, fileName: data.name });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
