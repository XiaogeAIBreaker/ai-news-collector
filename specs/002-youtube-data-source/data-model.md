# Data Model: YouTube 数据源

**Feature**: YouTube 数据源集成
**Date**: 2025-11-07
**Status**: Design Complete

## Overview

本文档定义 YouTube 数据源集成的核心实体、数据流转和字段映射规则。设计遵循项目现有的 NewsItem 标准结构,确保 YouTube 视频数据能够无缝集成到评分和报告流程中。

## Entity Definitions

### 1. YouTubeChannel (配置实体)

表示用户订阅的 YouTube 频道配置,从 `config/youtube-channels.json` 加载。

#### 字段定义

| 字段 | 类型 | 必填 | 描述 | 示例 |
|-----|------|-----|------|------|
| `channelId` | string | ✅ | YouTube 频道 ID(以 UC 开头) | `"UCxxxxxx"` |
| `displayName` | string | ❌ | 频道显示名称(用于日志和报告) | `"OpenAI"` |
| `handle` | string | ❌ | 频道 @ 句柄(可选,用于 URL 生成) | `"@openai"` |
| `enabled` | boolean | ❌ | 是否启用该频道(默认 true) | `true` |
| `keywords` | string[] | ❌ | 频道级关键词过滤(仅采集包含这些关键词的视频) | `["GPT", "ChatGPT"]` |
| `languages` | string[] | ❌ | 语言偏好(ISO 639-1 代码) | `["zh", "en"]` |
| `tags` | string[] | ❌ | 用户自定义标签(传递到 NewsItem.metadata) | `["AI", "Research"]` |

#### 示例配置

```json
{
  "channels": [
    {
      "channelId": "UCxxxxxx",
      "displayName": "OpenAI",
      "handle": "@openai",
      "enabled": true,
      "keywords": [],
      "languages": ["en"],
      "tags": ["AI", "Research", "OpenAI"]
    },
    {
      "channelId": "UCyyyyyy",
      "displayName": "TwoMinutePapers",
      "handle": "@TwoMinutePapers",
      "enabled": true,
      "tags": ["AI", "Papers"]
    }
  ],
  "keywords": ["AI", "Machine Learning", "大模型"],
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

#### 验证规则

- `channelId` 必须匹配正则表达式 `^UC[a-zA-Z0-9_-]{22}$`(YouTube 频道 ID 格式)
- `displayName` 长度 1-100 字符
- `handle` 必须以 `@` 开头,长度 2-30 字符
- `keywords` 数组元素长度 1-50 字符
- `languages` 必须为有效的 ISO 639-1 代码
- `tags` 数组最多 10 个元素,每个 1-30 字符

---

### 2. YouTubeVideo (API 响应实体)

表示 YouTube Data API 返回的原始视频对象,包含 snippet, statistics, contentDetails 三个主要部分。

#### 字段定义(简化)

基于 YouTube Data API v3 的 `videos.list` 响应:

```typescript
interface YouTubeVideo {
  id: string;  // 视频 ID
  snippet: {
    publishedAt: string;         // ISO 8601 格式时间
    channelId: string;           // 频道 ID
    title: string;               // 视频标题
    description: string;         // 视频描述
    thumbnails: {
      default: { url: string; width: number; height: number; };
      medium: { url: string; width: number; height: number; };
      high: { url: string; width: number; height: number; };
    };
    channelTitle: string;        // 频道名称
    tags?: string[];             // 视频标签
    categoryId: string;          // 分类 ID
    liveBroadcastContent: string; // 'none' | 'upcoming' | 'live'
  };
  statistics: {
    viewCount: string;           // 观看数(字符串格式)
    likeCount: string;           // 点赞数
    commentCount: string;        // 评论数
  };
  contentDetails: {
    duration: string;            // ISO 8601 duration 格式(如 PT15M33S)
    dimension: string;           // '2d' | '3d'
    definition: string;          // 'hd' | 'sd'
    caption: string;             // 'true' | 'false'
  };
}
```

#### 字段来源

| 字段 | API 方法 | Part 参数 |
|-----|---------|----------|
| id | search.list / playlistItems.list | - |
| snippet | videos.list | snippet |
| statistics | videos.list | statistics |
| contentDetails | videos.list | contentDetails |

**注意**: `search.list` 和 `playlistItems.list` 只返回视频 ID 和基础 snippet,需要通过 `videos.list` (批量)获取完整信息。

---

### 3. SearchPlan (搜索计划实体)

表示一个独立的采集任务单元,用于组织频道采集和关键词搜索。

#### 字段定义

| 字段 | 类型 | 描述 | 示例 |
|-----|------|------|------|
| `type` | string | 计划类型: 'channel' 或 'keyword' | `"channel"` |
| `label` | string | 人类可读的标签(用于日志) | `"OpenAI"` |
| `channelId` | string? | 频道 ID(type=channel 时必填) | `"UCxxxxxx"` |
| `uploadPlaylistId` | string? | 上传播放列表 ID(type=channel 时生成) | `"UUxxxxxx"` |
| `keywords` | string[]? | 关键词列表(type=keyword 时必填) | `["AI", "GPT"]` |
| `query` | string? | 搜索查询字符串(type=keyword 时) | `"(AI OR GPT) -is:live"` |
| `language` | string? | 语言偏好(ISO 639-1) | `"zh"` |
| `tags` | string[] | 用户自定义标签 | `["AI", "Research"]` |
| `limit` | number | 该计划的最大采集数量 | `10` |

#### 生成逻辑

```javascript
/**
 * 为频道生成搜索计划
 */
