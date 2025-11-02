# 数据模型设计

**Feature**: AI 新闻采集器
**Date**: 2025-11-01
**Source**: spec.md

## 概述

本文档定义了 AI 新闻采集器系统中的核心数据结构和验证规则。所有数据模型均基于功能需求(FR-001 到 FR-014)设计。

---

## 核心实体

### 1. NewsItem (新闻条目)

**用途**: 表示从数据源采集的单条新闻内容

**字段定义**:

| 字段名 | 类型 | 必填 | 描述 | 验证规则 |
|--------|------|------|------|----------|
| `id` | String | 是 | 唯一标识符 | UUID v4 格式 |
| `title` | String | 是 | 新闻标题 | 长度 1-500 字符 |
| `summary` | String | 是 | 新闻摘要 | 长度 10-2000 字符 |
| `url` | String | 是 | 新闻原文链接 | 有效的 HTTP/HTTPS URL |
| `source` | String | 是 | 数据源名称 | 枚举值: "AIBase", "Twitter", "Feishu", "WeChat", "Zhishi" |
| `createdAt` | Date | 是 | 新闻发布时间 | ISO 8601 格式 |
| `fetchedAt` | Date | 是 | 采集时间 | ISO 8601 格式 |
| `content` | String | 否 | 完整内容(可选) | 长度 0-50000 字符 |
| `metadata` | Object | 否 | 附加元数据 | 键值对对象 |

