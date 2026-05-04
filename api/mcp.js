export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.json({ message: 'MCP Server is running' });

  try {
    const { method, id, params } = req.body;

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
              properties: {
                query: { type: 'string', description: '搜索关键词' }
              },
              required: ['query']
            }
          }]
        }
      });
    }

    if (method === 'tools/call') {
      const query = params?.arguments?.query || 'test';
      const results = searchBaidu(query);
      
      return res.json({
        jsonrpc: '2.0', id,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({
              query,
              results,
              source: 'Baidu',
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        }
      });
    }

    return res.json({
      jsonrpc: '2.0', id,
      error: { code: -32601, message: `Method not found: ${method}` }
    });

  } catch (error) {
    return res.status(500).json({
      jsonrpc: '2.0', id: req.body?.id,
      error: { code: -32603, message: error.message }
    });
  }
}

function searchBaidu(query) {
  const encodedQuery = encodeURIComponent(query);
  
  return [
    {
      title: '百度搜索',
      content: `点击链接查看"${query}"的搜索结果`,
      url: `https://www.baidu.com/s?wd=${encodedQuery}`,
      type: 'search-engine'
    },
    {
      title: '百度新闻',
      content: `查看"${query}"的最新新闻`,
      url: `https://news.baidu.com/ns?word=${encodedQuery}`,
      type: 'news'
    },
    {
      title: '百度知道',
      content: `查看"${query}"的相关问题`,
      url: `https://zhidao.baidu.com/search?word=${encodedQuery}`,
      type: 'zhidao'
    },
    {
      title: '百度百科',
      content: `查看"${query}"的百科词条`,
      url: `https://baike.baidu.com/search?word=${encodedQuery}`,
      type: 'baike'
    }
  ];
}