function createChannelPlan(channel, config) {
  const uploadPlaylistId = channel.channelId.replace(/^UC/, 'UU');

  return {
    type: 'channel',
    label: channel.displayName || channel.channelId,
    channelId: channel.channelId,
    uploadPlaylistId,
    keywords: channel.keywords || [],
    language: channel.languages?.[0] || null,
    tags: channel.tags || [],
    limit: config.maxItemsPerChannel || 10
  };
}

/**
 * 为关键词生成搜索计划
 */
function createKeywordPlan(keywords, config) {
  const query = keywords
    .map(k => k.includes(' ') ? `"${k}"` : k)
    .join(' OR ');

  return {
    type: 'keyword',
    label: 'Global Keywords',
    query: `(${query}) ${config.queryPrefix || ''}`.trim(),
    language: config.defaultLanguages?.[0] || null,
    tags: [],
    limit: config.maxItemsPerKeyword || 20
  };
}
```

---

### 4. NewsItem (标准输出实体)

YouTube 视频数据最终转换为统一的 NewsItem 结构,与其他数据源保持一致。

#### 核心字段

| 字段 | 类型 | 必填 | 描述 |
|-----|------|-----|------|
| `id` | string | ✅ | 视频 ID(YouTube video ID) |
| `title` | string | ✅ | 视频标题(清洗后,最多 120 字符) |
| `summary` | string | ✅ | 视频摘要(清洗后的描述,最多 400 字符) |
| `url` | string | ✅ | 视频完整 URL |
| `source` | string | ✅ | 数据源名称(固定为 "YouTube") |
| `createdAt` | string | ✅ | 发布时间(ISO 8601 格式) |
| `metadata` | object | ✅ | YouTube 特定元数据(见下表) |

#### metadata 字段(YouTube 专用)

| 字段 | 类型 | 描述 | 示例 |
|-----|------|------|------|
| `channelId` | string | 频道 ID | `"UCxxxxxx"` |
| `channelTitle` | string | 频道名称 | `"OpenAI"` |
| `channelHandle` | string? | 频道 @ 句柄(如配置) | `"@openai"` |
| `videoId` | string | 视频 ID(与 id 字段相同) | `"dQw4w9WgXcQ"` |
| `duration` | string | 视频时长(ISO 8601 格式) | `"PT15M33S"` |
| `viewCount` | number | 观看数 | `1000000` |
| `likeCount` | number | 点赞数 | `50000` |
| `commentCount` | number | 评论数 | `1200` |
| `thumbnailUrl` | string | 缩略图 URL(medium 尺寸) | `"https://..."` |
| `tags` | string[] | 用户配置的标签 | `["AI", "Research"]` |
| `searchType` | string | 采集方式: 'channel' 或 'keyword' | `"channel"` |
| `language` | string? | 视频语言(如可检测) | `"en"` |
| `definition` | string | 画质: 'hd' 或 'sd' | `"hd"` |
| `hasCaption` | boolean | 是否有字幕 | `true` |

---

## Data Flow

### 端到端数据流

```
┌──────────────┐
│  配置文件    │ config/youtube-channels.json
└──────┬───────┘
       │ 加载 & 验证
       ↓
