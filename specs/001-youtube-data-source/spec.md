# Feature Specification: YouTube 数据源集成

**Feature Branch**: `001-youtube-data-source`
**Created**: 2025-11-07
**Status**: Draft
**Input**: User description: "支持Youtube数据源,数据获取方式参考Twitter使用Composio"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 订阅 YouTube 频道内容采集 (Priority: P1)

作为内容采集系统的用户,我希望能够从订阅的 YouTube 频道中获取最新视频信息,以便在新闻聚合报告中包含来自 YouTube 的 AI 相关内容。

**Why this priority**: 这是 YouTube 数据源的核心功能,能够直接满足用户从特定频道获取内容的基本需求,是整个功能的 MVP。

**Independent Test**: 可以独立测试 - 配置单个 YouTube 频道 ID,执行采集流程,验证返回的视频数据是否符合 NewsItem 结构,并包含标题、描述、链接等必要信息。

**Acceptance Scenarios**:

1. **Given** 配置文件中包含至少一个有效的 YouTube 频道 ID,**When** 执行 YouTube 数据采集,**Then** 系统应返回该频道最近 N 天内发布的视频列表,每个视频转换为 NewsItem 格式
2. **Given** 配置文件中的频道 ID 无效或频道不存在,**When** 执行采集,**Then** 系统应记录错误日志并跳过该频道,继续处理其他频道
3. **Given** 配置的采集时间窗口为 7 天,**When** 执行采集,**Then** 只返回最近 7 天内发布的视频,过滤掉更早的内容

---

### User Story 2 - YouTube 认证与授权管理 (Priority: P1)

作为系统管理员,我需要通过 Composio 配置 YouTube API 访问凭证,以便采集器能够安全地访问 YouTube 数据。

**Why this priority**: 没有正确的认证配置,采集功能无法工作。这是功能运行的前置条件,与核心采集功能同等重要。

**Independent Test**: 可以独立测试 - 提供有效的 Composio API Key、连接 ID 和用户 ID,验证采集器能够成功初始化并调用 YouTube API;移除某个必需的环境变量,验证系统能够优雅降级而不崩溃。

**Acceptance Scenarios**:

1. **Given** 环境变量中配置了 `COMPOSIO_API_KEY`、`COMPOSIO_CONNECTION_ID_YOUTUBE`、`COMPOSIO_USER_ID_YOUTUBE`,**When** 初始化 YouTube 采集器,**Then** 系统应成功建立与 YouTube API 的连接
2. **Given** 缺少任何一个必需的环境变量,**When** 尝试执行采集,**Then** 系统应输出警告日志,返回空数组,并且不抛出未捕获异常
3. **Given** Composio 连接已过期或失效,**When** 执行 API 调用,**Then** 系统应识别认证错误并记录详细错误信息

---

### User Story 3 - 关键词搜索视频采集 (Priority: P2)

作为内容采集系统的用户,我希望能够通过关键词搜索 YouTube 视频,以便在没有特定订阅频道时仍能获取相关内容。

**Why this priority**: 关键词搜索提供了频道订阅之外的内容发现方式,增强了系统的灵活性,但不是核心 MVP 功能。

**Independent Test**: 可以独立测试 - 配置关键词列表(如 "AI", "Machine Learning"),执行采集,验证返回的视频是否与关键词相关,并符合时间窗口限制。

**Acceptance Scenarios**:

1. **Given** 配置文件中定义了关键词列表,**When** 没有配置任何频道或所有频道被禁用,**Then** 系统应使用关键词进行搜索并返回相关视频
2. **Given** 配置了多个关键词,**When** 执行搜索,**Then** 系统应对每个关键词执行独立查询,并合并去重后返回结果
3. **Given** 关键词搜索返回的结果超过配置的 maxItems 限制,**Then** 系统应按发布时间倒序截取,优先保留最新内容

---

### User Story 4 - 数据清洗与格式转换 (Priority: P2)

作为下游处理模块,我需要接收到清洗后的标准化 NewsItem 数据,以便进行评分和过滤操作。

**Why this priority**: 数据清洗确保输出质量,但在有基础数据返回的情况下,可以在后续迭代中优化清洗逻辑。

