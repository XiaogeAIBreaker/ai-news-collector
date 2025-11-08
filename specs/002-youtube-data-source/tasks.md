# Tasks: YouTube 数据源集成

**Input**: Design documents from `/specs/002-youtube-data-source/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

单一项目结构:
- Source: `src/`
- Tests: `tests/`
- Config: `config/`
- Documentation: `specs/002-youtube-data-source/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 项目初始化和基础结构准备

- [x] T001 更新 .env.example 添加 YouTube 环境变量说明
- [x] T002 [P] 创建配置文件示例 config/youtube-channels.json.example
- [x] T003 [P] 更新 README.md 添加 YouTube 数据源配置说明

**Verification**:
- `.env.example` 包含 `COMPOSIO_CONNECTION_ID_YOUTUBE` 和 `COMPOSIO_USER_ID_YOUTUBE`
- `config/youtube-channels.json.example` 包含完整的配置示例
- `README.md` 的数据源列表包含 YouTube

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 核心基础设施,必须在任何用户故事实施前完成

**⚠️ CRITICAL**: 在此阶段完成前,不能开始任何用户故事的工作

- [x] T004 在 src/config/validators.js 中添加 validateYouTubeChannels() 函数
- [x] T005 [P] 在 src/config/datasources.js 中添加 loadYouTubeChannels() 函数
- [x] T006 [P] 在 src/config/datasources.js 中添加 YOUTUBE_CONFIG 配置对象
- [x] T007 在 src/config/datasources.js 的 getEnabledDataSources() 中注册 YouTube

**Verification**:
- `validateYouTubeChannels()` 能够验证配置文件格式(频道 ID 格式、必填字段)
- `loadYouTubeChannels()` 能够加载配置文件并返回 channels, keywords, config 三部分
- `YOUTUBE_CONFIG` 包含 name, enabled, maxItems, config 等字段
- `getEnabledDataSources()` 返回的数组包含 YOUTUBE_CONFIG

**Checkpoint**: 基础设施就绪 - 用户故事实施可以并行开始

---

## Phase 3: User Story 1 + 2 - 频道采集 & 认证管理 (Priority: P1) 🎯 MVP

**Goal**: 实现 YouTube 频道内容采集的核心功能,包括 Composio 认证、频道视频获取、数据转换为 NewsItem

**Why Combined**: 认证(US2)是采集(US1)的前置条件,两者必须一起实现才能形成可用的 MVP

**Independent Test**:
1. 配置有效的环境变量和单个频道 ID
2. 执行 `node scripts/youtube-demo.js`
3. 验证返回至少 1 条 NewsItem,包含完整的标题、URL、发布时间、metadata

**Acceptance Criteria**:
- ✅ 从配置的频道获取最近 N 天的视频列表
- ✅ 每个视频正确转换为 NewsItem 格式
- ✅ 环境变量缺失时优雅降级(返回空数组,不崩溃)
- ✅ 时间窗口过滤正确(仅返回 recentDays 内的视频)

### 辅助工具函数(可并行开发)

- [x] T008 [P] [US1] 在 src/collectors/youtube.js 中实现 sanitizeVideoText() 工具函数
- [x] T009 [P] [US1] 在 src/collectors/youtube.js 中实现 buildVideoUrl() 工具函数
- [x] T010 [P] [US1] 在 src/collectors/youtube.js 中实现 clamp() 工具函数

**Verification** (T008-T010):
- `sanitizeVideoText()` 能移除 Emoji、URL、时间戳、HTML 实体,合并空白
- `buildVideoUrl()` 返回格式: `https://www.youtube.com/watch?v={videoId}`
- `clamp()` 正确将数值限制在 min-max 范围内

### 核心采集器类

- [x] T011 [US1] 创建 YouTubeCollector 类骨架(继承 BaseCollector)在 src/collectors/youtube.js
- [x] T012 [US2] 在 collect() 方法中实现环境变量读取和验证逻辑
- [x] T013 [US2] 实现环境变量缺失时的优雅降级(记录警告,返回空数组)
- [x] T014 [US1] 实现 createSearchPlans() 方法(生成频道采集计划)
- [x] T015 [US1] 实现频道 ID 到上传播放列表 ID 的转换逻辑(UC -> UU)

**Verification** (T011-T015):
- YouTubeCollector 类可实例化,继承 BaseCollector 的 retryWithBackoff 和 validateNewsItems 方法
- 环境变量完整时,collect() 不抛出错误
- 环境变量缺失时,collect() 返回 `[]` 并记录警告日志
- createSearchPlans() 为每个启用的频道生成 SearchPlan 对象
- 频道 ID `UCxxxxxx` 正确转换为播放列表 ID `UUxxxxxx`