┌──────────────┐
│YouTubeChannel│ 频道配置实体(内存)
└──────┬───────┘
       │ 生成搜索计划
       ↓
┌──────────────┐
│ SearchPlan[] │ 搜索计划列表(内存)
└──────┬───────┘
       │ 执行 API 调用
       ↓
┌──────────────────┐
│YouTube Data API  │ Composio SDK
│ - playlistItems  │ 获取视频 ID 列表
│ - videos (batch) │ 批量获取详情
└──────┬───────────┘
       │ 响应
       ↓
┌──────────────┐
│YouTubeVideo[]│ 原始 API 响应(内存)
└──────┬───────┘
       │ 数据转换 & 清洗
       ↓
┌──────────────┐
│  NewsItem[]  │ 标准化输出
└──────┬───────┘
       │ 验证 & 去重
       ↓
┌──────────────┐
│ 评分 & 报告  │ 现有流程
└──────────────┘
```

### 详细步骤

#### 步骤 1: 配置加载

```javascript
// src/config/datasources.js
function loadYouTubeChannels() {
  const config = configLoader.loadAndValidate(
    'config/youtube-channels.json',
    validateYouTubeChannels,
    { required: false, defaultValue: DEFAULT_CONFIG }
  );

  return {
    channels: config.channels || [],
    keywords: config.keywords || [],
    config: config.config || {}
  };
}
```

#### 步骤 2: 生成搜索计划

```javascript
// src/collectors/youtube.js
createSearchPlans(channels, defaults) {
  const plans = [];

  // 为每个频道生成计划
  channels.forEach(channel => {
    if (channel.enabled !== false) {
      plans.push(createChannelPlan(channel, defaults));
    }
  });

  // 如果没有频道,使用关键词
  if (plans.length === 0 && defaults.keywords.length > 0) {
    plans.push(createKeywordPlan(defaults.keywords, defaults));
  }

  return plans;
}
```

#### 步骤 3: 执行 API 调用(频道采集)

```javascript
async fetchVideosForChannelPlan(plan) {
  const items = [];
  let pageToken = null;

  // 使用播放列表方法(配额 1)
  while (items.length < plan.limit) {
    const response = await composio.tools.execute('YOUTUBE_LIST_PLAYLIST_ITEMS', {
      arguments: {
        playlistId: plan.uploadPlaylistId,
        part: 'snippet,contentDetails',
        maxResults: Math.min(50, plan.limit - items.length),
        pageToken
      }
    });

    const playlistItems = response.data?.items || [];
    if (playlistItems.length === 0) break;

    // 提取视频 ID
    const videoIds = playlistItems
      .map(item => item.contentDetails?.videoId)
      .filter(Boolean);

    // 批量获取完整详情(配额 1)
    const videos = await this.batchGetVideoDetails(videoIds);

    items.push(...videos);

    pageToken = response.meta?.nextPageToken;
    if (!pageToken) break;
  }

  return items;
}
```

#### 步骤 4: 数据转换

```javascript
buildNewsItem(video, context) {
  // 数据清洗
  const rawTitle = video.snippet?.title || '';
  const rawDescription = video.snippet?.description || '';

  const cleanTitle = sanitizeVideoText(rawTitle);
  const cleanDescription = sanitizeVideoText(rawDescription);

  // 字段映射
  return new NewsItem({
    id: video.id,
    title: cleanTitle.length > 120 ? cleanTitle.slice(0, 117) + '...' : cleanTitle,
    summary: cleanDescription.length > 400 ? cleanDescription.slice(0, 400) + '...' : cleanDescription,
    url: `https://www.youtube.com/watch?v=${video.id}`,
    source: 'YouTube',
    createdAt: video.snippet?.publishedAt,
    metadata: {
      channelId: video.snippet?.channelId,
      channelTitle: video.snippet?.channelTitle,
      channelHandle: context.channelHandle,
      videoId: video.id,
      duration: video.contentDetails?.duration,
      viewCount: parseInt(video.statistics?.viewCount || '0', 10),
      likeCount: parseInt(video.statistics?.likeCount || '0', 10),
      commentCount: parseInt(video.statistics?.commentCount || '0', 10),
      thumbnailUrl: video.snippet?.thumbnails?.medium?.url,
      tags: context.tags || [],
      searchType: context.type,
      language: video.snippet?.defaultLanguage,
      definition: video.contentDetails?.definition,
      hasCaption: video.contentDetails?.caption === 'true'
    }
  });
}
```

#### 步骤 5: 验证 & 去重

```javascript
async collect() {
  // ... 采集逻辑 ...

  // 时间窗口过滤
  const { recent, outdated } = partitionByGlobalRecency(collectedItems);
  if (outdated.length > 0) {
    this.logger.info(`YouTube: 过滤 ${outdated.length} 条超过时间窗口的视频`);
  }

  // NewsItem 验证
  const validation = this.validateNewsItems(recent);
  if (validation.invalid.length > 0) {
    this.logger.warn(`YouTube: ${validation.invalid.length} 条数据验证失败,已过滤`);
  }

  return validation.valid;
}
```

---

## Field Mapping Reference

### YouTube API → NewsItem 完整映射表

| NewsItem 字段 | YouTube API 字段 | 转换逻辑 |
|--------------|-----------------|---------|
| `id` | `video.id` | 直接使用 |
| `title` | `video.snippet.title` | sanitize + 截断(120) |
| `summary` | `video.snippet.description` | sanitize + 截断(400) |
| `url` | `video.id` | 构造: `https://www.youtube.com/watch?v=${id}` |
| `source` | - | 固定值: "YouTube" |
| `createdAt` | `video.snippet.publishedAt` | 直接使用(ISO 8601) |
| `metadata.channelId` | `video.snippet.channelId` | 直接使用 |
| `metadata.channelTitle` | `video.snippet.channelTitle` | 直接使用 |
| `metadata.videoId` | `video.id` | 直接使用 |
| `metadata.duration` | `video.contentDetails.duration` | 直接使用(ISO 8601 duration) |
| `metadata.viewCount` | `video.statistics.viewCount` | 字符串 → 数字 |
| `metadata.likeCount` | `video.statistics.likeCount` | 字符串 → 数字 |
| `metadata.commentCount` | `video.statistics.commentCount` | 字符串 → 数字 |
| `metadata.thumbnailUrl` | `video.snippet.thumbnails.medium.url` | 直接使用 |
| `metadata.definition` | `video.contentDetails.definition` | 直接使用 |
| `metadata.hasCaption` | `video.contentDetails.caption` | 'true' → true, 其他 → false |