**Independent Test**: 可以独立测试 - 提供包含特殊字符、超长描述、缺失字段的原始 YouTube 视频数据,验证转换后的 NewsItem 对象字段完整、长度合理、格式正确。

**Acceptance Scenarios**:

1. **Given** YouTube 视频包含超长描述(>500字符),**When** 转换为 NewsItem,**Then** summary 字段应截断至合理长度(如 400 字符),并在末尾添加省略号
2. **Given** 视频标题包含特殊字符或 Emoji,**When** 进行清洗,**Then** 应移除 Emoji 并保留可读文本
3. **Given** 视频数据缺少某些可选字段(如点赞数、评论数),**When** 构建 NewsItem,**Then** 应使用默认值或空值,确保对象结构完整

---

### User Story 5 - 配置化参数管理 (Priority: P3)

作为系统用户,我希望能够通过配置文件灵活调整采集参数(如时间窗口、最大结果数),而无需修改代码。

**Why this priority**: 配置化提升了系统的可维护性,但在初期可以使用硬编码默认值实现基础功能。

**Independent Test**: 可以独立测试 - 修改配置文件中的 `maxItems`、`maxResultsPerPage`、`sinceHours` 等参数,执行采集,验证实际行为是否符合配置值。

**Acceptance Scenarios**:

1. **Given** 配置文件中设置了 `maxResultsPerPage: 25`,**When** 执行 API 调用,**Then** 单次请求应最多返回 25 条结果
2. **Given** 配置了 `maxItemsPerChannel: 20`,**When** 采集某个频道,**Then** 该频道返回的视频数量不应超过 20 条
3. **Given** 配置缺失或无效,**When** 读取配置,**Then** 系统应使用内置默认值并记录日志提示

---

### Edge Cases

- **当 YouTube API 返回空结果集时会发生什么?** 系统应记录调试日志,返回空数组,不影响其他数据源的采集
- **当视频发布时间字段缺失或格式错误时如何处理?** 系统应记录警告日志,跳过该条视频或使用当前时间作为回退值
- **当配置的频道列表为空且没有关键词时会发生什么?** 系统应记录警告并返回空数组,避免无效 API 调用
- **当 YouTube API 返回速率限制错误(429)时如何处理?** 系统应遵循指数退避策略重试,超过最大重试次数后记录错误并停止本次采集
- **当单个视频在多个查询(频道+关键词)中重复出现时如何去重?** 系统应基于视频 ID 去重,确保最终输出不包含重复内容
- **当全局时间窗口配置为 30 天,但 YouTube API 只支持最近 X 天时如何处理?** 系统应使用 API 支持的最大时间窗口,并记录警告日志说明实际使用的窗口

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须支持通过 Composio 集成调用 YouTube Data API 获取视频数据
- **FR-002**: 系统必须能够根据配置的频道 ID 列表,获取各频道最近发布的视频
- **FR-003**: 系统必须能够根据关键词列表搜索相关 YouTube 视频
- **FR-004**: 系统必须将 YouTube 视频数据转换为统一的 NewsItem 结构,包含标题、摘要、链接、发布时间、来源等字段
- **FR-005**: 系统必须遵循全局配置的时间窗口(recentDays),仅返回指定天数内发布的视频
- **FR-006**: 系统必须通过环境变量读取 Composio 认证信息(`COMPOSIO_API_KEY`, `COMPOSIO_CONNECTION_ID_YOUTUBE`, `COMPOSIO_USER_ID_YOUTUBE`)
- **FR-007**: 当缺少必需的环境变量时,系统必须记录警告日志并安全降级(返回空数组,不抛出异常)
- **FR-008**: 系统必须对采集到的视频数据进行去重,基于视频 ID 确保唯一性
- **FR-009**: 系统必须对视频标题和描述进行清洗,移除 Emoji 和多余空白,控制摘要长度
- **FR-010**: 系统必须支持通过配置文件管理 YouTube 频道列表、关键词列表及采集参数
- **FR-011**: 系统必须在 API 请求失败时实施指数退避重试策略,并记录详细错误信息
- **FR-012**: 系统必须复用现有的 NewsItem 验证机制,过滤无效数据
- **FR-013**: 系统必须将 YouTube 采集结果集成到现有的评分与报告流程中,作为独立数据源展示
- **FR-014**: 系统必须记录详细的采集日志,包括查询参数、结果数量、错误信息等

