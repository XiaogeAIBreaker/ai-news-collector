# 新增 Twitter 数据源采集能力

## Why
当前系统已支持微信公众号、AIBase、知识星球三类数据源,但未覆盖海外实时资讯渠道。Twitter(X) 是全球范围内 AI 新闻和行业动态的重要发布平台,大量产品动态、投融资和技术更新都会首先出现在 Twitter。为了让 Markdown 报告更加全面,需要引入 Twitter 采集能力,并保持与现有数据源一致的评分与过滤流程。

## What Changes
- **实现 TwitterCollector**
  - 通过 Composio 提供的 `twitter` 工具包执行搜索任务,按关键词或指定推主检索 AI 相关新闻
  - 支持多关键词、关注推主列表、语言、去重与发布时间窗口等参数配置
  - 按配置的推主列表抓取近 7 天推文(类似 `config/wechat-accounts.json` 的账户管理)
  - 遵循 `BaseCollector` 接口,返回标准 `NewsItem`
- **扩展配置体系**
  - 在 `datasources.js` 中新增 Twitter 数据源,默认最大抓取 50 条
  - 新增 `config/twitter-accounts.json`(含推主、可选自定义查询、标签等),并提供校验器
  - 推主配置支持生成默认查询(`from:<handle> -is:retweet`),也可在配置中覆盖
  - 在 `.env.example` 添加 Composio 所需的 `COMPOSIO_API_KEY`、`COMPOSIO_CONNECTION_ID`、`COMPOSIO_USER_ID` 等配置说明
- **LLM 评分与输出集成**
  - 为 Twitter 配置独立的过滤规则文件 `filter-rules-twitter.json`
  - 确保主流程加载 Twitter 结果并写入带时间戳的 Markdown 报告

## Impact
- **新增规格**: `twitter-collection`
- **主要受影响代码**:
  - `src/collectors/twitter.js` (新增)
  - `src/config/datasources.js`、`src/index.js`、`src/config/loader.js`、`src/config/validators.js`
  - `config/` 目录新增/更新 `twitter-accounts.json` 示例与说明
- **外部依赖**: 复用 axios; 需要引入 `@composio/core` 与 Twitter 工具调用器
- **破坏性变更**: 无,新增数据源以兼容方式接入
