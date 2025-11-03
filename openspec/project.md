# Project Context

## Purpose
AI 新闻采集器 - 从 AIBase、知识星球、微信公众号与 Twitter 等数据源自动采集最新 AI 相关新闻,使用 DeepSeek LLM 根据用户提供的正反面样例进行智能评分和过滤,最终输出高质量新闻到 Markdown 文档。

**核心目标**:
- 自动化采集 AI 领域最新资讯
- 基于用户偏好的智能内容过滤
- 低成本运行 (每次约 $0.01-0.02)
- 生成结构化的 Markdown 报告

### 核心功能
- 多数据源采集: 当前内置 AIBase、知识星球、微信公众号、Twitter 采集器,默认启用微信公众号(其余可按需开启)
- DeepSeek LLM 评分: 结合 Few-shot 样例输出 0-10 分并附带评分理由
- 动态过滤策略: 自动保留得分最高的 10-30% 内容,默认目标 15 条
- Markdown 报告生成: 输出按数据源分组、带统计摘要的报告文件
- 成本与缓存监控: 统计 Token 使用、缓存命中率和预估成本

## Tech Stack
- **语言与运行时**: Node.js 18+ (LTS), 现代 JavaScript (ES2022, async/await)
- **模块系统**: ES Modules (`"type": "module"`, 导入必须包含 `.js`)
- **依赖管理**: npm + `package-lock.json` (无额外构建工具)
- **LLM 服务**: DeepSeek API (通过 OpenAI SDK `openai`, 支持 Prompt Caching)
- **网页抓取**:
  - Axios + Cheerio 处理静态页面
  - Puppeteer 处理动态加载场景
- **业务服务**: 自研 `LLMClient`, `Orchestrator`, `WeChatLoginService`
- **工具库**: dotenv (环境变量), string-similarity (文本去重, 规划中), 自定义 `retryWithBackoff`
- **日志**: 自定义彩色 Logger (`utils/logger.js`), 级别 DEBUG/INFO/WARN/ERROR/SUCCESS
- **输出与存储**: Markdown 报告 (`output/filtered-news-YYYYMMDD-HHmmss.md`), 本地 JSON 配置, `.wechat-token.json` 缓存登录态
- **测试框架**: Vitest (命令: `npm test`, `npm run test:unit|coverage|watch`)

## 配置与运行

### 环境变量
- `DEEPSEEK_API_KEY` (必填): DeepSeek API 密钥
- `COMPOSIO_API_KEY` (可选): Twitter 采集所需的 Composio API Key
- `COMPOSIO_CONNECTION_ID` (可选): Composio Twitter 连接 ID,形如 `ca_xxx`
- `COMPOSIO_USER_ID` (可选): 对应连接的 `user_id`,可通过脚本辅助查询
- `LLM_MODEL` / `LLM_TEMPERATURE` / `LLM_MAX_TOKENS` (可选): 覆盖 `LLMClient` 默认参数
- `ZSXQ_COOKIE` (可选): 采集知识星球时所需的 Cookie
- `WECHAT_TOKEN` / `WECHAT_COOKIE` (必填,启用微信公众号采集时): 公众号后台凭证,需手动从后台获取; 未配置将导致采集失败
- `DEBUG=1` (可选): 打开详细日志

### 配置文件
- `config/filter-rules-*.json`: 各数据源的 Few-shot 样例与阈值 (必须包含正反面样例)
- `config/wechat-accounts.json`: 待采集的公众号列表 (通过 `fakeid` 标识)
- `config/twitter-accounts.json`: Twitter 推主配置与查询参数 (默认忽略提交)
- `.env`: 环境变量定义,忽略提交
- `.wechat-token.json`: 运行期自动生成,缓存公众号 token/cookie (已设置 600 权限)

### 核心脚本
- `npm start`: 运行主流程 (单次执行)
- `npm run dev`: 监听模式,用于本地调试
- `npm test` / `npm run test:*`: 执行 Vitest 测试套件
- `npm run demo:twitter`: 使用 Composio 快速验证 Twitter 查询
- `npm run composio:connection`: 输出指定 Connection ID 对应的 `user_id`

### 输出与产物
- Markdown 报告默认写入 `output/filtered-news-YYYYMMDD-HHmmss.md`
- 运行日志仅输出在控制台,建议需要时重定向保存

## Project Conventions

### Code Style
1. **命名规范**:
   - 使用驼峰命名法 (camelCase) 用于变量和函数
   - 使用 PascalCase 用于类名
   - 使用 kebab-case 用于文件名
   - 使用中文注释说明关键逻辑

