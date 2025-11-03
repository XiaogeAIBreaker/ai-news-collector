# twitter-collection 变更规范

## ADDED Requirements
### Requirement: Twitter 数据源采集
系统必须(SHALL)能够通过 Composio 提供的 Twitter 工具执行检索,并返回符合 `NewsItem` 模型的数据。

#### Scenario: 按配置关键词成功采集
- **GIVEN** `.env` 中配置了有效的 `COMPOSIO_API_KEY`、`COMPOSIO_CONNECTION_ID` 与 `COMPOSIO_USER_ID`
- **AND** `config/twitter-accounts.json` 中至少存在一个启用的推主或默认查询配置
- **WHEN** TwitterCollector 执行 `collect()`
- **THEN** 系统应通过 Composio `twitter` 工具调用 `TWITTER_RECENT_SEARCH`
- **AND** 请求体需携带 `connectedAccountId` 与 `userId`,两者指向同一 connected account
- **AND** 获取不超过 `maxItems` 条记录(默认 50)
- **AND** 每条记录转换为包含 `title`, `summary`, `url`, `createdAt`, `source` 的 `NewsItem`

#### Scenario: 按关注推主采集近 7 天内容
- **GIVEN** `config/twitter-accounts.json` 配置了至少一个推主(包含 `handle`)
- **AND** TwitterCollector 配置 `sinceHours=168`
- **WHEN** 执行采集流程
- **THEN** 系统应为每个推主构造 `from:<handle> -is:retweet` 查询并调用 `TWITTER_RECENT_SEARCH`
- **AND** 仅保留 `created_at` 在当前时间前 168 小时内的推文
- **AND** 输出结果仍遵循 `NewsItem` 结构

#### Scenario: 查询参数下限控制
- **WHEN** 采集器发起 `TWITTER_RECENT_SEARCH` 请求
- **THEN** `max_results` 字段必须落在 [10, 100] 区间
- **AND** 当配置请求少于 10 条时应回退至 10

#### Scenario: 多页抓取
- **GIVEN** 查询结果超过单页上限 100 条
- **WHEN** Composio 响应包含 `meta.next_token`
- **THEN** 采集器必须使用下一页令牌继续抓取,直至达到 `maxItems` 或没有更多数据
- **AND** 采集器必须记录分页进度日志

### Requirement: Twitter 认证与配置管理
系统必须(SHALL)通过集中配置管理 Composio 认证信息与 Twitter 查询参数,并在缺失配置时安全降级。

#### Scenario: 认证缺失的降级处理
- **WHEN** 环境变量缺少 `COMPOSIO_API_KEY` 或 Twitter 连接 ID
- **THEN** 采集器应输出警告日志并返回空数组
- **AND** 不得抛出未捕获异常

#### Scenario: 可配置查询参数
- **WHEN** `config/twitter-accounts.json` 中为某推主配置了 `query`, `languages`, `sinceHours`, `maxResultsPerPage`
- **THEN** 采集器应优先使用推主自定义 `query` 生成搜索语句
- **AND** 语言或时间窗口参数应反映在 `TWITTER_RECENT_SEARCH` 请求中
- **AND** 若未提供,应退回默认值 (`from:<handle> -is:retweet`, 内置语言/时间窗口, `max_results`=100)

#### Scenario: userId 与连接匹配
- **WHEN** 读取环境变量或配置中的 `COMPOSIO_USER_ID`
- **AND** 使用该 ID 调用 `TWITTER_RECENT_SEARCH`
- **THEN** 采集器必须验证该 userId 与 `connectedAccountId` 属于同一 connected account
- **AND** 不匹配时应记录错误并跳过采集

### Requirement: Twitter 数据清洗与去重
系统必须(SHALL)对推文数据进行格式化与去重,确保生成的 `NewsItem` 满足后续评分需求。

#### Scenario: 内容清洗
- **WHEN** 推文包含 URL、Emoji 或换行
- **THEN** 采集器应移除 Emoji, 保留必要的 URL
- **AND** `summary` 长度应控制在 80-400 字符范围,不足时使用完整文本

#### Scenario: 去重逻辑
- **WHEN** 同一推文在多关键词查询中重复出现
- **THEN** 采集器应基于 `tweet.id` 去重
- **AND** 确保最终返回的 `NewsItem` ID 唯一

### Requirement: Twitter 速率限制与错误处理
系统必须(SHALL)识别并处理 Composio/Twitter 转发的速率限制与常见错误,避免影响其他数据源。

#### Scenario: 速率限制重试
- **WHEN** Composio 返回 HTTP 429、`error.code == 'RATE_LIMITED'` 或 Twitter 原始错误码 88
- **THEN** 采集器应遵循指数退避策略重试
- **AND** 若超过最大重试次数,记录错误并停止本次采集

#### Scenario: 部分失败的容错
- **WHEN** 单页结果解析失败(例如字段缺失)
- **THEN** 采集器应跳过该条推文并记录调试日志
- **AND** 继续处理剩余数据

### Requirement: 集成评分与报告流程
Twitter 采集结果必须(SHALL)复用现有 LLM 评分流程和 Markdown 输出机制。

#### Scenario: 过滤配置加载
- **WHEN** `loadFilterConfigForSource('Twitter')`
- **THEN** 系统应成功加载 `config/filter-rules-twitter.json`
- **AND** 日志中输出正反样例数量

#### Scenario: 报告输出
- **WHEN** MarkdownGenerator 生成报告
- **THEN** Twitter 数据源应以独立分组展示
- **AND** 报告文件名保留原有时间戳命名规则,不覆盖历史文件
