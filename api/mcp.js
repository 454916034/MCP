export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.json({ message: 'MCP Search Server is running' });

  try {
    const { method, id } = req.body;

    if (method === 'initialize') {
      return res.json({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'mcp-search', version: '1.0.0' },
          capabilities: { tools: {} }
        }
      });
    }

    if (method === 'tools/list') {
      return res.json({
        jsonrpc: '2.0', id,
        result: {
          tools: [{
            name: 'web_search',
            description: '搜索互联网信息',
            inputSchema: {
              type: 'object',
              properties: { query: { type: 'string', description: '搜索关键词' } },
              required: ['query']
            }
          }]
        }
      });
    }

    if (method === 'tools/call') {
      const query = req.body.params?.arguments?.query || 'test';
      const results = [{
        title: '搜索结果',
        content: `你搜索了：${query}`,
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
      }];
      return res.json({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: JSON.stringify({ query, results }, null, 2) }] }
      });
    }

    return res.json({ error: 'Unknown method' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