2. **代码组织**:
   - 每个文件职责单一,避免过大的类
   - 避免多层嵌套,优先使用提前返回 (early return)
   - 避免不必要的对象复制或克隆
   - 函数保持简短,超过 20 行考虑拆分

3. **格式规范**:
   - 使用 2 空格缩进
   - 单引号优于双引号
   - 行尾不添加分号 (除非必要)
   - 导入语句必须包含 `.js` 扩展名 (ESM 要求)
   - 优先使用 async/await,避免 Promise 回调地狱

4. **注释规范**:
   - 使用 JSDoc 风格注释公共 API
   - 关键节点和难懂代码必须添加中文注释
   - 注释解释"为什么"而非"做什么"

### 日志规范
- 使用 `createLogger(name)` 创建带前缀的 Logger,统一输出格式
- Level 约定: `info` 描述阶段进展, `warn` 表示可恢复异常, `error` 表示失败, `success` 用于阶段结果, `debug` 仅在调试时开启
- 彩色输出由 `utils/logger.js` 控制,必要时可通过 `DEBUG=1` 打开调试信息

### Architecture Patterns
1. **分层架构**:
   ```
   ├── collectors/   # 数据采集层 - 从外部数据源抓取数据
   ├── services/     # 业务逻辑层 - LLM 调用、流程编排
   ├── models/       # 数据模型层 - 数据验证和转换
   ├── config/       # 配置层 - 配置加载和管理
   ├── output/       # 输出层 - 生成 Markdown 报告
   ├── storage/      # 状态存储层 - 本地 token、缓存
   └── utils/        # 工具层 - 日志、时间、延迟等通用工具
   ```
  - `collectors/`: 包含 `BaseCollector` 抽象类及 `AIBaseCollector`、`ZSXQCollector`、`WeChatMPCollector`、`TwitterCollector`
   - `services/`: `Orchestrator` 编排评分流程, `LLMClient` 调用 DeepSeek API, `WeChatLoginService` 加载公众号凭证, `retry.js` 提供指数退避
   - `models/`: `NewsItem` 数据模型与批量验证函数
   - `storage/`: `TokenStore` 负责 `.wechat-token.json` 的读写与权限控制
   - `output/`: `MarkdownGenerator` 输出报告,按数据源分组渲染
   - `utils/`: 日志、延迟辅助方法、随机延迟生成器等工具函数

2. **设计模式**:
   - **基类模式**: `BaseCollector` 抽象类供所有采集器继承
   - **策略模式**: 不同数据源实现不同采集策略
   - **编排器模式**: `Orchestrator` 协调采集-评分-过滤流程
   - **建造者模式**: `PromptBuilder` 构建 LLM 提示词

3. **错误处理**:
   - 使用 `retryWithBackoff` 指数退避重试机制 (3 次重试,最大延迟 30 秒,按需记录重试日志)
   - 网络错误和超时错误自动重试
   - 关键错误记录完整堆栈并终止程序

4. **数据流**:
   ```
   数据源 → 采集器 → 验证 → LLM 评分 → 动态过滤 → Markdown 输出
   ```

### Testing Strategy
- **测试框架**: Vitest
- **测试命令**:
  - `npm test`: 运行所有测试
  - `npm run test:unit`: 单次运行单元测试
  - `npm run test:coverage`: 生成覆盖率报告
  - `npm run test:watch`: 监听模式
- **测试原则**:
  - 优先测试核心业务逻辑 (评分、过滤算法)
  - 对外部依赖 (LLM API、网络请求) 进行 Mock
  - 确保边界条件和异常情况的测试覆盖
  - 测试文件统一放在 `tests/` 目录,命名 `*.test.js` (计划补齐)

### Git Workflow
- **主分支**: 直接在主分支开发 (单人项目)
- **分支命名**: 功能分支使用 `feature-name` 格式
- **提交规范**:
  - 使用中文提交信息
  - 提交信息应简洁明了,说明修改内容和原因
  - 每次提交保持原子性,一次只做一件事

## Domain Context

### AI 新闻采集领域知识
1. **数据源特点**:
   - AIBase: 国内主流 AI 资讯网站,需要处理动态加载内容
   - 网页结构可能频繁变化,需要定期维护选择器
   - 微信公众号: 需维护 token/cookie、处理过期与接口限流 (`rateLimit` 随机延迟 3-5s)
   - Twitter: 通过 Composio `TWITTER_RECENT_SEARCH` 接口拉取推文,依赖连接 ID 与 user_id,默认抓取近 7 天内容

2. **新闻质量评估**:
   - 技术突破 > 产品发布 > 商业新闻 > 日常更新
   - 开源项目和实用工具具有较高价值
   - 融资新闻和版本更新日志通常价值较低