### API 调用与数据获取

- [x] T016 [US2] 在 collect() 中初始化 Composio SDK 实例(new Composio({ apiKey }))
- [x] T017 [US1] 实现 fetchVideosForPlan() 方法(调用播放列表 API)
- [x] T018 [US1] 在 fetchVideosForPlan() 中实现分页逻辑(nextPageToken)
- [x] T019 [US1] 实现 batchGetVideoDetails() 方法(批量获取视频详情)
- [x] T020 [US1] 在 batchGetVideoDetails() 中实现 videoIds 分组逻辑(每组 50 个)

**Verification** (T016-T020):
- Composio SDK 使用正确的 apiKey 初始化
- fetchVideosForPlan() 能调用 YOUTUBE_LIST_PLAYLIST_ITEMS 并返回视频 ID 列表
- 分页逻辑能获取多页数据直到达到 limit 或无更多结果
- batchGetVideoDetails() 能将 100 个 videoId 分为 2 组(50+50)并批量获取详情
- API 响应中的 snippet, statistics, contentDetails 字段正确解析

### 数据转换与验证

- [x] T021 [US1] 实现 buildNewsItem() 方法(YouTube Video → NewsItem)
- [x] T022 [US1] 在 buildNewsItem() 中实现字段映射(id, title, summary, url, source, createdAt)
- [x] T023 [US1] 在 buildNewsItem() 中实现 metadata 填充(channelId, viewCount, likeCount 等)
- [x] T024 [US1] 在 buildNewsItem() 中实现必填字段验证(无效视频返回 null)
- [x] T025 [US1] 在 collect() 中实现去重逻辑(使用 seenVideoIds Set)
- [x] T026 [US1] 在 collect() 中集成 partitionByGlobalRecency() 时间窗口过滤
- [x] T027 [US1] 在 collect() 中集成 validateNewsItems() 数据验证

**Verification** (T021-T027):
- buildNewsItem() 返回的对象符合 NewsItem 结构
- 标题和描述经过 sanitizeVideoText() 清洗,长度符合限制(标题≤120,摘要≤400)
- metadata 包含 channelId, channelTitle, videoId, viewCount, likeCount, commentCount 等字段
- 缺少 id, title 或 publishedAt 的视频返回 null
- seenVideoIds Set 能正确识别和跳过重复的 videoId
- 超过时间窗口的视频被 partitionByGlobalRecency() 过滤
- 无效的 NewsItem 被 validateNewsItems() 过滤

### 集成与测试

- [x] T028 [US1] 在 src/index.js 中导入 YouTubeCollector
- [x] T029 [US1] 创建测试脚本 scripts/youtube-demo.js(参考 twitter-demo.js)
- [x] T030 [US1] 执行完整采集流程测试(环境变量配置 → 频道采集 → NewsItem 输出)

**Verification** (T028-T030):
- 主程序 `npm start` 能够执行 YouTube 采集并输出日志
- `node scripts/youtube-demo.js` 能输出采集到的视频列表(标题、频道、发布时间、观看量)
- 采集到的 NewsItem 能够集成到 Markdown 报告中,作为独立的 YouTube 分组展示

**MVP Checkpoint**: 核心采集功能完成,可以从配置的频道获取视频并生成报告

---

## Phase 4: User Story 3 - 关键词搜索采集 (Priority: P2)

**Goal**: 支持通过关键词搜索 YouTube 视频,作为频道订阅的补充方式

**Independent Test**:
1. 配置文件中 channels 留空,keywords 设置为 `["AI", "Machine Learning"]`
2. 执行采集
3. 验证返回的视频与关键词相关,且符合时间窗口限制

**Acceptance Criteria**:
- ✅ 无频道配置时自动使用关键词搜索
- ✅ 多个关键词合并为单次查询(OR 逻辑)
- ✅ 搜索结果去重后返回

### 关键词搜索实现

- [x] T031 [P] [US3] 实现 buildKeywordQuery() 工具函数(组合关键词为查询字符串)
- [x] T032 [US3] 在 createSearchPlans() 中添加关键词搜索计划生成逻辑
- [x] T033 [US3] 实现 fetchVideosForKeyword() 方法(调用 YOUTUBE_SEARCH_VIDEOS)
- [x] T034 [US3] 在 fetchVideosForPlan() 中添加 type='keyword' 分支调用 fetchVideosForKeyword()

**Verification** (T031-T034):
- buildKeywordQuery() 将 `["AI", "Machine Learning"]` 转换为 `(AI OR "Machine Learning") -is:live`
- createSearchPlans() 在无频道时生成 type='keyword' 的 SearchPlan
- fetchFromSearch() 能调用搜索 API 并返回相关视频
- 关键词搜索和频道采集的结果能正确合并和去重

