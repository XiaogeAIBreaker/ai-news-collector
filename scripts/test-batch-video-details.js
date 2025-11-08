#!/usr/bin/env node

import 'dotenv/config';
import { Composio } from '@composio/core';

/**
 * 测试 YOUTUBE_VIDEO_DETAILS 是否支持批量获取(通过逗号分隔多个 ID)
 */
async function testBatchVideoDetails() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  const connectionId = process.env.COMPOSIO_CONNECTION_ID_YOUTUBE;
  const userId = process.env.COMPOSIO_USER_ID_YOUTUBE;

  const composio = new Composio({ apiKey });

  try {
    console.log('测试 YOUTUBE_VIDEO_DETAILS 批量获取能力...\n');

    // 测试获取 3 个视频
    const testVideoIds = [
      'QagTKYVfF_k', // 已知有效的视频 ID
      'dQw4w9WgXcQ', // Rick Astley - Never Gonna Give You Up
      'jNQXAC9IVRw'  // Me at the zoo (first YouTube video)
    ];

    console.log(`测试批量获取 ${testVideoIds.length} 个视频...`);
    console.log(`视频 IDs: ${testVideoIds.join(', ')}\n`);

    const result = await composio.tools.execute('YOUTUBE_VIDEO_DETAILS', {
      connectedAccountId: connectionId,
      userId,
      arguments: {
        id: testVideoIds.join(','), // 逗号分隔多个 ID
        part: 'snippet,statistics,contentDetails'
      },
      dangerouslySkipVersionCheck: true
    });

    if (result.data && result.data.response_data && result.data.response_data.items) {
      const items = result.data.response_data.items;
      console.log(`✅ 成功! 返回了 ${items.length} 个视频详情\n`);

      items.forEach((item, index) => {
        console.log(`视频 ${index + 1}:`);
        console.log(`  ID: ${item.id}`);
        console.log(`  标题: ${item.snippet?.title}`);
        console.log(`  观看次数: ${item.statistics?.view_count || item.statistics?.viewCount || 'N/A'}`);
        console.log('');
      });

      console.log(`\n结论: YOUTUBE_VIDEO_DETAILS 支持批量获取 ✅`);
      console.log(`当前实现已经正确使用了批量 API (通过逗号分隔 ID)`);
    } else {
      console.log('❌ 响应结构异常');
      console.log(JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('测试失败:', error.message);
    console.error(error.stack);
  }
}

testBatchVideoDetails();