3. **LLM 评分机制**:
   - 采用 Few-shot Learning 方式,通过正反面样例引导模型评分
   - 评分范围 1-10,分数越高表示新闻质量越好
   - 使用 DeepSeek 模型的 Prompt Caching 功能降低成本
   - 统一使用 JSON Mode (`response_format: json_object`),由 `parseResponse` 解包并校验字段

4. **动态过滤策略**:
   - 保留得分最高的 10-30% 新闻
   - 默认期望保留 15 条左右
   - 根据实际采集数量动态调整阈值
   - 评分异常 (`error` 或 `score <= 0`) 会被自动剔除

### 关键数据模型
- **NewsItem**: 包含 id, title, summary, url, publishedAt, source
- **FilterConfig**: 包含 positiveExamples, negativeExamples, thresholdConfig
- **ScoredResult**: 包含 newsId, score, reason, tokenUsage

## Important Constraints

### 技术约束
1. **Node.js 版本**: 必须 >= 18.0.0 (使用 ESM 和现代 API)
2. **模块系统**: 必须使用 ES Modules,所有导入必须包含 `.js` 扩展名
3. **无数据库**: 项目采用文件系统存储,配置为 JSON,输出为 Markdown
4. **数据源统一**: 同一变量不在不同位置重复声明,保持单一数据源
5. **登录状态**: `.wechat-token.json` 仅供运行期缓存,需保持 600 权限且每次登录刷新

### 业务约束
1. **成本控制**:
   - DeepSeek API 成本极低,但仍需优化 token 使用
   - 利用 Prompt Caching 降低重复内容的成本
   - 批量处理减少 API 调用次数

2. **样例要求**:
   - 正反面样例各至少 1 个
   - 摘要必须 100-200 字符 (严格要求)
   - 标题 1-200 字符

3. **过滤策略**:
   - 最少保留 10%,最多保留 30%
   - 默认期望保留 15 条
   - 自动过滤评分失败或分数 <= 0 的新闻

### 性能约束
1. **批量处理**: 默认每批处理 10 条新闻
2. **重试机制**: 最多重试 3 次,避免无限重试
3. **超时控制**: 网络请求应设置合理超时时间

## External Dependencies

### 核心外部服务
1. **DeepSeek API**:
   - 端点: https://api.deepseek.com
   - 认证: API Key (环境变量 `DEEPSEEK_API_KEY`)
   - 模型: `deepseek-chat` (默认)
   - 定价: Input $0.27/1M tokens, Output $1.10/1M tokens
   - 特性: 支持 Prompt Caching (缓存命中成本仅 10%)
2. **微信公众号后台**:
   - 端点: `https://mp.weixin.qq.com/cgi-bin/appmsgpublish`
   - 认证: token + cookie,需在公众号后台获取后配置到环境变量
   - 限流: 采用 3-5s 随机延迟,避免触发风控
   - Token 生命周期约 7 天,过期后触发重新登录并刷新 `.wechat-token.json`
3. **Composio 平台**:
   - 端点: https://api.composio.dev
   - 认证: API Key (环境变量 `COMPOSIO_API_KEY`)
   - 用途: 统一管理 Twitter OAuth 连接,调用 `TWITTER_RECENT_SEARCH` 等工具
   - 需在 `.env` 中维护 `COMPOSIO_CONNECTION_ID` 与 `COMPOSIO_USER_ID`

### 数据源网站
- **AIBase**: https://www.aibase.com, 静态页面,易受结构变动影响
- **知识星球**: https://api.zsxq.com / https://wx.zsxq.com, 依赖有效 Cookie
- **微信公众号**: https://mp.weixin.qq.com, 文章列表通过后台接口返回
- **Twitter**: https://api.x.com/2, 通过 Composio 转发,受官方速率限制影响

### 开发依赖
- **axios**: HTTP 客户端,用于静态页面抓取
- **cheerio**: HTML 解析器,类似 jQuery 的 API
- **puppeteer**: 无头浏览器,用于处理动态加载内容
- **openai**: OpenAI SDK,用于调用 DeepSeek API (兼容 OpenAI 接口)
- **@composio/core**: Composio 官方 SDK,用于执行 Twitter 工具
- **string-similarity**: 文本相似度计算,用于去重
- **dotenv**: 环境变量加载

### 配置文件
- **环境变量**: `.env` (包含 API Key 等敏感信息,已忽略)
- **过滤规则**: `config/filter-rules-*.json` (按数据源拆分的样例与阈值)
- **公众号列表**: `config/wechat-accounts.json` (需从示例文件复制后维护)
- **数据源配置**: `src/config/datasources.js` (启用/禁用采集器、超时等)
- **运行缓存**: `.wechat-token.json` (运行时生成,缓存 token/cookie,不入库)
