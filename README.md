<div align="center">
    <h1>🌱 信息收集过滤器</h1>
</div>

<p align="center">
    <strong>致力于从海量资讯中，筛选出精准有效的信息，提升信息获取效率</strong>
</p>

---

![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-3C873A)
![License](https://img.shields.io/badge/license-MIT-blue)
![Status](https://img.shields.io/badge/status-active-brightgreen)

## 🤔 干啥的？

公众号、知识星球、各大资讯站、特推...

信息量爆炸？一条条刷？低质量营销号？没时间？漏消息？...

**AI 信息采集过滤器统统，分分钟给你搞定🤓**

## 🔥 功能特性

- ✅ **多数据源采集**: 目前支持 AIBase、知识星球、微信公众号、Twitter...(以后会支持更多)
- ✅ **LLM 评分**: 使用 DeepSeek API 根据用户偏好对内容进行智能评分
- ✅ **动态过滤**: 自动保留得分最高的 10-30% 内容
- ✅ **配置化**: 通过 JSON 配置文件设置正反面样例
- ✅ **低成本**: 使用 DeepSeek API，每次运行约 几毛钱
- ✅ **完整日志**: 彩色日志输出,清晰展示采集和过滤进度
- ✅ **按源分组**: Markdown 报告按数据源分组展示
- ✅ **统一时间窗口**: 可自行选择采集n天的数据

## ⚡️ 快速开始

### 1. 前置依赖

- Node.js 18+
- DeepSeek API Key ([获取地址](https://platform.deepseek.com/api_keys))
- (可选) 知识星球账号
- (可选) 微信公众号账号
- (可选) Twitter账号（需要网络环境）

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 \`.env.example\` 到 \`.env\` 并填入你的 API Key:

```bash
cp .env.example .env
```

编辑 \`.env\` 文件:

```env
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

WECHAT_TOKEN=xxxxxxx
WECHAT_COOKIE='xxxxxxxxxxx'

ZSXQ_COOKIE='xxxxxxxxxxx'

COMPOSIO_API_KEY=xxxxxxxxx
COMPOSIO_CONNECTION_ID=xxxxxxxxx
COMPOSIO_USER_ID=xxxxxxxxx
```
如何配置请见👇
[如何配置DeepSeek](docs/.env配置/如何配置DeepSeek.md)
[如何接入公众号](docs/.env配置/如何接入公众号.md)
[如何接入知识星球](docs/.env配置/如何接入知识星球.md)
[如何接入推特](docs/.env配置/如何接入推特.md)




### 5. 运行程序

```bash
npm start
```

程序会自动:
1. 读取启用的数据源配置 (AIBase / 知识星球 / 微信公众号 / Twitter)
2. 统一应用采集时间窗口、并发控制等运行参数
3. 使用 DeepSeek LLM 结合正负向样例进行批量评分
4. 根据动态阈值保留重点新闻
5. 生成带时间戳的 Markdown 报告(示例: `output/filtered-news-20251102-223726.md`), 每个数据源以表格方式呈现

> 📄 **输出示例 (节选)**

```markdown
| 来源 | 标题 | 摘要 | 得分 | 互动指标 |
|------|------|------|------|----------|
| WeChat-MP · AI科技评论 | 百度推出的 AI 播客平台 | 一键将文字转换为播客, 支持多音色与字幕编辑, 快速生成高质量节目。 | 4.5 | 阅读量: 2.3万 |
| Twitter · AnthropicAI | Claude 代码助手正式发布 | 新增原生安装器, 稳定性提升并移除 Node.js 依赖。 | 4.2 | 点赞: 3.1k / 转推: 520 |
```

## 项目结构与架构

```
ai-news-collector/
├── src/
│   ├── collectors/       # 数据采集器
│   │   ├── base.js      # 采集器基类
│   │   ├── aibase.js    # AIBase 采集器
│   │   ├── zsxq.js      # 知识星球采集器
│   │   ├── wechat-mp.js # 微信公众号采集器
│   │   └── twitter.js   # Twitter 采集器
│   ├── services/        # 核心服务
│   │   ├── llm-client.js    # LLM 客户端
│   │   ├── orchestrator.js  # 流程编排器
│   │   └── retry.js     # 重试机制
│   ├── models/          # 数据模型
│   │   └── news-item.js # 新闻条目模型
│   ├── config/          # 配置管理
│   │   ├── loader.js    # 配置加载器
│   │   └── datasources.js  # 数据源配置
│   ├── output/          # 输出模块
│   │   └── markdown.js  # Markdown 生成器
│   ├── utils/           # 工具类
│   │   └── logger.js    # 日志工具
│   └── index.js         # CLI 入口
├── config/              # 配置文件
│   ├── filter-rules-*.json        # 各数据源过滤规则
│   ├── wechat-accounts.json       # 微信公众号列表(默认忽略提交)
│   ├── twitter-accounts.json      # Twitter 推主配置
│   └── zsxq-groups.json           # 知识星球星球与话题配置
├── scripts/             # 实用脚本
│   ├── composio-connection-info.js # 辅助查询连接 user_id
│   └── twitter-demo.js            # Twitter 采集 Demo
├── output/              # 输出目录(自动保存带时间戳的 Markdown 报告)
├── .env.example         # 环境变量示例
└── package.json
```

```mermaid
flowchart LR
  subgraph Collectors[采集层]
    Aibase[AIBase Collector]
    Zsxq[ZSXQ Collector]
    Wechat[WeChat MP Collector]
    Twitter[Twitter Collector]
  end
  Collectors -->|NewsItem array| Orchestrator
  Orchestrator[Orchestrator 服务]
  Orchestrator --> LLM[LLM Client]
  Orchestrator --> Filters[Filter Rules]
  Orchestrator --> Markdown[Markdown Generator]
  Markdown --> Report[带时间戳 Markdown 报告]
```

各模块职责概览:

- **Collectors**: 针对具体来源实现采集逻辑, 统一返回 `NewsItem` 数据结构。
- **Orchestrator**: 协调采集结果、批量评分与动态阈值过滤。
- **LLM Client**: 封装 DeepSeek API 调用、批次切分与重试机制。
- **Markdown Generator**: 负责将筛选后的新闻渲染为表格化周报与统计摘要。
- **Config Loader & Validators**: 统一读取 JSON 配置并提供结构化校验。

## 配置说明

### 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| DEEPSEEK_API_KEY | 是 | - | DeepSeek API 密钥 |
| COMPOSIO_API_KEY | 否 | - | Composio API Key, 用于调用 Twitter 工具 |
| COMPOSIO_CONNECTION_ID | 否 | - | Composio Twitter 连接 ID, 形如 `ca_xxx` |
| COMPOSIO_USER_ID | 否 | - | 连接对应的 `user_id`, 可通过 `npm run composio:connection` 获取 |
| ZSXQ_COOKIE | 否 | - | 知识星球 Cookie (采集知识星球时需要) |
| LLM_MODEL | 否 | deepseek-chat | 使用的模型 |
| LLM_MAX_TOKENS | 否 | 500 | 最大输出 token 数 |
| LLM_TEMPERATURE | 否 | 0.7 | 温度参数 |

### 数据源配置

配置文件: \`src/config/datasources.js\`

**启用/禁用数据源**:
- 修改对应配置的 \`enabled\` 字段为 \`true\` 或 \`false\`
- 例如,禁用知识星球: 将 \`ZSXQ_CONFIG.enabled\` 设为 \`false\`

**配置知识星球**:
- 在 `ZSXQ_CONFIG.config.groups` 中添加星球与话题, `groupId`/`hashtags[].id` 可从星球 URL 及接口返回中获取
- ⚠️ 知识星球话题接口单次最多返回 20 条, 程序会按 `maxItems` 自动分页采集
- 详细图文步骤见 [docs/setting-up-zsxq.md](docs/setting-up-zsxq.md)

**配置 Twitter**:
- 在 `TWITTER_CONFIG` 中开启 `enabled`,并确保 `.env` 中填入 Composio 凭证
- `config/twitter-accounts.json` 控制推主和关键词,默认每个推主/关键词最多保留 10 条
- 可通过 `maxItemsPerAccount`/`maxItemsPerKeyword` 自定义配额,全局总量会自动扩容
- 未配置推主时会回退到 `keywords` 列表执行搜索
- 时间窗口由 `config/collection-window.json` 控制,`twitter-accounts.json` 中的 `sinceHours` 字段仅保留向后兼容

### 全局采集时间窗口

- 所有数据源共用 `config/collection-window.json` 中的 `recentDays` 值,默认 7 天
- 修改该文件即可统一调整采集范围,无需分别修改各个数据源配置
- 如果配置缺失或数值无效,程序会回退到默认的 7 天并在日志中提示

### 过滤规则配置
每个数据源都有独立的过滤规则文件(位于 `config/filter-rules-*.json`):

- **positiveExamples**: 正面样例(至少 1 个),表示你想看到的新闻类型
- **negativeExamples**: 反面样例(至少 1 个),表示你不想看到的新闻类型
- **thresholdConfig**: 阈值配置
  - `minPercentage`: 最少保留百分比(默认 10%)
  - `maxPercentage`: 最多保留百分比(默认 30%)
  - `preferredCount`: 期望保留数量(默认 15 条)
- (可选) `keywords`: 若某些数据源需要额外关键词筛选,可按原格式添加

### 样例要求

- 标题: 必填,1-200 字符
- 摘要: 必填,**10-500 字符**(严格要求)
- 理由: 可选,说明为什么喜欢/不喜欢

## 贡献指南

我们采用 [OpenSpec](openspec/AGENTS.md) 协议化协作流程, 欢迎社区贡献者参与:

1. Fork 仓库并基于 `main` 创建特性分支 (命名建议 `feature/<topic>` )。
2. 使用 `openspec list` 了解现有提案或通过 `openspec create` 撰写新的变更说明。
3. 在改动前运行 `npm install`, 遵循项目编码规范与中文注释约定。
4. 提交前执行 `npm test`, 并在 PR 描述中说明修改动机、测试结果和影响面。
5. 遇到问题可通过 Issue / Discussions 反馈, 也欢迎贡献新的数据源、过滤策略或文档。

## License

MIT

## 支持

如有问题,请在 GitHub Issues 提交反馈。
