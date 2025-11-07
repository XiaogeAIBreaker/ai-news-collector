# API Contract: YouTubeCollector

**Feature**: YouTube 数据源集成
**Date**: 2025-11-07
**Status**: Contract Defined

## Overview

本文档定义 `YouTubeCollector` 类的公共接口、行为契约和测试规范。YouTubeCollector 继承自 `BaseCollector`,遵循项目统一的采集器接口规范,确保与现有架构无缝集成。

---

## Class Definition

### 类声明

```javascript
/**
 * YouTube 数据源采集器
 * 通过 Composio 平台调用 YouTube Data API v3 获取视频数据
 *
 * @extends BaseCollector
 */
export class YouTubeCollector extends BaseCollector {
  /**
   * 构造函数
   * @param {Object} config - 数据源配置对象(来自 YOUTUBE_CONFIG)
   */
  constructor(config = YOUTUBE_CONFIG)
}
```

### 继承关系

```
BaseCollector (src/collectors/base.js)
  ├── collect()          [抽象方法,必须实现]
  ├── retryWithBackoff() [继承,用于 API 重试]
  └── validateNewsItems()[继承,用于数据验证]
       ↑
       │ 继承
       ↓
YouTubeCollector (src/collectors/youtube.js)
  ├── collect()                  [实现]
  ├── createSearchPlans()        [新增]
  ├── fetchVideosForPlan()       [新增]
  ├── batchGetVideoDetails()     [新增]
  ├── buildNewsItem()            [新增]
  └── executePlaylistRequest()   [新增,私有]
```

---

## Public Methods

### 1. collect()

**签名**:

```javascript
/**
 * 采集 YouTube 视频数据(主入口)
 *
 * @returns {Promise<NewsItem[]>} 符合 NewsItem 结构的视频列表
 * @throws {Error} 仅在无法恢复的错误时抛出(如环境变量缺失)
 */
async collect()
```

**职责**:
1. 读取环境变量验证 Composio 认证配置
2. 加载 YouTube 频道配置和全局参数
3. 生成搜索计划(频道 + 关键词)
4. 并行/串行执行搜索计划
5. 数据去重、时间窗口过滤、NewsItem 验证
6. 返回有效的 NewsItem 数组

**前置条件**:
- 环境变量 `COMPOSIO_API_KEY`, `COMPOSIO_CONNECTION_ID_YOUTUBE`, `COMPOSIO_USER_ID_YOUTUBE` 已配置
- 配置文件 `config/youtube-channels.json` 存在且格式正确(或使用默认配置)

**后置条件**:
- 返回的 NewsItem 数组已通过 `validateNewsItems()` 验证
- 所有 NewsItem 的 `createdAt` 字段在全局时间窗口内
- 数组中无重复的视频 ID

**错误处理**:
- 环境变量缺失: 记录警告日志,返回空数组 `[]`
- 配置文件格式错误: 使用默认配置,记录警告日志
- 单个频道采集失败: 记录错误日志,继续处理其他频道
- 全局 API 配额耗尽: 记录错误日志,停止采集,返回已采集的数据

**示例**:

```javascript
const collector = new YouTubeCollector();
const newsItems = await collector.collect();

// 预期返回
[
  {
    id: 'dQw4w9WgXcQ',
    title: 'Rick Astley - Never Gonna Give You Up',
    summary: 'Rick Astley\'s official music video for "Never Gonna..."',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    source: 'YouTube',
    createdAt: '2009-10-25T06:57:33Z',
    metadata: { ... }
  },
  // ... 更多视频
]
```

**性能契约**:
- 单频道采集: < 30 秒
- 10 个频道采集: < 5 分钟
- 内存占用: < 100 MB

---

### 2. createSearchPlans()

**签名**:

```javascript
/**
 * 构造搜索计划列表
 *
 * @param {Array<YouTubeChannel>} channels - 频道配置列表
 * @param {Object} defaults - 默认参数
 * @param {string[]} defaults.keywords - 全局关键词列表
 * @param {string[]} defaults.defaultLanguages - 默认语言列表
 * @param {number} defaults.maxItemsPerChannel - 每频道最大采集数
 * @param {number} defaults.maxItemsPerKeyword - 每关键词最大采集数
 * @param {string} defaults.queryPrefix - 全局查询前缀(如 "-is:live")
 * @returns {Array<SearchPlan>} 搜索计划数组
 */
createSearchPlans(channels, defaults)
```

**职责**:
1. 为每个启用的频道生成一个 SearchPlan(type='channel')
2. 如果没有频道配置,使用全局关键词生成 SearchPlan(type='keyword')
3. 为每个计划设置合理的 limit(采集数量上限)

**决策逻辑**:
- 频道 `enabled: false` → 跳过
- 频道配置了 `keywords` → 使用搜索方法(而非播放列表)
- 所有频道禁用 且 `keywords` 非空 → 生成关键词计划
- 所有频道禁用 且 `keywords` 为空 → 返回空数组

**示例**:

```javascript
const channels = [
  { channelId: 'UCxxxxxx', displayName: 'OpenAI', enabled: true, tags: ['AI'] }
];
const defaults = {
  keywords: ['AI', 'Machine Learning'],
  maxItemsPerChannel: 10,
  maxItemsPerKeyword: 20
};

const plans = collector.createSearchPlans(channels, defaults);

// 预期输出
[
  {
    type: 'channel',
    label: 'OpenAI',
    channelId: 'UCxxxxxx',
    uploadPlaylistId: 'UUxxxxxx',
    tags: ['AI'],
    limit: 10
  }
]
```

**测试要点**:
- ✅ 启用的频道被包含
- ✅ 禁用的频道被跳过
- ✅ `UC` 正确转换为 `UU`
- ✅ 无频道时使用关键词
- ✅ 无频道且无关键词时返回空数组

---

### 3. fetchVideosForPlan()

**签名**:

```javascript
/**
 * 执行单个搜索计划
 *
 * @param {Object} options - 执行参数
 * @param {SearchPlan} options.plan - 搜索计划
 * @param {Composio} options.collector - Composio SDK 实例
 * @param {string} options.connectionId - Composio 连接 ID
 * @param {string} options.userId - Composio 用户 ID
 * @param {Date} options.cutoffDate - 时间窗口截止日期
 * @param {number} options.recentDays - 最近天数(用于日志)
 * @returns {Promise<NewsItem[]>} 该计划采集的 NewsItem 列表
 * @throws {Error} API 调用失败且重试耗尽时
 */
async fetchVideosForPlan(options)
```

**职责**:
1. 根据计划类型选择采集方法:
   - type='channel': 使用播放列表方法(低配额)
   - type='keyword': 使用搜索方法(高配额,支持关键词)
2. 处理分页逻辑(nextPageToken)
3. 批量获取视频详情
4. 转换为 NewsItem
5. 客户端时间过滤
6. 达到 limit 或无更多结果时停止

**核心逻辑**:

```javascript
async fetchVideosForPlan(options) {
  const { plan, collector, connectionId, userId, cutoffDate, recentDays } = options;
  const items = [];

  if (plan.type === 'channel') {
    // 方法 1: 播放列表(低配额)
    return await this.fetchFromPlaylist(plan, collector, connectionId, userId, cutoffDate);
  } else if (plan.type === 'keyword') {
    // 方法 2: 搜索(高配额,支持关键词)
    return await this.fetchFromSearch(plan, collector, connectionId, userId, cutoffDate);
  }

  return items;
}
```

**分页处理**:

```javascript
let pageToken = null;
while (items.length < plan.limit) {
  const response = await this.retryWithBackoff(() =>
    this.executePlaylistRequest(plan.uploadPlaylistId, pageToken, remainingCapacity)
  );

  const videos = response.data?.items || [];
  if (videos.length === 0) break;

  items.push(...videos);

  pageToken = response.meta?.nextPageToken;
  if (!pageToken) break;
}
```

**错误处理**:
- 配额耗尽: 记录错误,返回已采集的数据
- 播放列表不存在(404): 尝试降级为搜索方法
- 单个视频无效: 跳过,继续处理其他视频

