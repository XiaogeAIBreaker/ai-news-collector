#!/usr/bin/env node

import 'dotenv/config';
import { Composio } from '@composio/core';

async function testYouTubeTools() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  const connectionId = process.env.COMPOSIO_CONNECTION_ID_YOUTUBE;
  const userId = process.env.COMPOSIO_USER_ID_YOUTUBE;

  const composio = new Composio({ apiKey });

  try {
    console.log('测试不同的 YouTube 工具名称...\n');

    const testToolNames = [
      'YOUTUBE_GET_VIDEO_DETAILS',
      'YOUTUBE_VIDEOS_LIST',
      'YOUTUBE_GET_VIDEOS',
      'YOUTUBE_LIST_VIDEOS',
      'YOUTUBE_VIDEO_DETAILS'
    ];

    for (const toolName of testToolNames) {
      try {
        console.log(`尝试: ${toolName}`);
        const result = await composio.tools.execute(toolName, {
          connectedAccountId: connectionId,
          userId,
          arguments: {
            id: 'QagTKYVfF_k',
            part: 'snippet'
          },
          dangerouslySkipVersionCheck: true
        });

        console.log(`✅ ${toolName} 成功!`);
        console.log(`响应结构:`, JSON.stringify(result.data, null, 2).slice(0, 500));
        break;
      } catch (error) {
        console.log(`❌ ${toolName} 失败: ${error.message}\n`);
      }
    }

  } catch (error) {
    console.error('整体错误:', error.message);
  }
}

testYouTubeTools();
