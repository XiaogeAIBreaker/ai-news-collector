# Implementation Plan: YouTube 数据源集成

**Branch**: `002-youtube-data-source` | **Date**: 2025-11-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-youtube-data-source/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

本功能实现 YouTube 数据源的集成,参考 Twitter 数据源的实现模式,通过 Composio 平台调用 YouTube Data API v3 获取视频数据。核心采集逻辑包括:按频道订阅采集、关键词搜索、数据清洗与标准化、去重与时间窗口过滤。采集结果将转换为统一的 NewsItem 格式,集成到现有的评分与报告流程中。

技术方案:
- 继承 BaseCollector 基类,复用重试、日志、验证等通用能力
- 使用 @composio/core SDK 调用 YouTube API
- 复用全局时间窗口配置(recentDays)和去重工具(partitionByGlobalRecency)
- 配置文件格式参考 twitter-accounts.json,支持频道列表、关键词列表和自定义参数
- 实现 YouTubeCollector 类,提供 collect() 方法返回 NewsItem[]

## Technical Context

**Language/Version**: JavaScript (Node.js 18+)
**Primary Dependencies**:
- @composio/core ^0.2.3 (YouTube API 集成)
- dotenv ^16.6.1 (环境变量管理)
- BaseCollector (src/collectors/base.js - 重试与验证)
- NewsItem (src/models/news-item.js - 数据模型)

**Storage**:
- 配置文件: JSON 格式 (config/youtube-channels.json)
- 环境变量: .env 文件 (COMPOSIO_CONNECTION_ID_YOUTUBE, COMPOSIO_USER_ID_YOUTUBE)
- 无持久化数据库需求

**Testing**:
- Vitest (与现有测试框架一致)
- 单元测试: 数据清洗、去重、NewsItem 转换逻辑
- 集成测试: API 调用、配置加载、错误处理

**Target Platform**:
- Linux/macOS server (Node.js 运行时)
- 定时任务触发 (cron/GitHub Actions)

**Project Type**: 单一项目 (single) - 现有 src/ 目录结构

**Performance Goals**:
- 单次采集完成时间 < 2 分钟 (单频道)
- 10 个频道完整采集 < 5 分钟
- 支持至少 50 条视频的并行处理
- API 调用速率限制处理:遵循 YouTube API 配额管理

**Constraints**:
- YouTube Data API v3 配额限制:默认每日 10,000 units
- 视频搜索(search.list):cost 100 units/请求
- 频道视频列表(search.list with channelId):cost 100 units/请求
- 单次请求最多返回 50 条结果,需分页获取
- 时间窗口受全局 recentDays 配置控制,但 YouTube API 对时间范围无硬性限制(与 Twitter 不同)

**Scale/Scope**:
- 预期配置 5-10 个频道
- 每个频道每日产出 0-5 个视频
- 总采集量级:每次运行 20-50 条视频
- 内存占用 < 512MB

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. 数据源统一性 ✅

- **环境变量管理**: `COMPOSIO_CONNECTION_ID_YOUTUBE` 和 `COMPOSIO_USER_ID_YOUTUBE` 将在 `.env` 文件中集中管理,与现有 Twitter 配置一致
- **配置文件统一**: 频道配置将存储在 `config/youtube-channels.json`,采用与 `config/twitter-accounts.json` 相同的结构模式
- **数据源配置**: 在 `src/config/datasources.js` 中添加 `YOUTUBE_CONFIG`,复用现有的 `loadYouTubeChannels()` 配置加载器
- **无硬编码**: 所有 API 端点、查询参数、默认值均通过配置文件或环境变量管理

**合规性**: ✅ 完全符合 - 复用现有配置管理模式,不引入新的配置源

### II. 模块化与可扩展性 ✅

- **统一接口**: `YouTubeCollector` 继承 `BaseCollector`,实现 `collect()` 方法
- **标准化输出**: 返回 `NewsItem[]` 数组,与其他采集器(Twitter, WeChat-MP, ZSXQ)保持一致
- **独立性**: 新增 YouTube 采集器不修改现有采集器代码,仅在 `src/config/datasources.js` 中注册新数据源
- **可测试性**: 采集器逻辑独立,支持 mock Composio SDK 进行单元测试

**合规性**: ✅ 完全符合 - 遵循现有采集器架构模式

### III. 错误处理与容错性 ✅

- **隔离失败**: YouTube 采集失败不影响其他数据源(Twitter, WeChat-MP 等),主流程 `src/index.js` 已实现数据源独立采集
- **重试机制**: 继承 `BaseCollector.retryWithBackoff()`,默认 3 次重试,指数退避(1s → 2s → 4s)
- **超时控制**: 所有 Composio API 调用继承 BaseCollector 的超时配置(30秒)
- **错误日志**: 使用 `createLogger('YouTube')` 记录详细的错误信息和调试日志