**测试要点**:
- ✅ 正确处理分页(获取多页数据直到 limit)
- ✅ 时间窗口过滤正确
- ✅ 配额耗尽时返回部分数据
- ✅ 播放列表方法失败时降级为搜索

---

### 4. batchGetVideoDetails()

**签名**:

```javascript
/**
 * 批量获取视频详情(优化配额消耗)
 *
 * @param {string[]} videoIds - 视频 ID 列表(最多 500 个)
 * @param {Composio} collector - Composio SDK 实例
 * @param {string} connectionId - Composio 连接 ID
 * @param {string} userId - Composio 用户 ID
 * @returns {Promise<YouTubeVideo[]>} 完整视频详情列表
 */
async batchGetVideoDetails(videoIds, collector, connectionId, userId)
```

**职责**:
1. 将 videoIds 分组,每组最多 50 个(YouTube API 限制)
2. 对每组调用 `YOUTUBE_GET_VIDEO_DETAILS_BATCH`
3. 合并所有组的结果
4. 处理部分视频不可用的情况(私有/删除)

**配额优化**:
- 单个视频详情(`YOUTUBE_VIDEO_DETAILS`): 配额 1
- 批量视频详情(`YOUTUBE_GET_VIDEO_DETAILS_BATCH`): 配额 1(最多 50 个)
- **节省比例**: 获取 50 个视频详情,配额消耗从 50 降低到 1(节省 98%)

**示例**:

```javascript
const videoIds = ['dQw4w9WgXcQ', 'jNQXAC9IVRw', ...]; // 120 个 ID

const videos = await collector.batchGetVideoDetails(videoIds, composio, connId, userId);

// 内部分组: [50, 50, 20]
// API 调用次数: 3 次
// 配额消耗: 3 单位(而非 120)
```

**错误处理**:
- 部分视频不可用: YouTube API 自动跳过,仅返回有效视频
- 对比输入和输出数量,记录差异日志

**测试要点**:
- ✅ 正确分组(50 个/组)
- ✅ 合并所有组的结果
- ✅ 处理部分视频不可用(输出 < 输入)
- ✅ 空输入返回空数组

---

### 5. buildNewsItem()

**签名**:

```javascript
/**
 * 将 YouTube 视频转换为 NewsItem
 *
 * @param {YouTubeVideo} video - YouTube API 视频对象
 * @param {Object} context - 上下文信息
 * @param {string} context.type - 搜索类型('channel' | 'keyword')
 * @param {string} context.channelHandle - 频道 @ 句柄(可选)
 * @param {string[]} context.tags - 用户自定义标签
 * @returns {NewsItem|null} 转换后的 NewsItem,无效则返回 null
 */
buildNewsItem(video, context)
```

**职责**:
1. 数据清洗(标题、描述)
2. 字段映射(YouTube API → NewsItem)
3. 验证必填字段(id, title, publishedAt)
4. 构造视频 URL
5. 填充 metadata

**数据清洗**:

```javascript
function sanitizeVideoText(text = '') {
  return text
    .replace(/\p{Extended_Pictographic}+/gu, '')  // 移除 Emoji
    .replace(/https?:\/\/[^\s]+/gi, '')           // 移除 URL
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, '') // 移除时间戳
    .replace(/&quot;/g, '"')                      // 解码 HTML 实体
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')                         // 合并空白
    .trim();
}
```

**验证逻辑**:

```javascript
// 必填字段检查
if (!video.id || !video.snippet?.title || !video.snippet?.publishedAt) {
  this.logger.debug(`跳过无效视频: ${video.id || 'unknown'}`);
  return null;
}

// 标题长度检查
const cleanTitle = sanitizeVideoText(video.snippet.title);
if (cleanTitle.length < 5) {
  this.logger.debug(`跳过标题过短的视频: ${video.id}`);
  return null;
}
```

**URL 构造**:

```javascript
const url = `https://www.youtube.com/watch?v=${video.id}`;
```

**返回 null 的场景**:
- 缺少 id, title 或 publishedAt
- 标题清洗后长度 < 5 字符
- publishedAt 格式无效

**测试要点**:
- ✅ Emoji 被正确移除
- ✅ URL 被正确移除
- ✅ 标题和描述截断至限制长度
- ✅ metadata 包含所有预期字段
- ✅ 无效视频返回 null

---

## Private Methods

### executePlaylistRequest()

```javascript
/**
 * 执行播放列表 API 请求(私有方法)
 *
 * @private
 * @param {string} playlistId - 播放列表 ID
 * @param {string|null} pageToken - 分页 token
 * @param {number} maxResults - 最大结果数(1-50)
 * @returns {Promise<Object>} Composio API 响应
 */
async executePlaylistRequest(playlistId, pageToken, maxResults)
```

### executeSearchRequest()

```javascript
/**
 * 执行搜索 API 请求(私有方法)
 *
 * @private
 * @param {string} query - 搜索查询字符串
 * @param {Object} options - 搜索选项
 * @returns {Promise<Object>} Composio API 响应
 */
async executeSearchRequest(query, options)
```

---

## Configuration Contract

### 环境变量

| 变量名 | 必填 | 描述 | 示例 |
|--------|-----|------|------|
| `COMPOSIO_API_KEY` | ✅ | Composio API 密钥 | `xxxxxx` |
| `COMPOSIO_CONNECTION_ID_YOUTUBE` | ✅ | YouTube 连接 ID | `ca_GaLGeH5yN4aL` |
| `COMPOSIO_USER_ID_YOUTUBE` | ✅ | Composio 用户 ID | `pg-test-xxxx` |

### 配置文件结构

```json
{
  "channels": [
    {
      "channelId": "string (required)",
      "displayName": "string (optional)",
      "handle": "string (optional)",
      "enabled": "boolean (default: true)",
      "keywords": "string[] (optional)",
      "languages": "string[] (optional)",
      "tags": "string[] (optional)"
    }
  ],
  "keywords": ["string"],
  "config": {
    "maxResultsPerPage": "number (10-50, default: 50)",
    "maxItemsPerChannel": "number (default: 10)",
    "maxItemsPerKeyword": "number (default: 20)",
    "defaultLanguages": "string[] (default: [])",
    "usePlaylistMethod": "boolean (default: true)",
    "queryPrefix": "string (default: '-is:live')"
  }
}
```

---

## Error Handling Contract

### 错误分类

| 错误类型 | HTTP 状态 | 处理策略 | 示例 |
|---------|----------|---------|------|
| 认证错误 | 401/403 | 记录错误,返回空数组 | 无效的 API Key |
| 配额耗尽 | 403 | 停止采集,返回已采集数据 | quotaExceeded |
| 速率限制 | 429 | 重试 3 次(指数退避) | rateLimitExceeded |
| 资源不存在 | 404 | 跳过该资源,继续处理 | 视频已删除 |
| 请求参数错误 | 400 | 记录错误,跳过 | 无效的 channelId |
| 服务器错误 | 500/503 | 重试 3 次 | YouTube 服务不可用 |

### 日志级别

| 场景 | 级别 | 示例消息 |
|-----|------|---------|
| 环境变量缺失 | WARN | `缺少 COMPOSIO_API_KEY,跳过 YouTube 采集` |
| 配置文件加载失败 | WARN | `无法加载 youtube-channels.json,使用默认配置` |
| 单频道采集失败 | ERROR | `频道 "OpenAI" 采集失败: quotaExceeded` |
| 配额耗尽 | ERROR | `YouTube API 配额已耗尽,停止采集` |
| 视频无效被跳过 | DEBUG | `跳过无效视频: dQw4w9WgXcQ (标题为空)` |
| 采集完成 | SUCCESS | `YouTube 采集完成,获取 50 条视频` |

---

## Testing Contract

### 单元测试要求

#### 测试套件结构

```javascript
describe('YouTubeCollector', () => {
  describe('createSearchPlans', () => {
    it('应为启用的频道生成计划')
    it('应跳过禁用的频道')
    it('应正确转换 UC 为 UU')
    it('无频道时应使用关键词')
    it('无频道且无关键词时应返回空数组')
  });

  describe('fetchVideosForPlan', () => {
    it('应正确处理分页')
    it('应在达到 limit 时停止')
    it('应过滤超出时间窗口的视频')
    it('配额耗尽时应返回部分数据')
  });

  describe('batchGetVideoDetails', () => {
    it('应将视频 ID 分组为 50 个/组')
    it('应合并所有组的结果')
    it('应处理部分视频不可用')
  });

  describe('buildNewsItem', () => {
    it('应正确清洗标题和描述')
    it('应正确构造视频 URL')
    it('应填充所有 metadata 字段')
    it('无效视频应返回 null')
    it('标题过短应返回 null')
  });

  describe('collect', () => {
    it('环境变量缺失时应返回空数组')
    it('应正确去重视频 ID')
    it('应过滤超出时间窗口的视频')
    it('应通过 NewsItem 验证')
  });
});
```

### Mock 策略

```javascript
// Mock Composio SDK
const mockComposio = {
  tools: {
    execute: vi.fn((tool, args) => {
      if (tool === 'YOUTUBE_LIST_PLAYLIST_ITEMS') {
        return mockPlaylistResponse;
      }
      if (tool === 'YOUTUBE_GET_VIDEO_DETAILS_BATCH') {
        return mockVideoDetailsResponse;
      }
    })
  }
};

