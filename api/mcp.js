export default async function handler(req, res) {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 首页返回状态信息
  if (req.method !== 'POST') {
    return res.json({
      status: 'running',
      server: 'MCP Search Server',
      version: '1.0.0',
      instructions: {
        method: 'POST',
        url: '/api/mcp',
        contentType: 'application/json',
        example: {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {}
        }
      }
    });
  }

  try {
    // 解析请求体
    const body = req.body;
    
    // 调试日志
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    // 检查 body 是否存在
    if (!body) {
      return res.json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error: No request body'
        }
      });
    }

    // 提取字段，兼容不同格式
    const jsonrpc = body.jsonrpc || '2.0';
    const id = body.id || null;
    const method = body.method;
    const params = body.params || {};

    // 检查 method 是否存在
    if (method === undefined || method === null) {
      return res.json({
        jsonrpc: '2.0',
        id: id,
        error: {
          code: -32600,
          message: 'Invalid request: method is required',
          data: {
            received: body,
            expected: {
              jsonrpc: '2.0',
              id: 1,
              method: 'initialize',
              params: {}
            }
          }
        }
      });
    }

    // 处理 initialize 方法
    if (method === 'initialize') {
      return res.json({
        jsonrpc: '2.0',
        id: id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'mcp-search-server',
            version: '1.0.0'
          },
          capabilities: {
            tools: {}
          }
        }
      });
    }

    // 处理 notifications/initialized 方法
    if (method === 'notifications/initialized') {
      return res.status(204).end();
    }

    // 处理 tools/list 方法
    if (method === 'tools/list') {
      return res.json({
        jsonrpc: '2.0',
        id: id,
        result: {
          tools: [
            {
              name: 'web_search',
              description: '在互联网上搜索信息',
              inputSchema: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: '搜索关键词'
                  },
                  num_results: {
                    type: 'integer',
                    description: '返回结果数量（默认5）',
                    default: 5
                  }
                },
                required: ['query']
              }
            }
          ]
        }
      });
    }

    // 处理 tools/call 方法
    if (method === 'tools/call') {
      const toolName = params.name;
      const args = params.arguments || {};

      if (toolName === 'web_search') {
        const query = args.query || 'test';
        const numResults = args.num_results || 5;

        // 执行搜索
        const results = await searchWeb(query, numResults);

        return res.json({
          jsonrpc: '2.0',
          id: id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  query: query,
                  results: results,
                  source: 'DuckDuckGo',
                  timestamp: new Date().toISOString()
                }, null, 2)
              }
            ]
          }
        });
      } else {
        return res.json({
          jsonrpc: '2.0',
          id: id,
          error: {
            code: -32602,
            message: `Tool not found: ${toolName}`
          }
        });
      }
    }

    // 未知方法
    return res.json({
      jsonrpc: '2.0',
      id: id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`
      }
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32603,
        message: error.message
      }
    });
  }
}

// 搜索函数
async function searchWeb(query, numResults) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;

    const response = await fetch(url);
    const data = await response.json();

    const results = [];

    if (data.Answer) {
      results.push({
        title: '即时回答',
        content: data.Answer,
        url: data.AnswerURL || '',
        type: 'answer'
      });
    }

    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, numResults)) {
        if (topic.Text) {
          results.push({
            title: topic.Text.substring(0, 100),
            content: topic.Text,
            url: topic.FirstURL || '',
            type: 'related'
          });
        }
      }
    }

    if (results.length === 0) {
      results.push({
        title: '搜索建议',
        content: `建议搜索：${query}`,
        url: `https://duckduckgo.com/?q=${encodedQuery}`,
        type: 'suggestion'
      });
    }

    return results.slice(0, numResults);

  } catch (error) {
    return [{
      title: '搜索错误',
      content: `搜索失败：${error.message}`,
      url: '',
      type: 'error'
    }];
  }
}
