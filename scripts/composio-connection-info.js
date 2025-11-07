#!/usr/bin/env node

/**
 * Composio 连接信息辅助脚本
 * 根据 Connection ID 输出 user_id 等关键字段,便于填写环境变量
 */

import 'dotenv/config';
import { Composio } from '@composio/core';

const apiKey = process.env.COMPOSIO_API_KEY;
const connectionId = process.argv[2] || process.env.COMPOSIO_CONNECTION_ID_TWITTER;

if (!apiKey) {
  console.error('缺少环境变量 COMPOSIO_API_KEY');
  process.exit(1);
}

if (!connectionId) {
  console.error('请通过命令参数或环境变量提供 COMPOSIO_CONNECTION_ID_TWITTER');
  console.error('示例: COMPOSIO_API_KEY=xxx node scripts/composio-connection-info.js ca_xxx');
  process.exit(1);
}

const composio = new Composio({ apiKey });

async function main() {
  try {
    const raw = await composio.connectedAccounts.client.connectedAccounts.retrieve(connectionId);

    console.log('连接信息:');
    console.log(`  connection_id : ${raw.id}`);
    console.log(`  user_id       : ${raw.user_id}`);
    console.log(`  toolkit       : ${raw.toolkit?.slug ?? 'unknown'}`);
    console.log(`  status        : ${raw.status}`);
    console.log(`  created_at    : ${raw.created_at}`);
    console.log(`  updated_at    : ${raw.updated_at}`);
    console.log('');
    console.log('将以上 user_id 填入环境变量 COMPOSIO_USER_ID_TWITTER 中。');
  } catch (error) {
    console.error('查询连接失败:', error.message);
    if (error.response?.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