### 数据清洗规则

| 清洗目标 | 正则表达式 / 逻辑 | 示例 |
|---------|-----------------|------|
| Emoji | `/\p{Extended_Pictographic}+/gu` | 🔥💡 → (移除) |
| URL | `/https?:\/\/[^\s]+/gi` | https://example.com → (移除) |
| 时间戳 | `/\b\d{1,2}:\d{2}(?::\d{2})?\b/g` | 0:00 12:34 → (移除) |
| HTML 实体 | `&quot; → "`, `&amp; → &` | &quot;AI&quot; → "AI" |
| 多余空白 | `/\s+/g` → 单空格 | "AI   ML" → "AI ML" |

---

## Validation Rules

### NewsItem 验证标准

基于 `src/models/news-item.js` 的 `validateNewsItems()` 函数:

| 字段 | 验证规则 | 错误信息 |
|-----|---------|---------|
| `id` | 非空字符串 | "Missing id" |
| `title` | 非空字符串,长度 1-500 | "Missing or invalid title" |
| `summary` | 非空字符串,长度 10-1000 | "Summary too short or too long" |
| `url` | 有效 URL 格式 | "Invalid URL" |
| `source` | 非空字符串 | "Missing source" |
| `createdAt` | 有效 ISO 8601 日期 | "Invalid date format" |
| `metadata` | 对象类型 | "Missing metadata" |

