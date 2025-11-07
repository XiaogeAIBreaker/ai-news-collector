# Technical Research: YouTube 数据源集成

**Feature**: YouTube 数据源集成
**Date**: 2025-11-07
**Status**: Research Complete

## Executive Summary

本文档记录了 YouTube 数据源集成的技术调研结果和关键设计决策。通过对 Composio 平台支持的 YouTube Data API 方法的深入分析,我们确定了最优的采集策略:优先使用播放列表方法(playlistItems.list)获取频道视频以节省 API 配额,在需要关键词过滤时才使用搜索方法(search.list)。所有设计决策均参考现有 Twitter 数据源的成熟实践,确保与现有架构一致。

## Research Questions & Decisions

### 1. YouTube Data API 集成方式

**问题**: Composio 平台支持哪些 YouTube API 方法?如何选择最合适的方法获取视频数据?

**调研结果**:

Composio 平台提供了 11 个核心 YouTube API 方法,涵盖搜索、频道、视频、播放列表、字幕等功能:

| Composio 工具 | YouTube API | 配额成本 | 用途 |
|--------------|------------|---------|------|
| `YOUTUBE_SEARCH_YOU_TUBE` | search.list | 100 | 搜索视频/频道(支持关键词和时间过滤) |
| `YOUTUBE_LIST_CHANNEL_VIDEOS` | search.list (channelId) | 100 | 列出频道视频 |
| `YOUTUBE_LIST_PLAYLIST_ITEMS` | playlistItems.list | 1 | 列出播放列表视频(包括上传列表) |
| `YOUTUBE_GET_VIDEO_DETAILS_BATCH` | videos.list | 1 | 批量获取视频详情(最多 50 个) |
| `YOUTUBE_VIDEO_DETAILS` | videos.list | 1 | 获取单个视频详情 |
| `YOUTUBE_GET_CHANNEL_ID_BY_HANDLE` | channels.list | 1 | 通过 @handle 获取频道 ID |
| `YOUTUBE_GET_CHANNEL_STATISTICS` | channels.list | 1 | 获取频道统计信息 |

**关键响应字段**:

YouTube API 通过 `part` 参数控制返回字段,主要包括:

- **snippet**: 标题、描述、缩略图、发布时间、频道信息
- **statistics**: 观看数、点赞数、评论数、分享数
- **contentDetails**: 视频时长、画质、字幕可用性
- **status**: 上传状态、隐私设置、版权声明

**决策**: 使用 `snippet,statistics,contentDetails` 组合满足 90% 的需求。

---

### 2. 频道视频获取策略

**问题**: 如何以最低的 API 配额成本获取频道的最新视频?

**调研发现的两种方法**:

#### 方法 A: 搜索方法(search.list with channelId)

```javascript
const response = await composio.tools.execute('YOUTUBE_LIST_CHANNEL_VIDEOS', {
  arguments: {
    channelId: 'UC...',
    maxResults: 50,
    order: 'date',
    publishedAfter: startTime  // 支持时间过滤
  }
});
```

**优点**:
- 支持关键词过滤
- 支持时间范围过滤(publishedAfter/Before)
- 灵活的排序选项(date, rating, relevance)

**缺点**:
- 配额成本高:每次请求 100 单位
- 结果可能不完整(受 YouTube 搜索索引延迟影响)
- 最多返回约 500 条结果

---

#### 方法 B: 播放列表方法(playlistItems.list with upload playlist)

YouTube 为每个频道自动创建"上传播放列表",ID 规则为:将频道 ID 的 `UC` 前缀替换为 `UU`。

```javascript
// 步骤 1: 转换频道 ID 为上传播放列表 ID
// 例如: UCxxxxxx -> UUxxxxxx
const uploadPlaylistId = channelId.replace(/^UC/, 'UU');

// 步骤 2: 获取播放列表中的视频
const response = await composio.tools.execute('YOUTUBE_LIST_PLAYLIST_ITEMS', {
  arguments: {
    playlistId: uploadPlaylistId,
    part: 'snippet,contentDetails',
    maxResults: 50,
    pageToken: nextPageToken  // 分页支持
  }
});
```