### Key Entities

- **YouTube 频道(YouTube Channel)**: 表示一个 YouTube 内容创作者的频道,包含频道 ID、频道名称、是否启用等属性。一个频道可以发布多个视频
- **YouTube 视频(YouTube Video)**: 表示单个视频内容,包含视频 ID、标题、描述、发布时间、频道信息、播放量、点赞数、评论数等属性。视频是采集的核心实体
- **搜索计划(Search Plan)**: 表示一次采集任务的查询单元,可以是针对特定频道或关键词的搜索,包含查询类型、目标(频道 ID 或关键词)、语言、结果限制等属性
- **NewsItem**: 统一的新闻条目数据结构,YouTube 视频数据将被转换为此格式,包含 id、title、summary、url、source、createdAt、metadata 等字段

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户能够通过配置文件添加 YouTube 频道,系统在 2 分钟内完成单次采集并返回结果
- **SC-002**: 系统能够从单个频道获取至少最近 7 天内的所有视频(在 API 限制范围内)
- **SC-003**: 在正常网络条件下,YouTube 数据采集的成功率达到 95% 以上(不包括 API 配额耗尽情况)
- **SC-004**: 采集到的 YouTube 视频数据,95% 以上能够通过 NewsItem 验证并进入评分流程
- **SC-005**: 当配置 10 个 YouTube 频道时,单次完整采集时间不超过 5 分钟
- **SC-006**: 系统能够正确处理 YouTube API 速率限制,自动重试后最终获取数据,失败时不影响其他数据源
- **SC-007**: 在 Composio 认证配置缺失的情况下,系统能够在 5 秒内完成安全降级,不中断整体采集流程
- **SC-008**: YouTube 数据源在最终生成的 Markdown 报告中作为独立分组正确展示,包含所有必要的元数据(频道名称、发布时间、观看量等)

## Assumptions & Dependencies

### Assumptions

- YouTube Data API v3 通过 Composio 平台可用且稳定
- 用户已在 Composio 平台完成 YouTube 账号授权,获得有效的连接 ID
- YouTube API 配额足够支持日常采集需求(每日配额至少 10,000 units)
- 配置文件格式与现有 Twitter 配置保持一致(JSON 格式,包含频道列表、关键词列表、config 对象)
- 系统已实现通用的 NewsItem 模型和验证机制
- 系统已实现 BaseCollector 基类,提供重试、日志、验证等通用功能
- 全局时间窗口配置(recentDays)已存在且可复用

### Dependencies

- **Composio SDK**: 依赖 `@composio/core` 包提供 YouTube API 调用能力
- **BaseCollector**: 继承自 [src/collectors/base.js](../../src/collectors/base.js),复用重试和验证逻辑
- **NewsItem Model**: 依赖 [src/models/news-item.js](../../src/models/news-item.js) 的数据模型和验证函数
- **配置加载器**: 依赖 [src/config/config-loader.js](../../src/config/config-loader.js) 加载配置文件
- **全局时间窗口**: 依赖 [src/config/collection-window.js](../../src/config/collection-window.js) 的 `getRecentDays()` 和 `getRecentCutoff()` 函数
- **去重与分区工具**: 依赖 [src/utils/recency.js](../../src/utils/recency.js) 的 `partitionByGlobalRecency()` 函数
- **环境变量**: 依赖用户在 `.env` 文件中配置 `COMPOSIO_CONNECTION_ID_YOUTUBE` 和 `COMPOSIO_USER_ID_YOUTUBE`

## Out of Scope

以下功能不在本次功能范围内,可在后续迭代中考虑:

- YouTube 视频播放列表(Playlist)采集
- YouTube 直播流(Live Stream)采集
- 视频字幕/转录文本提取
- 视频分类或自动打标签
- YouTube 社区帖子(Community Posts)采集
- YouTube Shorts 的独立处理逻辑
- 视频缩略图下载与本地存储
- 多语言字幕支持
- 视频内容 AI 分析(如关键帧提取、内容摘要生成)