**Feature Complete**: 关键词搜索功能完成,支持无频道配置场景

---

## Phase 5: User Story 4 - 数据清洗增强 (Priority: P2)

**Goal**: 增强数据清洗能力,处理 YouTube 特有的格式问题(时间戳、广告信息等)

**Independent Test**:
1. 提供包含时间戳(0:00)、URL、HTML 实体的视频描述
2. 调用 sanitizeVideoText()
3. 验证输出仅包含纯文本,无特殊字符

**Acceptance Criteria**:
- ✅ 移除视频描述中的时间戳章节标记
- ✅ 移除推广链接和社交媒体链接
- ✅ 正确处理 HTML 实体(&quot;, &amp; 等)

### 数据清洗增强

- [x] T035 [P] [US4] 在 sanitizeVideoText() 中添加时间戳移除逻辑(/\b\d{1,2}:\d{2}/)
- [x] T036 [P] [US4] 在 sanitizeVideoText() 中添加 URL 移除逻辑(/https?:\/\/[^\s]+/)
- [x] T037 [P] [US4] 在 sanitizeVideoText() 中添加 HTML 实体解码逻辑
- [x] T038 [US4] 更新 buildNewsItem() 使用增强的 sanitizeVideoText()

**Verification** (T035-T038):
- `"0:00 引言 3:45 重点"` → `"引言 重点"`
- `"访问 https://example.com"` → `"访问"`
- `"&quot;AI&quot;"` → `'"AI"'`
- buildNewsItem() 输出的 title 和 summary 已完全清洗

**Feature Complete**: 数据清洗增强完成,输出质量提升

---

## Phase 6: User Story 5 - 配置化参数管理 (Priority: P3)

**Goal**: 支持通过配置文件灵活调整采集参数,无需修改代码

**Independent Test**:
1. 修改 config/youtube-channels.json 中的 maxItemsPerChannel 为 5
2. 执行采集
3. 验证每个频道最多返回 5 条视频

**Acceptance Criteria**:
- ✅ 支持配置 maxResultsPerPage, maxItemsPerChannel, maxItemsPerKeyword
- ✅ 支持配置 defaultLanguages, queryPrefix
- ✅ 配置缺失时使用合理的默认值

### 配置参数支持

- [x] T039 [P] [US5] 在 createSearchPlans() 中读取 config.maxItemsPerChannel 参数
- [x] T040 [P] [US5] 在 fetchVideosForPlan() 中读取 config.maxResultsPerPage 参数
- [x] T041 [P] [US5] 实现 buildKeywordQuery() 支持 queryPrefix 参数
- [x] T042 [P] [US5] 在 createSearchPlans() 中读取 config.defaultLanguage 参数
- [x] T043 [US5] 为所有配置参数添加默认值回退逻辑

**Verification** (T039-T043):
- 修改配置文件中的参数能影响实际采集行为
- 删除 config 对象时采集仍能正常运行(使用默认值)
- 日志中输出当前使用的配置参数值

**Feature Complete**: 配置化参数管理完成,系统灵活性提升

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 完善日志、错误处理、文档和边缘情况

### 日志与错误处理

- [ ] T044 [P] 添加详细的调试日志(查询参数、结果数量、分页状态)
- [ ] T045 [P] 实现 YouTube API 特定错误识别(quotaExceeded, forbidden, videoNotFound)
- [ ] T046 [P] 在配额耗尽时记录详细错误信息和配额重置时间提示

**Verification** (T044-T046):
- 日志级别正确(INFO 用于采集进度,DEBUG 用于详细信息,ERROR 用于失败)
- API 403 错误能正确识别为配额耗尽或权限不足
- 配额耗尽时日志提示"配额将在太平洋时间午夜(UTC-8)重置"

### 边缘情况处理

- [x] T047 [P] 处理 API 返回空结果集的情况(记录调试日志,返回空数组)
- [x] T048 [P] 处理视频发布时间缺失或格式错误(跳过或使用当前时间)
- [x] T049 [P] 处理频道列表为空且无关键词的情况(记录警告,返回空数组)
- [x] T050 [P] 处理单个视频在多查询中重复出现(seenVideoIds 去重)

**Verification** (T047-T050):
- API 返回 `{"items": []}` 时不抛出错误
- `publishedAt` 字段无效时该视频被跳过
- channels 和 keywords 均为空时记录警告并安全返回
- 同一 videoId 在频道和关键词查询中仅保留一次

### 文档完善

- [x] T051 [P] 更新 README.md 的"快速开始"部分添加 YouTube 配置步骤
- [x] T052 [P] 创建 docs/.env配置/如何接入YouTube.md 文档(参考推特文档)
- [x] T053 [P] 在 config/youtube-channels.json.example 中添加详细注释

