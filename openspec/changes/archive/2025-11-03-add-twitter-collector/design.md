# 设计说明: Twitter 数据源集成(Composio)

## 目标
- 借助 Composio 平台提供的 Twitter 工具,获取与 AI 相关的最新推文
- 将推文结果转换为现有 `NewsItem` 结构,无缝接入评分与报告流程
- 利用 Composio 统一管理认证,减少直接操作 Twitter API 的复杂度

## 技术选型
- **平台**: Composio (https://app.composio.dev)
- **SDK**: `@composio/core` (Node.js 版本)
- **认证方式**: `.env` 提供 `COMPOSIO_API_KEY`; 默认连接与实体信息通过 `COMPOSIO_CONNECTION_ID`、`COMPOSIO_USER_ID` 注入,以匹配 Composio 中的 connected account
- **查询策略**:
  - 默认关键词: `["AI", "Artificial Intelligence", "大模型", "AIGC"]`
  - 推主配置默认生成 `from:<handle> -is:retweet` 查询,也允许自定义覆盖
  - 精确使用 `TWITTER_RECENT_SEARCH` 工具; 请求参数中 `max_results` 必须介于 10-100,由采集器做下限保护
  - 支持 `sinceHours` 将查询限定在最近 N 小时(默认 168,<= 168)
- **分页**: 读取返回的 `meta.next_token`,继续通过 Composio 调用直到凑够 `maxItems`

## 模块分工
1. **配置层** (`config/twitter-accounts.json` + 校验器)
   - `accounts`: 数组,每项包含 `handle`, `displayName`, `description`
   - 可选字段: `query`(覆盖默认 `from:<handle> -is:retweet`), `languages`, `tags`, `enabled`
   - `sinceHours`: 作为全局字段或在 `config` 对象中配置,默认 168,最大 168
   - `maxResultsPerPage`: 可选字段,默认 100,不得超过 Composio 限制
2. **采集器层** (`src/collectors/twitter.js`)
   - 初始化 Composio 客户端
   - 统一构造 `TWITTER_RECENT_SEARCH` 调用; 对推主自动生成 `from:<handle>` 查询,可使用配置字段覆盖
   - 在无推主配置时,使用内置关键词常量(`["AI","Artificial Intelligence","大模型","AIGC"]`)执行搜索
   - 处理分页、速率限制、错误转换
   - 解析推文文本、公共指标,映射为 `NewsItem`
3. **集成层**
   - `datasources.js`: 新增 Twitter 配置,默认 `enabled: false`
   - `index.js`: 扩展 `collectorMap`
   - `config/loader.js`: 增加 Twitter 过滤规则映射
   - `config/README.md`: 记录 Composio 配置说明

## 速率限制策略
- Composio 会将 Twitter 的 429/88 错误透传为 HTTP 429 或结构化错误;捕获后交由 `BaseCollector.retryWithBackoff`
- 单个推主按分页拉取,默认 `maxResultsPerPage<=100`,预估每次运行请求次数 = 推主数量 × ceil(maxItems/页面大小)
- 当需要更多分页时,遵循指数退避(1s/2s/4s)
- 在日志中记录 `next_token` 使用与剩余速率信息(若响应包含),并标记当前推主

## 开放问题
- 用户必须在 Composio 控制台完成 Twitter OAuth 并获得连接 ID 与 user id
- 若需要更复杂的查询(如地理位置、主题标签),后续可扩展配置 schema