**合规性**: ✅ 完全符合 - 复用现有错误处理框架

### IV. 成本控制与性能优化 ✅

- **API 配额管理**:
  - 通过 `maxItemsPerChannel` 限制单频道采集量,避免过度消耗配额
  - 使用全局 `recentDays` 配置减少时间范围,降低 API 调用次数
  - 支持分页时的智能停止(达到限额或无更多结果时中断)

- **并行采集**:
  - 多频道采集按顺序执行(YouTube API 配额敏感,避免并发导致速率限制)
  - 单频道内的数据处理可并行(视频元数据解析、NewsItem 转换)

- **去重缓存**:
  - 使用 `seenVideoIds` Set 在采集过程中去重
  - 复用 `partitionByGlobalRecency()` 根据时间窗口过滤

- **执行时间**:
  - 单频道预计 20-30 秒(包含 API 调用和数据处理)
  - 10 频道预计 3-5 分钟,符合 5 分钟约束

**合规性**: ✅ 完全符合 - 成本和性能目标已纳入设计

### V. 数据质量保证 ✅

- **必填字段验证**:
  - 视频 ID(id)、标题(title)、发布时间(publishedAt)为必填
  - 缺失任一字段的视频将被丢弃,记录警告日志

- **数据清洗**:
  - 移除标题和描述中的 Emoji(复用 Twitter 的 `sanitizeText` 逻辑)
  - 控制摘要长度(400 字符),标题长度(120 字符)

- **NewsItem 验证**:
  - 复用 `validateNewsItems()` 确保数据结构完整性
  - 验证通过率预期 > 95%

- **原始数据保留**:
  - 在 `metadata` 字段中保存频道信息、播放量、点赞数等原始指标
  - 支持后续审计和分析

**合规性**: ✅ 完全符合 - 复用现有验证机制,确保数据质量

### 总结

**所有宪章检查项均通过** ✅

- 无需填写"Complexity Tracking"表格,因为没有违规项
- 设计完全遵循现有架构模式,复用 Twitter 数据源的成熟实践
- 不引入新的技术栈或架构复杂度

## Project Structure

### Documentation (this feature)

```text
specs/002-youtube-data-source/
├── plan.md              # 本文件 (实施计划)
├── spec.md              # 功能规格说明
├── research.md          # Phase 0 输出:技术调研
├── data-model.md        # Phase 1 输出:数据模型
├── quickstart.md        # Phase 1 输出:快速开始指南
├── contracts/           # Phase 1 输出:API 契约
│   └── youtube-collector-interface.md
└── checklists/          # 质量检查清单
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── collectors/
│   ├── base.js                 # 已存在:BaseCollector 基类
│   ├── twitter.js              # 参考实现
│   └── youtube.js              # 新增:YouTubeCollector
├── config/
│   ├── datasources.js          # 修改:添加 YOUTUBE_CONFIG
│   ├── validators.js           # 修改:添加 validateYouTubeChannels()
│   └── config-loader.js        # 已存在:配置加载器
├── models/
│   └── news-item.js            # 已存在:NewsItem 模型
├── utils/
│   ├── logger.js               # 已存在:日志工具
│   ├── recency.js              # 已存在:时间窗口过滤
│   └── helpers.js              # 可能新增:视频 URL 构建等辅助函数
└── index.js                    # 修改:注册 YouTube 数据源

config/
└── youtube-channels.json       # 新增:YouTube 频道配置文件

tests/
├── youtube-collector.test.js   # 新增:YouTubeCollector 单元测试
└── youtube-integration.test.js # 新增:集成测试(可选)

.env.example                     # 修改:添加 YouTube 环境变量说明
README.md                        # 修改:更新数据源列表和配置说明
```

**Structure Decision**:

采用 **Option 1: Single project (单一项目结构)**,与现有代码库一致。所有采集器位于 `src/collectors/` 目录,配置文件位于 `config/` 目录。这是 ai-news-collector 项目的标准结构,YouTube 数据源集成将完全遵循此模式。

核心变更点:
1. **新增文件**: `src/collectors/youtube.js` (约 400-500 行代码,参考 twitter.js 的结构)
2. **修改文件**: `src/config/datasources.js` (添加 YOUTUBE_CONFIG 和 loadYouTubeChannels 函数)
3. **新增配置**: `config/youtube-channels.json` (频道列表和采集参数)
4. **更新文档**: `.env.example`, `README.md`

## Complexity Tracking

> **无需填写** - 本功能完全符合项目宪章,无违规项需要说明

## Phase 0: Research & Design Decisions

### Research Tasks (待生成 research.md)

以下技术问题需要在 Phase 0 中调研并在 `research.md` 中记录决策:

