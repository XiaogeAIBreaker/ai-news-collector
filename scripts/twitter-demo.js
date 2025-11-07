#!/usr/bin/env node

/**
 * 极简 Twitter 采集 Demo
 * 通过 Composio 执行 Twitter 搜索工具,输出近几条推文标题
 */

import 'dotenv/config';
import { Composio } from '@composio/core';

async function main() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  const connectionId = process.env.COMPOSIO_CONNECTION_ID_TWITTER;
  const userId = process.env.COMPOSIO_USER_ID_TWITTER || 'default';
  const query = process.argv[2] || 'AI news';
  const limit = Number.parseInt(process.env.TWITTER_DEMO_LIMIT || '5', 10);

  if (!apiKey) {
    console.error('缺少环境变量 COMPOSIO_API_KEY');
    process.exit(1);
  }

  if (!connectionId) {
    console.error('缺少环境变量 COMPOSIO_CONNECTION_ID_TWITTER');
    process.exit(1);
  }

  const composio = new Composio({ apiKey });

  try {
    // 使用 Composio 的 Twitter 搜索工具获取推文
    const maxResults = Math.max(10, Math.min(limit, 100));

    const result = await composio.tools.execute('TWITTER_RECENT_SEARCH', {
      connectedAccountId: connectionId,
      userId,
      arguments: {
        query,
        max_results: maxResults,
        tweet_fields: ['created_at', 'public_metrics', 'lang', 'author_id', 'source'],
        user_fields: ['username', 'name', 'profile_image_url'],
        expansions: ['author_id']
      },
      dangerouslySkipVersionCheck: true
    });

    if (!result.successful) {
      console.error('调用 Composio 失败:', result.error);
      process.exit(1);
    }

    const payload = result.data || {};
    const tweets = Array.isArray(payload.data) ? payload.data : [];
    const users = Array.isArray(payload?.includes?.users) ? payload.includes.users : [];
    const userMap = new Map(users.map(user => [user.id, user]));

    if (tweets.length === 0) {
      console.log('未获取到推文,原始响应如下:');
      console.dir(result.data, { depth: null });
      return;
    }

    console.log(`关键词 "${query}" 的最新推文（最多 ${limit} 条）:`);
    tweets.slice(0, limit).forEach((tweet, index) => {
      const text = (tweet?.text || tweet?.full_text || '无文本内容').trim();
      const id = tweet?.id;
      const authorId = tweet?.author_id;
      const user = authorId ? userMap.get(authorId) : null;
      const username = user?.username || tweet?.author?.username || authorId || '未知作者';
      const displayName = user?.name ? `${user.name} (@${username})` : `@${username}`;

      console.log(`\n[${index + 1}] ${displayName}`);
      console.log(text);

      if (id) {
        console.log(`链接: https://twitter.com/${username}/status/${id}`);
      }
      if (tweet?.created_at) {
        console.log(`发布时间: ${tweet.created_at}`);
      }
      const metrics = tweet?.public_metrics;
      if (metrics) {
        console.log(
          `互动: 👍 ${metrics.like_count ?? 0} | 💬 ${metrics.reply_count ?? 0} | 🔁 ${metrics.retweet_count ?? 0} | 📌 ${metrics.quote_count ?? 0}`
        );
      }
    });
  } catch (error) {
    console.error('执行 Twitter 搜索出错:', error.message);
    if (error.response?.data) {
      console.error('返回内容:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