**Verification** (T051-T053):
- README.md 包含 YouTube 环境变量配置说明和示例配置文件说明
- 如何接入YouTube.md 包含 Composio 账号创建、连接授权、频道 ID 查找步骤
- 配置示例文件包含所有字段的中文注释说明

---

## Dependencies & Execution Strategy

### Story Dependencies (Completion Order)

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational)
    ↓
Phase 3 (US1+US2) 🎯 MVP ← Must complete first
    ↓
    ├─→ Phase 4 (US3) ← Can start after MVP
    ├─→ Phase 5 (US5) ← Can start after MVP
    └─→ Phase 6 (US4) ← Can start after MVP
    ↓
Phase 7 (Polish) ← Starts after all user stories
```

### Parallel Execution Opportunities

**Within MVP (Phase 3)**:
- T008, T009, T010 (工具函数) 可并行开发
- T012-T013 (环境变量验证) 与 T014-T015 (搜索计划) 可并行
- T021-T024 (数据转换) 可在 T017-T020 (API 调用) 完成后并行开始

**Across User Stories (Phase 4-6)**:
- US3 (关键词搜索), US4 (数据清洗), US5 (配置管理) 三个故事完全独立,可并行开发

**Within Polish (Phase 7)**:
- T044-T046 (日志错误), T047-T050 (边缘情况), T051-T053 (文档) 完全独立,可并行

### Recommended MVP Scope

**Minimum Viable Product (建议)**:
- Phase 1 (Setup)
- Phase 2 (Foundational)
- Phase 3 (US1+US2) - 频道采集 & 认证管理

**Rationale**:
- US1+US2 组合提供完整的核心功能:从配置的频道获取视频并生成报告
- 其他功能(关键词搜索、数据清洗增强、配置管理)为增强特性,可在后续迭代添加
- MVP 可在 1-2 天内完成,快速验证技术方案可行性

---

## Task Summary

**Total Tasks**: 53
- Phase 1 (Setup): 3 tasks
- Phase 2 (Foundational): 4 tasks
- Phase 3 (US1+US2 - MVP): 23 tasks
- Phase 4 (US3): 4 tasks
- Phase 5 (US4): 4 tasks
- Phase 6 (US5): 5 tasks
- Phase 7 (Polish): 10 tasks

**Parallel Opportunities**: 30+ tasks 可并行执行(标记 [P])

**Independent Test Criteria**:
- US1+US2: 配置单频道 → 执行采集 → 验证返回 NewsItem
- US3: 配置关键词 → 执行采集 → 验证返回相关视频
- US4: 提供特殊字符文本 → 调用清洗函数 → 验证输出纯文本
- US5: 修改配置参数 → 执行采集 → 验证行为符合配置

**Estimated Effort**:
- MVP (Phase 1-3): 8-12 hours
- Full Feature (All Phases): 16-20 hours

---

## Implementation Notes

### Key Design Decisions (from research.md)

1. **频道采集策略**: 优先使用播放列表方法(playlistItems.list, 配额 1),仅在需要关键词过滤时使用搜索方法(search.list, 配额 100)

2. **批量优化**: 使用 YOUTUBE_GET_VIDEO_DETAILS_BATCH 一次获取最多 50 个视频详情,节省 98% 的配额

3. **数据清洗**: 移除 Emoji、URL、时间戳、HTML 实体,截断标题(120)和摘要(400)

4. **错误处理**: 继承 BaseCollector 的重试机制(3 次,指数退避),配额耗尽时立即停止

### Testing Strategy

**手动测试**(推荐用于 MVP 验证):
1. 配置真实的 Composio 凭证和频道 ID
2. 运行 `node scripts/youtube-demo.js`
3. 检查控制台输出和生成的 Markdown 报告

**单元测试**(可选,时间允许时添加):
- Mock Composio SDK 响应
- 测试数据清洗函数(sanitizeVideoText)
- 测试搜索计划生成(createSearchPlans)
- 测试 NewsItem 转换(buildNewsItem)

**集成测试**(可选):
- 使用真实 API 调用(需配置凭证)
- 验证完整采集流程(配置 → API → NewsItem → 报告)

### Common Pitfalls

1. **频道 ID 格式**: 确保以 `UC` 开头,长度 24 字符
2. **配额管理**: 监控每日配额使用,避免在测试中耗尽配额
3. **时间窗口**: 确认全局 recentDays 配置,避免过滤掉所有视频
4. **Composio 连接**: 定期检查连接状态,过期需重新授权

---

**Generated**: 2025-11-07
**Feature Branch**: 002-youtube-data-source
**Next Step**: 开始实施 Phase 1 Setup 任务
