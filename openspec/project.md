# Project Context

## Purpose
AI 新闻采集器 - 从 AIBase 等数据源自动采集最新 AI 相关新闻,使用 DeepSeek LLM 根据用户提供的正反面样例进行智能评分和过滤,最终输出高质量新闻到 Markdown 文档。

**核心目标**:
- 自动化采集 AI 领域最新资讯
- 基于用户偏好的智能内容过滤
- 低成本运行 (每次约 $0.01-0.02)
- 生成结构化的 Markdown 报告

## Tech Stack
- **运行时**: Node.js 18+ (LTS 版本)
- **模块系统**: ES Modules (ESM)
- **LLM 服务**: DeepSeek API (通过 OpenAI SDK)
- **网页抓取**: Cheerio + Axios (静态页面)、Puppeteer (动态页面)
- **工具库**:
  - dotenv: 环境变量管理
  - string-similarity: 文本去重
- **测试框架**: Vitest
- **配置格式**: JSON
- **输出格式**: Markdown

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

4. **注释规范**:
   - 使用 JSDoc 风格注释公共 API
   - 关键节点和难懂代码必须添加中文注释
   - 注释解释"为什么"而非"做什么"

### Architecture Patterns
1. **分层架构**:
   ```
   ├── collectors/   # 数据采集层 - 从外部数据源抓取数据
   ├── services/     # 业务逻辑层 - LLM 调用、流程编排
   ├── models/       # 数据模型层 - 数据验证和转换
   ├── config/       # 配置层 - 配置加载和管理
   ├── output/       # 输出层 - 生成 Markdown 报告
   └── utils/        # 工具层 - 日志、重试等通用工具
   ```

2. **设计模式**:
   - **基类模式**: `BaseCollector` 抽象类供所有采集器继承
   - **策略模式**: 不同数据源实现不同采集策略
   - **编排器模式**: `Orchestrator` 协调采集-评分-过滤流程
   - **建造者模式**: `PromptBuilder` 构建 LLM 提示词

3. **错误处理**:
   - 使用指数退避重试机制 (3 次重试,最大延迟 30 秒)
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

### Git Workflow
- **主分支**: 直接在主分支开发 (单人项目)
- **分支命名**: 功能分支使用 `001-feature-name` 格式
- **提交规范**:
  - 使用中文提交信息
  - 提交信息应简洁明了,说明修改内容和原因
  - 每次提交保持原子性,一次只做一件事

## Domain Context

### AI 新闻采集领域知识
1. **数据源特点**:
   - AIBase: 国内主流 AI 资讯网站,需要处理动态加载内容
   - 网页结构可能频繁变化,需要定期维护选择器

2. **新闻质量评估**:
   - 技术突破 > 产品发布 > 商业新闻 > 日常更新
   - 开源项目和实用工具具有较高价值
   - 融资新闻和版本更新日志通常价值较低

3. **LLM 评分机制**:
   - 采用 Few-shot Learning 方式,通过正反面样例引导模型评分
   - 评分范围 1-10,分数越高表示新闻质量越好
   - 使用 DeepSeek 模型的 Prompt Caching 功能降低成本

4. **动态过滤策略**:
   - 保留得分最高的 10-30% 新闻
   - 默认期望保留 15 条左右
   - 根据实际采集数量动态调整阈值

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

2. **数据源网站**:
   - AIBase: https://www.abase.com (主要数据源)
   - 可能需要处理反爬机制
   - HTML 结构变化时需要更新选择器

### 开发依赖
- **axios**: HTTP 客户端,用于静态页面抓取
- **cheerio**: HTML 解析器,类似 jQuery 的 API
- **puppeteer**: 无头浏览器,用于处理动态加载内容
- **openai**: OpenAI SDK,用于调用 DeepSeek API (兼容 OpenAI 接口)
- **string-similarity**: 文本相似度计算,用于去重
- **dotenv**: 环境变量加载

### 配置文件
- **环境变量**: `.env` (包含 API Key 等敏感信息,已忽略)
- **过滤规则**: `config/filter-rules.json` (正反面样例和阈值配置)
- **数据源配置**: `src/config/datasources.js` (数据源注册)