**结构示例**:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "OpenAI 发布 GPT-5 模型",
  "summary": "OpenAI 今天宣布推出最新的 GPT-5 大语言模型,在推理能力、多模态理解等方面实现了显著提升。新模型支持更长的上下文窗口,并改进了数学和代码生成能力。",
  "url": "https://www.aibase.com/zh/news/12345",
  "source": "AIBase",
  "createdAt": "2025-11-01T10:30:00Z",
  "fetchedAt": "2025-11-01T11:00:00Z",
  "content": "完整新闻内容...",
  "metadata": {
    "author": "AI News Team",
    "hashtags": [
      { "id": "15555541155522", "name": "AI风向标" }
    ]
  }
}
```

**状态转换**:
- 新闻条目是不可变的(immutable),一旦创建不会被修改
- 采集 → 去重 → 过滤 → 输出(单向流转)

---

### 2. FilterConfig (过滤配置)

**用途**: 定义 LLM 过滤所需的用户偏好样例

**字段定义**:

| 字段名 | 类型 | 必填 | 描述 | 验证规则 |
|--------|------|------|------|----------|
| `positiveExamples` | Array<Example> | 是 | 正面样例列表 | 至少包含 1 个样例 |
| `negativeExamples` | Array<Example> | 是 | 反面样例列表 | 至少包含 1 个样例 |
| `keywords` | Array<String> | 否 | 关键词初筛列表 | 每个关键词长度 1-50 字符 |
| `scoreThreshold` | Number | 否 | 评分阈值(已弃用,使用动态阈值) | 范围 0-10 |

**Example 子结构**:

| 字段名 | 类型 | 必填 | 描述 | 验证规则 |
|--------|------|------|------|----------|
| `title` | String | 是 | 样例标题 | 长度 1-200 字符 |
| `summary` | String | 是 | 样例摘要 | 长度 100-200 字符 |
| `reason` | String | 否 | 选择理由 | 长度 0-500 字符 |

**结构示例**:

```json
{
  "positiveExamples": [
    {
      "title": "OpenAI 发布 GPT-5,性能大幅提升",
      "summary": "OpenAI 最新发布的 GPT-5 模型在多项基准测试中超越前代,特别是在数学推理和代码生成方面表现突出。新模型支持 128K 上下文窗口,并改进了多模态能力。",
      "reason": "关注主流 AI 公司的重大产品发布"
    }
  ],
  "negativeExamples": [
    {
      "title": "某小公司发布 AI 聊天机器人",
      "summary": "某不知名创业公司今天宣布推出一款基于 GPT-3 的聊天机器人产品,功能与市面上现有产品类似,未见明显创新。",
      "reason": "过滤无创新性的跟风产品"
    }
  ],
  "keywords": ["AI", "人工智能", "机器学习", "深度学习", "大模型", "LLM", "GPT", "Claude"]
}
```

**验证规则**:
- 正面样例和反面样例均不能为空(FR-014)
- 每个样例的摘要必须在 100-200 字符范围内(FR-003)
- 样例总数建议控制在 3-10 个,以平衡质量和成本

---

### 3. FilterResult (过滤结果)

**用途**: 表示 LLM 对单条新闻的评估结果

**字段定义**:

| 字段名 | 类型 | 必填 | 描述 | 验证规则 |
|--------|------|------|------|----------|
| `newsId` | String | 是 | 关联的新闻 ID | UUID v4 格式 |
| `score` | Number | 是 | LLM 评分 | 范围 0-10,保留 1 位小数 |
| `isPassed` | Boolean | 是 | 是否通过过滤 | true/false |
| `reason` | String | 是 | 评分理由 | 长度 10-500 字符 |
| `evaluatedAt` | Date | 是 | 评估时间 | ISO 8601 格式 |
| `llmProvider` | String | 否 | LLM 提供商 | 如 "anthropic", "openai" |
| `llmModel` | String | 否 | LLM 模型名称 | 如 "claude-3-5-sonnet-20241022" |
| `tokenUsage` | Object | 否 | Token 使用统计 | 见下方子结构 |

**TokenUsage 子结构**:

| 字段名 | 类型 | 描述 |
|--------|------|------|
| `inputTokens` | Number | 输入 token 数 |
| `outputTokens` | Number | 输出 token 数 |
| `cacheHitTokens` | Number | 缓存命中的 token 数 |

**结构示例**:

```json
{
  "newsId": "550e8400-e29b-41d4-a716-446655440000",
  "score": 8.5,
  "isPassed": true,
  "reason": "该新闻报道了 OpenAI 的重大产品发布,符合用户对主流 AI 公司技术进展的关注偏好。内容具有技术深度和行业影响力。",
  "evaluatedAt": "2025-11-01T11:05:00Z",
  "llmProvider": "anthropic",
  "llmModel": "claude-3-5-sonnet-20241022",
  "tokenUsage": {
    "inputTokens": 1250,
    "outputTokens": 85,
    "cacheHitTokens": 950
  }
}
```

**业务逻辑**:
- `isPassed` 由动态阈值算法决定(保留得分最高的 10-30%),而非固定阈值(FR-008)
- `reason` 必须包含具体的评分依据,便于用户理解过滤逻辑
- `tokenUsage` 用于成本监控和优化

---

### 4. DataSource (数据源配置)

**用途**: 定义硬编码的数据源信息

**字段定义**:

| 字段名 | 类型 | 必填 | 描述 | 验证规则 |
|--------|------|------|------|----------|
| `name` | String | 是 | 数据源名称 | 枚举值(见下方) |
| `type` | String | 是 | 数据源类型 | "web", "api", "sdk" |
| `config` | Object | 是 | 数据源特定配置 | 见下方说明 |
| `enabled` | Boolean | 是 | 是否启用 | true/false |
| `maxItems` | Number | 是 | 最大采集条目数 | 固定为 10(FR-005) |
| `timeout` | Number | 是 | 超时时间(秒) | 默认 30 秒 |

**支持的数据源枚举**:
- `AIBase`: 网页抓取
- `Twitter`: API/SDK 集成
- `Feishu`: API/SDK 集成
- `WeChat`: API/SDK 集成
- `Zhishi`: API/SDK 集成(知识星球)

**结构示例**:

```json
{
  "name": "AIBase",
  "type": "web",
  "config": {
    "url": "https://www.aibase.com/zh/news",
    "selectors": {
      "item": ".news-item",
      "title": ".title",
      "summary": ".summary",
      "link": "a"
    }
  },
  "enabled": true,
  "maxItems": 10,
  "timeout": 30
}
```

```json
{
  "name": "Twitter",
  "type": "api",
  "config": {
    "query": "AI news -filter:retweets lang:en OR lang:zh",
    "resultType": "recent",
    "composioToolkit": "twitter"
  },
  "enabled": true,
  "maxItems": 10,
  "timeout": 30
}
```

---

### 5. ExecutionLog (执行日志)

**用途**: 记录单次采集和过滤流程的执行信息

**字段定义**:

| 字段名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `executionId` | String | 是 | 执行 ID |
| `startTime` | Date | 是 | 开始时间 |
| `endTime` | Date | 是 | 结束时间 |
| `totalNews` | Number | 是 | 采集的新闻总数 |
| `afterDedup` | Number | 是 | 去重后数量 |
| `afterFilter` | Number | 是 | 过滤后数量 |
| `sourceStats` | Array<SourceStat> | 是 | 各数据源统计 |
| `errors` | Array<ErrorLog> | 否 | 错误日志 |
| `performance` | Object | 是 | 性能指标 |

**SourceStat 子结构**:

| 字段名 | 类型 | 描述 |
|--------|------|------|
| `source` | String | 数据源名称 |
| `fetched` | Number | 采集成功数量 |
| `failed` | Number | 采集失败数量 |
| `duration` | Number | 采集耗时(毫秒) |

**ErrorLog 子结构**:

| 字段名 | 类型 | 描述 |
|--------|------|------|
| `source` | String | 错误来源 |
| `message` | String | 错误信息 |
| `timestamp` | Date | 错误时间 |
| `stack` | String | 堆栈信息(可选) |

**结构示例**:

```json
{
  "executionId": "exec-2025-11-01-001",
  "startTime": "2025-11-01T11:00:00Z",
  "endTime": "2025-11-01T11:03:45Z",
  "totalNews": 48,
  "afterDedup": 42,
  "afterFilter": 12,
  "sourceStats": [
    {
      "source": "AIBase",
      "fetched": 10,
      "failed": 0,
      "duration": 3200
    },
    {
      "source": "Twitter",
      "fetched": 10,
      "failed": 0,
      "duration": 5500
    },
    {
      "source": "Feishu",
      "fetched": 8,
      "failed": 2,
      "duration": 12000
    }
  ],
  "errors": [
    {
      "source": "Feishu",
      "message": "API rate limit exceeded",
      "timestamp": "2025-11-01T11:01:30Z"
    }
  ],
  "performance": {
    "collectionDuration": 25000,
    "deduplicationDuration": 500,
    "filterDuration": 120000,
    "totalDuration": 145500
  }
}
```

---

## 数据流转

```
1. 数据采集阶段
   DataSource (配置) → Collector → NewsItem[]