**优点**:
- 配额成本极低:每次请求仅 1 单位(是方法 A 的 1/100)
- 结果完整可靠(官方上传记录)
- 支持获取频道全部历史视频

**缺点**:
- 不支持关键词过滤(需客户端过滤)
- 需要额外逻辑转换频道 ID

---

#### 配额消耗对比

假设每天采集 5 个频道,每个频道 20 个视频:

| 方法 | 获取视频列表 | 批量获取详情 | 总计 | 占每日配额比例 |
|------|------------|------------|------|---------------|
| 方法 A(搜索) | 5 × 100 = 500 | 100÷50 × 1 = 2 | 502 | 5.02% |
| 方法 B(播放列表) | 5 × 1 = 5 | 100÷50 × 1 = 2 | 7 | 0.07% |

**配额节省比例**: 方法 B 仅为方法 A 的 **1.4%**,节省 98.6% 的配额。

---

#### 决策:混合策略

**选择标准**:
- ✅ **优先使用播放列表方法**(默认):节省配额,适用于纯时间窗口过滤
- ✅ **关键词场景使用搜索方法**:当配置了频道级关键词(如 `channel.keywords`)时,使用搜索方法换取精准度
- ✅ **批量获取详情**:对 search.list 返回的 videoId,使用 `YOUTUBE_GET_VIDEO_DETAILS_BATCH` 批量获取完整信息(最多 50 个/次)

**实现逻辑**:

```javascript
/**
 * 智能选择采集方法
 */
async function fetchChannelVideos(channel, options) {
  const { globalKeywords, recentDays } = options;

  // 策略 1: 如果频道配置了关键词 -> 使用搜索(配额换精准)
  if (channel.keywords && channel.keywords.length > 0) {
    return await searchVideosWithKeywords(channel, recentDays);
  }

  // 策略 2: 默认使用播放列表(省配额)
  const uploadPlaylistId = channel.channelId.replace(/^UC/, 'UU');
  const videos = await fetchPlaylistItems(uploadPlaylistId);

  // 客户端时间过滤
  const cutoffDate = new Date(Date.now() - recentDays * 24 * 3600 * 1000);
  return videos.filter(v => new Date(v.snippet.publishedAt) >= cutoffDate);
}
```

**替代方案及拒绝理由**:

| 替代方案 | 拒绝理由 |
|---------|---------|
| 仅使用搜索方法 | 配额消耗过高,每日配额(10,000 units)可能在采集 100 个频道时耗尽 |
| 使用 activities.list | 该 API 返回频道活动(上传、点赞、评论混合),需额外过滤,且不支持时间范围 |
| 先获取 channelId 再搜索 | 增加了 API 调用次数,配额消耗更高 |

---

### 3. 关键词搜索实现

**问题**: 如何实现全局关键词搜索功能(类似 Twitter 的 fallback 搜索)?

**调研结果**:

YouTube 的 `search.list` API 支持强大的查询语法:

```javascript
// 基础语法
q: 'AI'                           // 单个关键词
q: 'AI OR "Machine Learning"'     // 多关键词组合(OR 逻辑)
q: 'AI -advertisement'            // 排除词
q: 'allintitle:GPT'               // 仅搜索标题

// 结合其他过滤器
type: 'video',                    // 仅视频
relevanceLanguage: 'zh',          // 语言偏好
publishedAfter: '2024-01-01T00:00:00Z',  // 时间范围
order: 'date'                     // 按日期排序
```

**决策**:

实现与 Twitter 一致的关键词搜索策略:

1. **关键词组合**: 使用 `OR` 逻辑组合多个关键词
2. **语言过滤**: 优先使用 `relevanceLanguage` 参数,不使用 `lang:` 语法(YouTube 不支持)
3. **时间窗口**: 使用 `publishedAfter` 参数限制时间范围
4. **排除直播**: 添加 `-is:live` 排除正在进行的直播流
5. **结果排序**: 使用 `order: 'date'` 按发布时间倒序,优先采集最新内容

**示例配置**:

```json
{
  "keywords": ["AI", "Machine Learning", "大模型", "AIGC"],
  "config": {
    "maxItemsPerKeyword": 20,
    "defaultLanguages": ["zh", "en"],
    "queryPrefix": "-is:live"  // 全局排除直播
  }
}
```