// Mock 环境变量
process.env.COMPOSIO_API_KEY = 'test_key';
process.env.COMPOSIO_CONNECTION_ID_YOUTUBE = 'test_conn';
process.env.COMPOSIO_USER_ID_YOUTUBE = 'test_user';
```

### 集成测试(可选)

```javascript
describe('YouTubeCollector Integration', () => {
  it('应能从真实 API 采集数据(需配置真实凭证)', async () => {
    // 跳过 CI 环境
    if (process.env.CI) {
      test.skip();
    }

    const collector = new YouTubeCollector();
    const items = await collector.collect();

    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      source: 'YouTube'
    });
  });
});
```

---

## Compatibility Contract

### 依赖版本

| 依赖 | 最低版本 | 推荐版本 | 备注 |
|-----|---------|---------|------|
| Node.js | 18.0.0 | 18+ LTS | 需要 ES2022 支持 |
| @composio/core | 0.2.0 | 0.2.3+ | YouTube API 支持 |
| BaseCollector | 1.0.0 | 当前 | 项目内部依赖 |
| NewsItem | 1.0.0 | 当前 | 项目内部依赖 |

### 接口兼容性

YouTubeCollector 遵循 `BaseCollector` 接口契约:

```javascript
interface Collector {
  /**
   * 采集数据入口
   * @returns {Promise<NewsItem[]>}
   */
  collect(): Promise<NewsItem[]>;
}
```

---

## Performance Contract

### 性能指标

| 指标 | 目标值 | 测量方法 |
|-----|--------|---------|
| 单频道采集时间 | < 30 秒 | `Date.now()` 前后差值 |
| 10 频道采集时间 | < 5 分钟 | 同上 |
| 内存占用 | < 100 MB | `process.memoryUsage().heapUsed` |
| API 调用次数(10 频道) | < 15 次 | 计数器统计 |
| 配额消耗(10 频道) | < 50 units | QuotaTracker 统计 |

### 性能测试

```javascript
describe('Performance', () => {
  it('单频道采集应在 30 秒内完成', async () => {
    const start = Date.now();
    const items = await collector.collect();
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(30000);
  });

  it('内存占用应低于 100 MB', async () => {
    const before = process.memoryUsage().heapUsed;
    await collector.collect();
    const after = process.memoryUsage().heapUsed;
    const delta = (after - before) / 1024 / 1024;

    expect(delta).toBeLessThan(100);
  });
});
```

---

## Changelog

| 版本 | 日期 | 变更 |
|-----|------|------|
| 1.0.0 | 2025-11-07 | 初始契约定义 |

---

**Document Version**: 1.0
**Last Updated**: 2025-11-07
**Dependencies**: data-model.md, research.md
