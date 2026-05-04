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
            description: '搜索互联网信息，返回标题、摘要和链接',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: '搜索关键词' },
                num_results: { type: 'integer', description: '结果数量（默认5）', default: 5 }
              },
              required: ['query']
            }
          }]
        }
      });
    }

    if (method === 'tools/call') {
      const query = params?.arguments?.query || 'test';
      const numResults = params?.arguments?.num_results || 5;
      
      const results = await searchGoogle(query, numResults);
      
      return res.json({
        jsonrpc: '2.0', id,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({
              query,
              results,
              source: 'Google Custom Search',
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

async function searchGoogle(query, numResults) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId) {
    console.log('Google API not configured, using fallback');
    return searchFallback(query, numResults);
  }

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=${numResults}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('Google API error:', data.error);
      return searchFallback(query, numResults);
    }

    return data.items?.map(item => ({
      title: item.title,
      content: item.snippet,
      url: item.link,
      source: 'Google'
    })) || [];

  } catch (error) {
    console.error('Google search failed:', error);
    return searchFallback(query, numResults);
  }
}

function searchFallback(query, numResults) {
  const encodedQuery = encodeURIComponent(query);
  
  return [
    {
      title: '百度搜索',
      content: `在百度中搜索：${query}`,
      url: `https://www.baidu.com/s?wd=${encodedQuery}`,
      source: 'Baidu'
    },
    {
      title: '百度新闻',
      content: `查看最新新闻：${query}`,
      url: `https://news.baidu.com/ns?word=${encodedQuery}`,
      source: 'Baidu News'
    },
    {
      title: '知乎',
      content: `查看知乎讨论：${query}`,
      url: `https://www.zhihu.com/search?type=content&q=${encodedQuery}`,
      source: 'Zhihu'
    }
  ].slice(0, numResults);
}