**实现代码**:

```javascript
function buildKeywordQuery(keywords, options) {
  const { defaultQueryPrefix = '-is:live' } = options;

  // 组合关键词(带空格的关键词用引号包裹)
  const terms = keywords
    .map(k => k.includes(' ') ? `"${k}"` : k)
    .join(' OR ');

  return `(${terms}) ${defaultQueryPrefix}`.trim();
}

// 示例输出:
// '(AI OR "Machine Learning" OR 大模型 OR AIGC) -is:live'
```

**配额优化**:

关键词搜索成本固定为 100 单位/请求,通过以下方式优化:

- 将多个关键词合并为单次查询(使用 OR 逻辑)
- 限制 `maxItemsPerKeyword`,避免过度分页
- 当配额不足时跳过关键词搜索,仅保留频道采集

---

### 4. 数据清洗最佳实践

**问题**: YouTube 视频标题和描述包含哪些常见格式问题?如何清洗?

**调研发现的常见问题**:

1. **Emoji 表情符号**: 如 🔥💡📹(影响文本分析和存储)
2. **时间戳**: 如 "0:00 引言 3:45 重点"(描述中的章节标记)
3. **链接**: 如 "https://..." 或 "bit.ly/..."(推广链接、社交媒体链接)
4. **广告信息**: 如 "本视频由 XX 赞助"、"使用优惠码 ABC"
5. **多余空白**: 连续空格、换行符
6. **HTML 实体**: 如 `&quot;`、`&amp;`(API 有时返回转义字符)

**决策**: 参考 Twitter 的 `sanitizeTweetText` 实现,设计 `sanitizeVideoText` 函数

```javascript
/**
 * 清洗 YouTube 视频文本(标题/描述)
 * @param {string} text 原始文本
 * @returns {string} 清洗后的文本
 */
function sanitizeVideoText(text = '') {
  if (!text) return '';

  // 1. 移除 Emoji
  const withoutEmoji = text.replace(/\p{Extended_Pictographic}+/gu, '');

  // 2. 移除 URL
  const withoutUrls = withoutEmoji.replace(
    /https?:\/\/[^\s]+|www\.[^\s]+/gi,
    ''
  );

  // 3. 移除时间戳格式(如 0:00, 12:34)
  const withoutTimestamps = withoutUrls.replace(
    /\b\d{1,2}:\d{2}(?::\d{2})?\b/g,
    ''
  );

  // 4. 解码 HTML 实体
  const decoded = withoutTimestamps
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");

  // 5. 移除多余空白
  return decoded.replace(/\s+/g, ' ').trim();
}
```

**摘要截取策略**:

参考 Twitter 的实现:
- **标题**: 最多 120 字符,超过则截断并添加 `...`
- **摘要**: 最多 400 字符,优先使用视频描述的前 N 字符(不做智能提取,避免复杂度)

```javascript
function buildNewsItemFromVideo(video) {
  const rawDescription = video.snippet?.description || '';
  const cleanDescription = sanitizeVideoText(rawDescription);

  // 摘要: 截取前 400 字符
  const summary = cleanDescription.length > 400
    ? cleanDescription.slice(0, 400) + '...'
    : cleanDescription;

  // 标题: 截取前 120 字符
  const rawTitle = video.snippet?.title || '';
  const cleanTitle = sanitizeVideoText(rawTitle);
  const title = cleanTitle.length > 120
    ? cleanTitle.slice(0, 117) + '...'
    : cleanTitle;

  return { title, summary };
}
```

**替代方案及拒绝理由**:

| 替代方案 | 拒绝理由 |
|---------|---------|
| 使用 NLP 提取关键句作为摘要 | 增加依赖和复杂度,且对中英文混合文本效果不稳定 |
| 保留所有 Emoji | Emoji 占用存储空间,且在某些输出渠道(如邮件)可能显示异常 |
| 保留链接 | 用户点击摘要中的链接会跳转到外部站点,而非视频页面,体验不佳 |

---

### 5. 错误场景处理

**问题**: YouTube API 有哪些常见错误?如何设计重试策略?

**调研结果**:

#### YouTube API 常见错误码

