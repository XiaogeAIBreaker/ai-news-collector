#!/usr/bin/env node

/**
 * 极简 YouTube 采集 Demo
 * 通过 YouTubeCollector 采集频道视频,输出视频标题、频道、发布时间、观看量
 */

import 'dotenv/config';
import { YouTubeCollector } from '../src/collectors/youtube.js';
import { YOUTUBE_CONFIG } from '../src/config/datasources.js';

async function main() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  const connectionId = process.env.COMPOSIO_CONNECTION_ID_YOUTUBE;
  const userId = process.env.COMPOSIO_USER_ID_YOUTUBE;

  // 检查环境变量
  if (!apiKey) {
    console.error('❌ 缺少环境变量 COMPOSIO_API_KEY');
    process.exit(1);
  }

  if (!connectionId) {
    console.error('❌ 缺少环境变量 COMPOSIO_CONNECTION_ID_YOUTUBE');
    process.exit(1);
  }

  if (!userId) {
    console.error('❌ 缺少环境变量 COMPOSIO_USER_ID_YOUTUBE');
    process.exit(1);
  }

  console.log('✅ 环境变量检查通过');
  console.log(`📌 Connection ID: ${connectionId}`);
  console.log(`📌 User ID: ${userId}`);
  console.log('');

  try {
    // 创建 YouTube 采集器实例
    const collector = new YouTubeCollector(YOUTUBE_CONFIG);

    console.log('🚀 开始采集 YouTube 视频...\n');

    // 执行采集
    const newsItems = await collector.collect();

    if (newsItems.length === 0) {
      console.log('⚠️  未采集到任何视频');
      console.log('提示: 请检查 config/youtube-channels.json 配置文件');
      return;
    }

    console.log(`\n✅ 采集成功! 共 ${newsItems.length} 个视频\n`);
    console.log('='.repeat(80));

    // 输出视频列表
    newsItems.forEach((item, index) => {
      const metadata = item.metadata || {};
      const viewCount = metadata.viewCount ? metadata.viewCount.toLocaleString() : '0';
      const likeCount = metadata.likeCount ? metadata.likeCount.toLocaleString() : '0';
      const commentCount = metadata.commentCount ? metadata.commentCount.toLocaleString() : '0';
      const channelTitle = metadata.channelTitle || item.sourceName || 'Unknown';

      console.log(`\n[${index + 1}] ${item.title}`);
      console.log(`📺 频道: ${channelTitle}`);
      console.log(`🔗 链接: ${item.url}`);
      console.log(`📅 发布时间: ${item.createdAt.toISOString().split('T')[0]}`);
      console.log(`📊 数据: 👁️  ${viewCount} 观看 | 👍 ${likeCount} 点赞 | 💬 ${commentCount} 评论`);

      if (item.summary && item.summary.length > 0) {
        const shortSummary = item.summary.length > 150 ? item.summary.slice(0, 150) + '...' : item.summary;
        console.log(`📝 摘要: ${shortSummary}`);
      }

      console.log('-'.repeat(80));
    });

    console.log(`\n总计: ${newsItems.length} 个视频采集完成\n`);
  } catch (error) {
    console.error('❌ 执行 YouTube 采集出错:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
