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
      
      const results = await searchWithGoogle(query, numResults);
      
      return res.json({
        jsonrpc: '2.0', id,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({
              query,
              results_count: results.length,
              results,
              source: results[0]?.source || 'Unknown',
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
    console.error('Server error:', error);
    return res.status(500).json({
      jsonrpc: '2.0', id: req.body?.id,
      error: { code: -32603, message: error.message }
    });
  }
}

async function searchWithGoogle(query, numResults) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  console.log('API Key exists:', !!apiKey);
  console.log('Search Engine ID exists:', !!searchEngineId);

  // 如果没有 Google API 配置，使用百度搜索
  if (!apiKey || !searchEngineId) {
    console.log('Google API not configured, using Baidu');
    return searchBaidu(query, numResults);
  }

  try {
    // 使用 Google Custom Search API
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=${numResults}&lr=lang_zh-CN`;
    
    console.log('Calling Google API...');
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Google API response status:', response.status);
    
    if (data.error) {
      console.error('Google API error:', data.error);
      return searchBaidu(query, numResults);
    }

    if (!data.items || data.items.length === 0) {
      console.log('No results from Google, using Baidu');
      return searchBaidu(query, numResults);
    }

    return data.items.map(item => ({
      title: item.title,
      content: item.snippet,
      url: item.link,
      source: 'Google'
    }));

  } catch (error) {
    console.error('Google search failed:', error);
    return searchBaidu(query, numResults);
  }
}

function searchBaidu(query, numResults) {
  const encodedQuery = encodeURIComponent(query);
  
  return [
    {
      title: '百度搜索',
      content: `点击链接查看"${query}"的完整搜索结果`,
      url: `https://www.baidu.com/s?wd=${encodedQuery}`,
      source: 'Baidu'
    },
    {
      title: '百度新闻',
      content: `查看"${query}"的最新新闻报道`,
      url: `https://news.baidu.com/ns?word=${encodedQuery}`,
      source: 'Baidu News'
    },
    {
      title: '百度资讯',
      content: `查看"${query}"的深度资讯分析`,
      url: `https://www.baidu.com/s?wd=${encodedQuery}&rtt=1&bsst=1&cl=2&tn=news`,
      source: 'Baidu Info'
    },
    {
      title: '知乎讨论',
      content: `查看"${query}"在知乎上的高质量讨论`,
      url: `https://www.zhihu.com/search?type=content&q=${encodedQuery}`,
      source: 'Zhihu'
    },
    {
      title: '头条搜索',
      content: `在今日头条中搜索"${query}"`,
      url: `https://so.toutiao.com/search?keyword=${encodedQuery}`,
      source: 'Toutiao'
    }
  ].slice(0, numResults);
}