| HTTP 状态码 | 错误原因 | 描述 | 是否可重试 |
|-----------|---------|------|-----------|
| 400 | `badRequest` | 请求参数错误(如无效的 videoId) | ❌ 否 |
| 403 | `quotaExceeded` | 每日配额耗尽(10,000 units) | ❌ 否 |
| 403 | `forbidden` | 视频私有/地区限制 | ❌ 否 |
| 404 | `videoNotFound` | 视频不存在或已删除 | ❌ 否 |
| 429 | `rateLimitExceeded` | 短时间内请求过多(速率限制) | ✅ 是 |
| 500 | `backendError` | YouTube 服务器错误 | ✅ 是 |
| 503 | `serviceUnavailable` | YouTube 服务暂时不可用 | ✅ 是 |

#### Composio SDK 错误转换

根据项目中 Twitter 集成的经验,Composio SDK 会将 YouTube API 错误包装为标准格式:

```javascript
{
  successful: false,
  error: {
    message: 'quotaExceeded',
    details: { ... }
  },
  response: {
    status: 403,
    data: { ... }
  }
}
```

#### 决策:重试策略(参考 BaseCollector)

```javascript
/**
 * 判断是否应该重试
 */
function shouldRetryYouTubeError(error) {
  const message = error.message?.toLowerCase() || '';
  const status = error.response?.status;

  // 不应重试的场景
  if (status === 403 && message.includes('quota')) {
    return false;  // 配额耗尽,立即失败
  }

  if (status === 403 && message.includes('forbidden')) {
    return false;  // 权限问题,重试无意义
  }

  if (status === 404) {
    return false;  // 资源不存在
  }

  if (status === 400) {
    return false;  // 请求参数错误
  }

  // 应该重试的场景
  if (status === 429) return true;  // 速率限制
  if (status >= 500) return true;   // 服务器错误
  if (message.includes('timeout')) return true;  // 超时
  if (message.includes('network')) return true;  // 网络错误

  return false;  // 默认不重试
}
```

**重试参数**:
- 最大重试次数: 3 次(与 Twitter 一致)
- 初始延迟: 1 秒
- 最大延迟: 30 秒
- 退避策略: 指数退避(1s → 2s → 4s)

#### 配额耗尽处理

**策略**:
1. 记录详细日志,包含当前配额使用情况
2. 立即停止当前数据源的采集,不影响其他数据源
3. 不抛出未捕获异常,返回空数组

```javascript
async function executeSearchWithQuotaCheck(plan) {
  try {
    return await this.retryWithBackoff(() =>
      this.executeSearch(collector, plan)
    );
  } catch (error) {
    if (error.message?.includes('quotaExceeded')) {
      this.logger.error('YouTube API 配额已耗尽,停止采集');
      this.logger.info('配额将在太平洋时间午夜(UTC-8)重置');
      return [];  // 返回空数组,不中断主流程
    }
    throw error;  // 其他错误继续抛出
  }
}
```

#### 部分失败容错

**场景**: 批量获取 50 个视频详情时,部分视频可能已删除或私有

**策略**:
- YouTube API 会跳过无效的 videoId,仅返回有效视频
- 客户端对比请求的 videoId 数量和返回的视频数量,记录差异
- 继续处理返回的有效视频,不视为错误

```javascript
async function batchGetVideoDetails(videoIds) {
  const response = await composio.tools.execute('YOUTUBE_GET_VIDEO_DETAILS_BATCH', {
    arguments: { id: videoIds }
  });

  const videos = response.data?.items || [];

  if (videos.length < videoIds.length) {
    const missing = videoIds.length - videos.length;
    this.logger.debug(`批量获取: ${missing} 个视频不可用(已删除或私有)`);
  }

  return videos;
}
```

---

## Technology Stack Summary

### 核心依赖

| 技术 | 版本 | 用途 |
|-----|------|-----|
| Node.js | 18+ | 运行时 |
| @composio/core | ^0.2.3 | YouTube API 集成 |
| dotenv | ^16.6.1 | 环境变量管理 |
| Vitest | ^4.0.6 | 单元测试框架 |

### 继承的工具类