### YouTube 特定验证

```javascript
function validateYouTubeVideo(video) {
  const errors = [];

  // 必填字段检查
  if (!video.id) {
    errors.push('Missing video ID');
  }

  if (!video.snippet?.title || video.snippet.title.length < 1) {
    errors.push('Missing or empty title');
  }

  if (!video.snippet?.publishedAt) {
    errors.push('Missing published date');
  }

  // 时间格式验证
  if (video.snippet?.publishedAt) {
    const date = new Date(video.snippet.publishedAt);
    if (isNaN(date.getTime())) {
      errors.push('Invalid published date format');
    }
  }

  // 数值字段验证
  if (video.statistics) {
    ['viewCount', 'likeCount', 'commentCount'].forEach(field => {
      const value = video.statistics[field];
      if (value && isNaN(parseInt(value, 10))) {
        errors.push(`Invalid ${field}: not a number`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}
```

---

## State Management

### 去重状态

```javascript
class YouTubeCollector extends BaseCollector {
  constructor(config) {
    super(config);
    this.seenVideoIds = new Set();  // 会话级去重
  }

  async collect() {
    this.seenVideoIds.clear();  // 每次 collect 开始时清空

    // ... 采集逻辑 ...

    videos.forEach(video => {
      if (this.seenVideoIds.has(video.id)) {
        return;  // 跳过重复
      }
      this.seenVideoIds.add(video.id);
      // ... 处理视频 ...
    });
  }
}
```

### 配额追踪(可选)

```javascript
class QuotaTracker {
  constructor() {
    this.used = 0;
    this.operations = [];
  }

  track(operation, cost) {
    this.used += cost;
    this.operations.push({ operation, cost, timestamp: Date.now() });
    return this.used;
  }

  getUsage() {
    return {
      total: this.used,
      breakdown: this.operations.reduce((acc, op) => {
        acc[op.operation] = (acc[op.operation] || 0) + op.cost;
        return acc;
      }, {})
    };
  }
}
```

---

## Performance Considerations

### 批量操作优化

| 操作 | 单次处理量 | 配额成本 | 优化策略 |
|-----|----------|---------|---------|
| 获取播放列表视频 | 50 个/页 | 1 | 尽可能使用最大 maxResults(50) |
| 批量获取视频详情 | 50 个/次 | 1 | 将视频 ID 分组,每组 50 个 |
| 关键词搜索 | 50 个/页 | 100 | 合并关键词为单次查询(OR 逻辑) |

### 内存管理

- **seenVideoIds Set**: 预期最大 200 个元素 × 12 字节/ID ≈ 2.4 KB
- **collectedItems 数组**: 预期最大 200 个 NewsItem × 2 KB/item ≈ 400 KB
- **总内存占用**: < 10 MB(包括 Composio SDK 和 Node.js 运行时)

---

## Extension Points

### 未来扩展支持

本数据模型为以下未来功能留有扩展空间:

1. **播放列表采集**: 在 SearchPlan 中添加 `playlistId` 字段
2. **直播流采集**: 在 metadata 中添加 `liveStatus` 和 `scheduledStartTime` 字段
3. **字幕提取**: 在 metadata 中添加 `captions` 数组字段
4. **多语言支持**: 扩展 `language` 字段为数组,支持多语言版本
5. **频道统计**: 在 metadata 中添加 `channelStatistics` 对象

---

**Document Version**: 1.0
**Last Updated**: 2025-11-07
**Dependencies**: research.md (技术决策文档)