2. 去重阶段
   NewsItem[] → Deduplicator → NewsItem[] (unique)

3. 关键词初筛阶段
   NewsItem[] → KeywordFilter → NewsItem[] (filtered)

4. LLM 评分阶段
   NewsItem[] + FilterConfig → LLM Client → FilterResult[]

5. 动态阈值过滤阶段
   FilterResult[] → ThresholdFilter → FilterResult[] (top 10-30%)

6. 输出阶段
   NewsItem[] + FilterResult[] → MarkdownGenerator → output/filtered-news-YYYYMMDD-HHmmss.md
```

---

## 验证规则总结

### 启动时验证(FR-014)
- ✅ FilterConfig 必须至少包含 1 个正面样例和 1 个反面样例
- ✅ 每个样例的摘要长度必须在 100-200 字符范围内

### 采集时验证(FR-005, FR-011)
- ✅ 每个数据源最多采集 10 条新闻
- ✅ 必填字段(title, url, createdAt)缺失则丢弃该条新闻
- ✅ 单个数据源失败不影响其他数据源

### 过滤时验证(FR-008)
- ✅ 使用动态阈值,保留得分最高的 10-30% 新闻
- ✅ LLM 评分失败的新闻被跳过,记录到错误日志

### 输出时验证(FR-009)
- ✅ 输出的 Markdown 必须包含标题、摘要、来源、URL 和评分理由
- ✅ 按照评分从高到低排序

---

## 配置文件格式

### config/filter-rules.json

```json
{
  "version": "1.0",
  "lastUpdated": "2025-11-01T10:00:00Z",
  "positiveExamples": [
    {
      "title": "OpenAI 发布 GPT-5,性能大幅提升",
      "summary": "OpenAI 最新发布的 GPT-5 模型在多项基准测试中超越前代,特别是在数学推理和代码生成方面表现突出。",
      "reason": "主流 AI 公司重大发布"
    }
  ],
  "negativeExamples": [
    {
      "title": "某创业公司推出 AI 聊天机器人",
      "summary": "某不知名创业公司今天宣布推出一款基于 GPT-3 的聊天机器人产品,功能与市面上现有产品类似。",
      "reason": "无创新性的跟风产品"
    }
  ],
  "keywords": ["AI", "人工智能", "机器学习", "深度学习", "大模型", "LLM", "GPT", "Claude"],
  "thresholdConfig": {
    "minPercentage": 10,
    "maxPercentage": 30,
    "preferredCount": 15
  }
}
```

---

## 错误处理

### 数据验证错误
- **触发条件**: 数据不符合字段验证规则
- **处理方式**: 丢弃该条数据,记录到错误日志,继续处理其他数据

### 采集失败
- **触发条件**: 网络错误、超时、API 失败
- **处理方式**:
  - 重试最多 3 次(指数退避策略)
  - 仍失败则跳过该数据源
  - 记录详细错误日志
  - 继续处理其他数据源

### LLM 评分失败
- **触发条件**: LLM API 调用失败或超时
- **处理方式**:
  - 跳过该条新闻的评分
  - 记录到错误日志(包含新闻 ID 和错误原因)
  - 继续处理其他新闻

### 配置文件错误
- **触发条件**: 配置文件不存在、格式错误、样例为空
- **处理方式**:
  - 输出清晰的错误提示
  - 退出程序(FR-012, FR-014)

---

## 性能考虑

### 内存管理
- NewsItem 数组最大长度: 50 条(5 个数据源 × 10 条)
- FilterResult 数组最大长度: 50 条
- 去重数据结构内存占用: < 10MB

### 并发处理
- 数据源采集: 并行执行(Promise.allSettled)
- LLM 评分: 批量处理,每批 10 条,控制并发数
- 去重: 单线程顺序处理(性能已足够快)

### 缓存策略
- URL 去重缓存: Set 数据结构,O(1) 查询
- LLM Prompt Caching: 用户样例缓存,节省成本
- HTTP 请求缓存: 不实现(确保获取最新数据)

---

## 扩展性设计

### 新增数据源
1. 在 `src/collectors/` 创建新的采集器文件
2. 实现统一的 `Collector` 接口
3. 返回标准化的 `NewsItem` 数组
4. 在 `src/config/datasources.js` 注册新数据源

### 新增过滤器
1. 在 `src/filters/` 创建新的过滤器文件
2. 实现统一的 `filter(newsItems)` 接口
3. 在主流程中插入过滤器链

### 新增输出格式
1. 在 `src/output/` 创建新的生成器文件
2. 实现 `generate(newsItems, filterResults)` 接口
3. 通过配置文件或命令行参数选择输出格式

---

## 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 1.0 | 2025-11-01 | 初始版本 |