| 类/模块 | 路径 | 复用功能 |
|--------|------|---------|
| BaseCollector | src/collectors/base.js | 重试、日志、验证 |
| NewsItem | src/models/news-item.js | 数据模型 |
| validateNewsItems | src/models/news-item.js | 数据验证 |
| getRecentDays | src/config/collection-window.js | 全局时间窗口 |
| partitionByGlobalRecency | src/utils/recency.js | 时间过滤 |
| createLogger | src/utils/logger.js | 日志工具 |

---

## Design Principles Applied

### 1. 一致性优先

所有设计决策参考 Twitter 数据源的实现模式:

| 设计模式 | Twitter 实现 | YouTube 实现 |
|---------|-------------|-------------|
| 配置加载 | `loadTwitterAccounts()` | `loadYouTubeChannels()` |
| 数据清洗 | `sanitizeTweetText()` | `sanitizeVideoText()` |
| 搜索计划 | `createSearchPlans()` | `createSearchPlans()` |
| NewsItem 转换 | `buildNewsItem()` | `buildNewsItem()` |
| 错误处理 | `shouldRetryError()` | `shouldRetryYouTubeError()` |

### 2. 配额优先

每个设计决策都考虑 API 配额影响:

| 决策 | 配额节省 |
|-----|---------|
| 使用播放列表方法 | 节省 98.6% 配额(1 vs 100) |
| 批量获取详情 | 节省 98% 调用次数(50 个 → 1 次) |
| 客户端时间过滤 | 避免多次 API 调用测试时间范围 |
| 合并关键词查询 | 减少搜索请求次数 |

### 3. 简单性优先

MVP 阶段避免复杂功能:

| 功能 | 决策 | 理由 |
|-----|------|------|
| 播放列表采集 | 不实现 | 增加复杂度,用户可通过频道订阅实现 |
| 直播流采集 | 不实现 | 直播流数据结构不同,需单独处理逻辑 |
| 字幕提取 | 不实现 | 配额成本极高(200 units/次),MVP 不需要 |
| 智能摘要生成 | 不实现 | 增加 LLM 调用成本,简单截取足够 |
| 视频分类打标签 | 不实现 | 交由现有的评分流程处理 |

---

## Risk Assessment

### 高风险

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| API 配额耗尽 | 采集中断,无法获取新数据 | 优先使用低成本方法,实现配额监控,降级处理 |
| Composio 服务不稳定 | 采集失败 | 实现重试机制,不影响其他数据源 |

### 中风险

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 频道上传播放列表 ID 规则变更 | 播放列表方法失败 | 降级为搜索方法,记录警告日志 |
| YouTube API 响应格式变更 | 数据解析失败 | 实现字段存在性检查,默认值回退 |

### 低风险

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 视频私有/删除 | 部分数据缺失 | 批量获取时自动跳过,记录调试日志 |
| 地区限制 | 无法访问特定视频 | 同上,不视为错误 |

---

## Open Questions

以下问题在实施阶段需要验证:

1. **Composio SDK 版本兼容性**: 确认 @composio/core ^0.2.3 是否支持所有调研的 YouTube API 方法,或是否需要升级到更新版本

2. **批量详情接口限制**: 验证 `YOUTUBE_GET_VIDEO_DETAILS_BATCH` 是否真的支持一次获取 50 个视频,或实际限制更低

3. **播放列表 ID 转换可靠性**: 测试 `UC -> UU` 转换规则是否适用于所有类型的频道(个人频道、品牌频道、官方频道)

4. **时间过滤精度**: 确认客户端时间过滤是否与 API 的 `publishedAfter` 参数行为一致,避免遗漏边界数据

5. **配额重置时间**: 确认配额重置时间是否为太平洋时间午夜(UTC-8),或跟随用户账号时区

---

## Next Steps

研究阶段已完成,下一步进入 Phase 1: 设计阶段

1. ✅ **research.md** 已完成
2. ⏭️ **data-model.md**: 定义 YouTube 数据源的核心实体和字段映射规则
3. ⏭️ **contracts/**: 定义 YouTubeCollector 的公共接口和行为契约
4. ⏭️ **quickstart.md**: 提供 YouTube 数据源的配置和使用指南
5. ⏭️ **Agent context update**: 更新 AI agent 上下文文件

---

**Document Version**: 1.0
**Last Updated**: 2025-11-07
**Author**: AI Assistant (Claude Code)
