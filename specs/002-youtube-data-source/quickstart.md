# Quick Start Guide: YouTube 数据源集成

**Feature**: YouTube 数据源集成
**Last Updated**: 2025-11-07
**Audience**: 开发者和系统管理员

## Overview

本指南提供 YouTube 数据源的快速配置和使用说明,帮助您在 5 分钟内完成从 Composio 认证到首次成功采集的全流程。

---

## Prerequisites

### 必需项

- [x] Node.js 18+ 已安装
- [x] 项目代码已克隆到本地
- [x] npm 依赖已安装(`npm install`)
- [x] Composio 账号已创建([https://app.composio.dev](https://app.composio.dev))

### 可选项

- [ ] 已了解 YouTube Data API v3 基础概念
- [ ] 已准备好要监控的 YouTube 频道列表

---

## Step 1: Composio 认证配置

### 1.1 获取 Composio API Key

1. 登录 Composio Dashboard: [https://app.composio.dev](https://app.composio.dev)
2. 导航到 **Settings** → **API Keys**
3. 点击 **Create API Key**
4. 复制生成的 API Key(格式: `xxxxxx`)

### 1.2 连接 YouTube 账号

#### 方法 A: 通过 Composio Dashboard(推荐)

1. 在 Composio Dashboard 中,导航到 **Integrations** → **YouTube**
2. 点击 **Connect Account**
3. 授权 Composio 访问您的 YouTube 账号(需要 Google 账号登录)
4. 授权完成后,记录以下信息:
   - **Connection ID**: 格式为 `ca_xxxxxx`
   - **User ID**: 格式为 `pg-test-xxxxxx` 或自定义的用户 ID

#### 方法 B: 通过 CLI(备选)

```bash
# 安装 Composio CLI(如果尚未安装)
npm install -g composio-cli

# 登录 Composio
composio login

# 连接 YouTube
composio add youtube

# 查看连接信息
composio show youtube
```

**重要提示**: 如果您已经在用户输入中提供了连接 ID,可以跳过此步骤:

```
COMPOSIO_CONNECTION_ID_YOUTUBE=ca_GaLGeH5yN4aL
COMPOSIO_USER_ID_YOUTUBE=pg-test-dbf123a3-79fd-4230-bd31-a0148cf36bea
```

### 1.3 配置环境变量

编辑项目根目录的 `.env` 文件,添加以下配置:

```bash
# Composio API Key(必需)
COMPOSIO_API_KEY=your_api_key_here

# YouTube 连接信息(必需)
COMPOSIO_CONNECTION_ID_YOUTUBE=ca_GaLGeH5yN4aL
COMPOSIO_USER_ID_YOUTUBE=pg-test-dbf123a3-79fd-4230-bd31-a0148cf36bea
```

**验证配置**:

```bash
# 运行验证脚本(将在实施阶段添加)
node scripts/verify-youtube-connection.js
```

预期输出:

```
✅ Composio API Key 有效
✅ YouTube 连接有效
✅ 可以访问 YouTube Data API
```

---

## Step 2: 配置 YouTube 频道

### 2.1 创建配置文件

在项目根目录的 `config/` 文件夹中创建 `youtube-channels.json`:

```bash
touch config/youtube-channels.json
```

### 2.2 配置频道列表

编辑 `config/youtube-channels.json`,添加您想要监控的 YouTube 频道:

```json
{
  "channels": [
    {
      "channelId": "UCxxxxxx",
      "displayName": "OpenAI",
      "handle": "@openai",
      "enabled": true,
      "tags": ["AI", "Research", "OpenAI"]
    },
    {
      "channelId": "UCyyyyyy",
      "displayName": "TwoMinutePapers",
      "handle": "@TwoMinutePapers",
      "enabled": true,
      "tags": ["AI", "Papers", "Research"]
    }
  ],
  "keywords": ["AI", "Machine Learning", "大模型", "AIGC"],
  "config": {
    "maxResultsPerPage": 50,
    "maxItemsPerChannel": 10,
    "maxItemsPerKeyword": 20,
    "defaultLanguages": ["zh", "en"],
    "usePlaylistMethod": true,
    "queryPrefix": "-is:live"
  }
}
```

### 2.3 如何查找 YouTube 频道 ID

#### 方法 1: 通过频道页面 URL

频道 URL 格式: `https://www.youtube.com/channel/UCxxxxxx`

直接从 URL 中提取 `UCxxxxxx` 部分。

#### 方法 2: 通过 @ 句柄查找

1. 访问频道页面: `https://www.youtube.com/@openai`
2. 右键查看页面源代码
3. 搜索 `"channelId"` 或 `"externalId"`
4. 找到 `"channelId":"UCxxxxxx"` 字段

#### 方法 3: 使用在线工具

访问 [commentpicker.com/youtube-channel-id.php](https://commentpicker.com/youtube-channel-id.php),输入频道 URL 或 @ 句柄即可获取。

---

## Step 3: 运行首次采集

### 3.1 启动主程序

```bash
# 运行完整采集流程(包括所有数据源)
npm start
```

预期输出:

```
[YouTube] 开始采集 YouTube 数据...
[YouTube] 执行查询: channelId=UCxxxxxx
[YouTube] 查询 "OpenAI" 获取 10 条视频
[YouTube] 查询 "TwoMinutePapers" 获取 8 条视频
[YouTube] 采集完成,获取 18 条内容 (去重后)
```

### 3.2 仅测试 YouTube 数据源

创建测试脚本 `scripts/youtube-demo.js`(参考 `scripts/twitter-demo.js`):

```javascript
import { YouTubeCollector } from '../src/collectors/youtube.js';
import { YOUTUBE_CONFIG } from '../src/config/datasources.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('=== YouTube 数据采集测试 ===\n');

  const collector = new YouTubeCollector(YOUTUBE_CONFIG);
  const items = await collector.collect();

  console.log(`\n采集完成: ${items.length} 条视频`);
  console.log('\n示例视频:');
  items.slice(0, 3).forEach((item, index) => {
    console.log(`\n${index + 1}. ${item.title}`);
    console.log(`   频道: ${item.metadata.channelTitle}`);
    console.log(`   发布时间: ${item.createdAt}`);
    console.log(`   观看量: ${item.metadata.viewCount}`);
    console.log(`   链接: ${item.url}`);
  });
}

main().catch(console.error);
```

运行测试:

```bash
node scripts/youtube-demo.js
```

---

## Step 4: 验证输出

### 4.1 检查日志

采集完成后,检查控制台日志:

```
[YouTube] ✅ 采集完成,获取 18 条内容
[Filter] 初筛通过: 15 条
[LLM] 评分完成: 12 条高分内容
[Markdown] 报告已生成: docs/filtered-news-20251107-150000.md
```

### 4.2 查看生成的报告

打开 `docs/filtered-news-*.md` 文件,检查 YouTube 部分:

```markdown
## YouTube

### 🌟 OpenAI Announces GPT-5 (9.2分)
**来源**: OpenAI
**发布时间**: 2025-11-06 10:30:00
**观看量**: 1,234,567
**链接**: https://www.youtube.com/watch?v=xxxxx

OpenAI has announced the next generation of GPT models...

---

### 🌟 New AI Research Breakthrough (8.7分)
**来源**: TwoMinutePapers
**发布时间**: 2025-11-05 14:20:00
**观看量**: 567,890
**链接**: https://www.youtube.com/watch?v=yyyyy

Researchers have achieved a significant breakthrough...
```

---

## Configuration Reference

### 频道配置字段说明

| 字段 | 必填 | 类型 | 说明 | 示例 |
|-----|-----|------|------|------|
| `channelId` | ✅ | string | YouTube 频道 ID(以 UC 开头) | `"UCxxxxxx"` |
| `displayName` | ❌ | string | 频道显示名称(用于报告) | `"OpenAI"` |
| `handle` | ❌ | string | 频道 @ 句柄 | `"@openai"` |
| `enabled` | ❌ | boolean | 是否启用(默认 true) | `true` |
| `keywords` | ❌ | string[] | 频道级关键词过滤 | `["GPT"]` |
| `languages` | ❌ | string[] | 语言偏好(ISO 639-1) | `["zh", "en"]` |
| `tags` | ❌ | string[] | 自定义标签 | `["AI", "Research"]` |

### 全局配置字段说明

| 字段 | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| `maxResultsPerPage` | number | 50 | 每页最大结果数(10-50) |
| `maxItemsPerChannel` | number | 10 | 每频道最大采集数 |
| `maxItemsPerKeyword` | number | 20 | 每关键词最大采集数 |
| `defaultLanguages` | string[] | `[]` | 默认语言列表 |
| `usePlaylistMethod` | boolean | `true` | 优先使用播放列表方法(省配额) |
| `queryPrefix` | string | `"-is:live"` | 全局查询前缀(排除直播) |

---

## Troubleshooting

### 常见问题

#### 1. 环境变量缺失

**症状**: 控制台输出警告 `缺少 Composio 环境变量,跳过 YouTube 采集`

**解决方案**:
1. 检查 `.env` 文件是否存在
2. 确认 `COMPOSIO_API_KEY`, `COMPOSIO_CONNECTION_ID_YOUTUBE`, `COMPOSIO_USER_ID_YOUTUBE` 已正确配置
3. 确认环境变量值没有多余的空格或引号

#### 2. 配额耗尽

**症状**: 错误日志 `YouTube API 配额已耗尽,停止采集`

**原因**: YouTube Data API 每日配额为 10,000 units,搜索方法消耗 100 units/请求

**解决方案**:
1. 检查 `usePlaylistMethod: true` 是否启用(播放列表方法仅消耗 1 unit)
2. 减少 `maxItemsPerChannel` 和监控的频道数量
3. 配额将在太平洋时间午夜(UTC-8)自动重置
4. 考虑申请 YouTube API 配额提升

#### 3. 认证失败

**症状**: 错误日志 `YouTube 连接无效` 或 `403 Forbidden`

**解决方案**:
1. 在 Composio Dashboard 中检查连接状态
2. 尝试重新授权 YouTube 连接
3. 确认 `COMPOSIO_CONNECTION_ID_YOUTUBE` 与 Dashboard 中的连接 ID 一致

#### 4. 频道 ID 无效

**症状**: 错误日志 `频道 "xxx" 采集失败: 404 Not Found`

**解决方案**:
1. 确认 `channelId` 以 `UC` 开头,长度为 24 字符
2. 访问 `https://www.youtube.com/channel/UCxxxxxx` 验证频道存在
3. 检查频道是否已删除或设为私有

#### 5. 未采集到任何视频

**症状**: 日志显示 `YouTube 采集完成,获取 0 条内容`

**排查步骤**:
1. 检查频道配置中的 `enabled` 字段是否为 `true`
2. 确认频道在最近 N 天内有发布新视频(N 由全局 `recentDays` 配置决定)
3. 检查 `config/collection-window.json` 中的时间窗口设置
4. 尝试手动访问频道页面验证有新视频

---

## Advanced Configuration

### 场景 1: 仅采集特定关键词的视频

如果您只想采集包含特定关键词的视频(频道级过滤):

```json
{
  "channels": [
    {
      "channelId": "UCxxxxxx",
      "displayName": "Tech Channel",
      "keywords": ["AI", "GPT", "LLM"],  // 仅采集包含这些关键词的视频
      "enabled": true
    }
  ]
}
```

**注意**: 启用频道级关键词后,将使用搜索方法(配额 100),而非播放列表方法(配额 1)。

### 场景 2: 全局关键词搜索(无频道配置)

如果您不想订阅特定频道,只想搜索关键词相关的视频:

```json
{
  "channels": [],  // 留空
  "keywords": ["AI 新闻", "Machine Learning 突破", "GPT-5"],
  "config": {
    "maxItemsPerKeyword": 30
  }
}
```

### 场景 3: 多语言内容采集

采集中英文混合内容:

```json
{
  "channels": [
    {
      "channelId": "UCxxxxxx",
      "languages": ["zh", "en"]  // 中文和英文视频
    }
  ],
  "config": {
    "defaultLanguages": ["zh", "en"]
  }
}
```

### 场景 4: 禁用特定频道

临时禁用某个频道而不删除配置:

```json
{
  "channels": [
    {
      "channelId": "UCxxxxxx",
      "displayName": "Temporarily Disabled",
      "enabled": false  // 暂时禁用
    }
  ]
}
```

---

## Performance Tips

### 优化配额消耗

1. **优先使用播放列表方法**:
   - 确保 `usePlaylistMethod: true`
   - 不配置频道级 `keywords`(会强制使用搜索方法)

2. **减少频道数量**:
   - 监控 10 个频道: 配额消耗 ~15 units
   - 监控 50 个频道: 配额消耗 ~75 units

3. **调整采集频率**:
   - 每小时运行: 每日配额消耗 ~360 units
   - 每 6 小时运行: 每日配额消耗 ~60 units

### 优化采集速度

1. **减少 `maxItemsPerChannel`**:
   - 10 条/频道: ~20秒/频道
   - 50 条/频道: ~60秒/频道

2. **调整时间窗口**:
   - 最近 1 天: 采集速度最快
   - 最近 7 天: 采集速度适中
   - 最近 30 天: 可能触发分页,速度较慢

---

## Next Steps

- ✅ 完成首次采集测试
- ⏭️ 调整过滤规则: 编辑 `config/filter-rules.json`
- ⏭️ 配置定时任务: 使用 cron 或 GitHub Actions
- ⏭️ 集成通知: 配置邮件或 Webhook 推送
- ⏭️ 监控配额: 定期检查 YouTube API 配额使用情况

---

## Additional Resources

- **YouTube Data API 文档**: [https://developers.google.com/youtube/v3](https://developers.google.com/youtube/v3)
- **Composio 文档**: [https://docs.composio.dev](https://docs.composio.dev)
- **项目 README**: [README.md](../../README.md)
- **数据模型文档**: [data-model.md](data-model.md)
- **API 契约文档**: [contracts/youtube-collector-interface.md](contracts/youtube-collector-interface.md)

---

## Support

如果遇到问题:

1. 检查本文档的 Troubleshooting 部分
2. 查看项目 GitHub Issues: [github.com/XiaogeAIBreaker/ai-news-collector/issues](https://github.com/XiaogeAIBreaker/ai-news-collector/issues)
3. 参考 Twitter 数据源配置(实现模式相同): [docs/.env配置/如何接入推特.md](../../docs/.env配置/如何接入推特.md)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-07
**Maintainer**: AI News Collector Team
