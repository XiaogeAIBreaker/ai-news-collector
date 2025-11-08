# 如何配置要关注的 YouTube 频道

配置文件在 [config/youtube-channels.json](/config/youtube-channels.json)，已贴心的为你配置了最简可用配置

## 配置格式

```json
{
  "channels": [
    {
      "channelId": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
      "displayName": "Google for Developers",
      "handle": "@GoogleDevelopers",
      "enabled": true,
      "keywords": ["AI", "Machine Learning"],
      "languages": ["en"],
      "tags": ["Tech", "Developer"],
      "maxItemsPerChannel": 20
    }
  ],
  "keywords": ["AI", "Machine Learning", "大模型"],
  "config": {
    "recentDays": 7,
    "maxResultsPerKeyword": 15,
    "maxResultsPerPage": 50,
    "defaultLanguages": ["zh", "en"],
    "queryPrefix": "-is:live"
  }
}
```

## 字段说明

### 频道配置 (channels)

| 字段 | 必需 | 说明 |
|------|------|------|
| `channelId` | ✅ 是 | YouTube 频道 ID,必须以 `UC` 开头,长度 24 字符 |
| `displayName` | ❌ 否 | 频道显示名称,用于日志和报告输出,长度 1-100 字符 |
| `handle` | ❌ 否 | 频道 @ 句柄,必须以 `@` 开头,长度 2-30 字符 |
| `enabled` | ❌ 否 | 是否启用该频道,默认 `true` |
| `keywords` | ❌ 否 | 频道级关键词过滤,仅采集包含这些关键词的视频 |
| `languages` | ❌ 否 | 语言偏好,ISO 639-1 代码(如 `zh`, `en`) |
| `tags` | ❌ 否 | 自定义标签,会传递到 NewsItem.metadata.tags,最多 10 个 |
| `maxItemsPerChannel` | ❌ 否 | 该频道最多采集视频数,1-100 之间 |

### 全局关键词配置 (keywords)

| 字段 | 必需 | 说明 |
|------|------|------|
| `keywords` | ❌ 否 | 全局关键词列表,**多个关键词会合并为 OR 查询**,无频道配置时使用 |

**关键词合并示例**:
- 配置: `["AI", "Machine Learning", "大模型"]`
- 实际查询: `(AI OR "Machine Learning" OR 大模型) -is:live`

### 全局配置 (config)

| 字段 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `defaultMaxItemsPerChannel` | ❌ 否 | 20 | 每个频道默认最多采集视频数,1-100 之间 |
| `maxResultsPerKeyword` | ❌ 否 | 15 | 关键词搜索最多返回结果数,1-50 之间 |
| `maxResultsPerPage` | ❌ 否 | 50 | 单次 API 请求最大结果数,1-50 之间 |
| `maxItemsPerChannel` | ❌ 否 | - | 全局频道采集上限,优先级**高于**频道级配置 |
| `defaultLanguages` | ❌ 否 | `["en"]` | 默认语言列表,关键词搜索时使用第一个作为主语言 |
| `queryPrefix` | ❌ 否 | `"-is:live"` | 搜索查询前缀,用于过滤条件(默认排除直播) |
| `enableKeywordSearch` | ❌ 否 | `true` | 是否启用关键词搜索 |
| `batchSize` | ❌ 否 | 50 | 批量获取视频详情的批次大小,1-50 之间 |
| `enableStatistics` | ❌ 否 | `true` | 是否获取视频统计信息(观看/点赞/评论数) |

## 如何获取 YouTube 频道 ID
![](https://cdn.ziliu.online/images/2025/11/d88540da-6d49-4f46-8b93-adc6a4d38dff.jpg)


## 配置示例

### 示例 1: 仅配置频道订阅

```json
{
  "channels": [
    {
      "channelId": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
      "displayName": "Google for Developers",
      "handle": "@GoogleDevelopers",
      "enabled": true
    },
    {
      "channelId": "UCBJycsmduvYEL83R_U4JriQ",
      "displayName": "Anthropic",
      "handle": "@AnthropicAI",
      "tags": ["AI", "Research"],
      "maxItemsPerChannel": 10
    },
    {
      "channelId": "UCXZCJLdBC09xxGZ6gcdrc6A",
      "displayName": "DeepSeek AI",
      "handle": "@deepseek_ai",
      "languages": ["zh", "en"]
    }
  ],
  "keywords": [],
  "config": {
    "recentDays": 7,
    "maxResultsPerPage": 50,
    "defaultLanguages": ["en"]
  }
}
```

### 示例 2: 仅配置关键词搜索

```json
{
  "channels": [],
  "keywords": [
    "AI",
    "Machine Learning",
    "大模型",
    "Claude",
    "ChatGPT"
  ],
  "config": {
    "recentDays": 3,
    "maxResultsPerKeyword": 20,
    "maxResultsPerPage": 50,
    "defaultLanguages": ["en", "zh"],
    "queryPrefix": "-is:live"
  }
}
```

### 示例 3: 混合配置 (频道 + 关键词)

```json
{
  "channels": [
    {
      "channelId": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
      "displayName": "Google for Developers",
      "keywords": ["Gemini", "AI"],
      "enabled": true
    }
  ],
  "keywords": ["OpenAI", "Anthropic"],
  "config": {
    "recentDays": 7,
    "maxResultsPerKeyword": 10,
    "maxItemsPerChannel": 15,
    "queryPrefix": "-is:live"
  }
}
```

## 配置优先级

### maxItemsPerChannel 优先级 (从高到低):
1. `config.maxItemsPerChannel` (全局强制上限)
2. `channels[].maxItemsPerChannel` (频道级配置)
3. `config.defaultMaxItemsPerChannel` (默认值)

### 示例说明:
```json
{
  "channels": [
    {
      "channelId": "UCxxxxxx",
      "maxItemsPerChannel": 50  // ← 频道级配置
    }
  ],
  "config": {
    "maxItemsPerChannel": 10,           // ← 全局强制上限 (最高优先级)
    "defaultMaxItemsPerChannel": 20     // ← 默认值
  }
}
```
实际采集数量: **10** (受全局上限限制)

## 常见问题

### 1. 如何只采集中文视频?

在频道配置中添加 `languages` 字段:
```json
{
  "channelId": "UCxxxxxx",
  "displayName": "示例频道",
  "languages": ["zh"]
}
```

### 2. 如何排除直播视频?

使用默认的 `queryPrefix` 配置:
```json
{
  "config": {
    "queryPrefix": "-is:live"
  }
}
```

### 3. 如何提高采集效率?

调整批次大小和分页参数:
```json
{
  "config": {
    "batchSize": 50,           // 批量获取视频详情的批次大小
    "maxResultsPerPage": 50    // 单次 API 请求最大结果数
  }
}
```

### 4. 关键词搜索如何工作?

多个关键词会合并为 **OR 查询**,只调用一次 API:
- 配置: `["AI", "Machine Learning"]`
- 实际查询: `(AI OR "Machine Learning") -is:live`
- 好处: 节省 YouTube API 配额

### 5. 如何禁用某个频道但保留配置?

设置 `enabled` 为 `false`:
```json
{
  "channelId": "UCxxxxxx",
  "displayName": "暂时禁用的频道",
  "enabled": false
}
```