1. **YouTube Data API 集成方式**
   - 调研 Composio 平台支持的 YouTube API 方法(search.list, channels.list, videos.list 等)
   - 确认可用的响应字段(snippet, statistics, contentDetails)
   - 验证 Composio SDK 的认证流程和错误处理机制

2. **频道视频获取策略**
   - 比较两种方法:
     - `search.list` with `channelId` filter (更灵活,支持时间范围)
     - `playlistItems.list` with upload playlist (更高效,但需额外 API 调用获取 playlist ID)
   - 选择标准:API 配额消耗、实现复杂度、时间过滤能力

3. **关键词搜索实现**
   - 调研 `search.list` 的 `q` 参数语法(关键词组合、排除词、语言过滤)
   - 确认搜索结果的相关性排序和去重需求
   - 评估搜索成本与频道采集的配额平衡

4. **数据清洗最佳实践**
   - 参考 Twitter 的 `sanitizeTweetText` 实现
   - 确认 YouTube 视频描述中常见的格式问题(时间戳、链接、广告信息)
   - 设计摘要截取策略(优先使用前 N 字符 vs 智能提取关键句)

5. **错误场景处理**
   - 调研 YouTube API 常见错误码(403 配额超限、404 视频不存在、400 参数错误)
   - 确认 Composio SDK 如何转换和传递 YouTube API 错误
   - 设计重试策略(哪些错误可重试,哪些需立即失败)

### Design Principles

- **一致性优先**: 所有设计决策参考 Twitter 数据源的实现,保持代码风格和架构模式统一
- **配额优先**: YouTube API 配额有限,优先考虑节省配额的方案
- **简单性优先**: MVP 阶段避免复杂功能(如播放列表、直播流),专注核心采集能力

## Phase 1: Artifacts (待生成)

### 1. Data Model (data-model.md)

定义 YouTube 数据源的核心实体和转换逻辑:

- **YouTube Channel**: 频道配置实体(从 config/youtube-channels.json 加载)
- **YouTube Video**: API 返回的原始视频对象(snippet, statistics, contentDetails)
- **Search Plan**: 搜索任务单元(频道采集 vs 关键词搜索)
- **NewsItem Mapping**: YouTube Video → NewsItem 的字段映射规则

### 2. API Contracts (contracts/youtube-collector-interface.md)

定义 YouTubeCollector 的公共接口和行为契约:

```javascript
class YouTubeCollector extends BaseCollector {
  /**
   * 采集 YouTube 视频数据
   * @returns {Promise<NewsItem[]>} 符合 NewsItem 结构的视频列表
   * @throws {Error} 当环境变量缺失或 API 调用失败且重试耗尽时
   */
  async collect()

  /**
   * 构造搜索计划
   * @param {Array} channels 频道配置列表
   * @param {Object} defaults 默认参数(关键词、语言、限额)
   * @returns {Array<SearchPlan>} 搜索计划数组
   */
  createSearchPlans(channels, defaults)

  /**
   * 执行单个搜索计划
   * @param {SearchPlan} plan 搜索计划
   * @returns {Promise<NewsItem[]>} 视频列表
   */
  async fetchVideosForPlan(plan)

  /**
   * 将 YouTube 视频转换为 NewsItem
   * @param {Object} video YouTube API 视频对象
   * @param {Object} context 上下文信息(频道名称、搜索类型)
   * @returns {NewsItem|null} 转换后的 NewsItem,无效则返回 null
   */
  buildNewsItem(video, context)
}
```

### 3. Quick Start Guide (quickstart.md)

提供 YouTube 数据源的配置和使用指南:

- 环境变量配置步骤(Composio 账号创建、YouTube 连接授权)
- 频道配置文件示例(`config/youtube-channels.json`)
- 本地测试命令(`npm run demo:youtube`)
- 常见问题排查(API 配额超限、认证失败)

## Implementation Phases

### Phase 2: Task Generation (不在本命令范围内)

Phase 2 将通过 `/speckit.tasks` 命令生成,包括:

- 任务分解(Task 001 - Task 010)
- 依赖关系图
- 验收标准
- 预估工作量

当前命令(`/speckit.plan`)在 Phase 1 完成后停止。

## Verification Checklist

在进入 Phase 2 前,确保以下产物已生成:

- [x] plan.md (本文件)
- [ ] research.md (Phase 0 输出)
- [ ] data-model.md (Phase 1 输出)
- [ ] contracts/youtube-collector-interface.md (Phase 1 输出)
- [ ] quickstart.md (Phase 1 输出)
- [ ] Agent context updated (Phase 1 输出)

---

**Next Steps**: 执行 Phase 0 研究任务,生成 `research.md` 文档解决所有技术决策问题。
