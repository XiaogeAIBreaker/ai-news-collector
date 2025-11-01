# AI 新闻采集器

轻量级 AI 新闻采集器 - 从 AIBase、知识星球等数据源采集最新的 AI 相关新闻,使用 DeepSeek LLM 根据用户提供的正反面样例进行智能过滤,输出高质量新闻到 Markdown 文档。

## 功能特性

- ✅ **多数据源采集**: 支持 AIBase 和知识星球,可扩展更多数据源
- ✅ **智能采集**: 自动抓取最新 AI 新闻和社群讨论
- ✅ **LLM 评分**: 使用 DeepSeek API 根据用户偏好对内容进行智能评分
- ✅ **动态过滤**: 自动保留得分最高的 10-30% 内容
- ✅ **配置化**: 通过 JSON 配置文件设置正反面样例
- ✅ **低成本**: 使用 DeepSeek API,每次运行约 $0.01-0.02
- ✅ **完整日志**: 彩色日志输出,清晰展示采集和过滤进度
- ✅ **按源分组**: Markdown 报告按数据源分组展示

## 快速开始

### 1. 环境要求

- Node.js 18+ (LTS 版本)
- DeepSeek API Key ([获取地址](https://platform.deepseek.com/api_keys))
- (可选) 知识星球 Cookie - 如需采集知识星球内容

### 2. 安装依赖

\`\`\`bash
npm install
\`\`\`

### 3. 配置环境变量

复制 \`.env.example\` 到 \`.env\` 并填入你的 API Key:

\`\`\`bash
cp .env.example .env
\`\`\`

编辑 \`.env\` 文件:

\`\`\`env
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# 可选:知识星球 Cookie (如需采集知识星球内容)
# ZSXQ_COOKIE=your_zsxq_cookie_here
\`\`\`

**获取知识星球 Cookie**:
1. 浏览器登录 https://wx.zsxq.com
2. 打开开发者工具 (F12) -> Network 标签
3. 刷新页面,找到请求 `https://api.zsxq.com` 开头的请求(例如 topics 请求)
4. 点击该请求,在右侧 Headers 面板中找到 "Cookie:" 请求头
5. 复制完整的 Cookie 值(必须包含 `zsxq_access_token` 字段)
6. 将复制的 Cookie 粘贴到 `.env` 文件中

**注意**:
- 不要使用 `document.cookie`,因为 `zsxq_access_token` 是 HttpOnly Cookie,无法通过 JavaScript 访问
- Cookie 示例格式: `zsxq_access_token=xxxxxxxxxx; sensorsdata2015jssdkcross=xxxxxxxxxx; abtest_env=product`

### 4. 配置过滤规则

编辑 \`config/filter-rules.json\` 文件,设置你的正反面样例:

\`\`\`json
{
  "positiveExamples": [
    {
      "title": "你想看到的新闻类型的标题",
      "summary": "新闻摘要(100-200字符)",
      "reason": "为什么喜欢这类新闻"
    }
  ],
  "negativeExamples": [
    {
      "title": "你不想看到的新闻类型的标题",
      "summary": "新闻摘要(100-200字符)",
      "reason": "为什么不喜欢这类新闻"
    }
  ]
}
\`\`\`

### 5. 运行程序

\`\`\`bash
npm start
\`\`\`

程序会自动:
1. 从启用的数据源(AIBase/知识星球)采集最新内容
2. 使用 LLM 对所有内容进行混合评分
3. 过滤出高质量内容
4. 生成 Markdown 报告到 \`output/filtered-news.md\`(按数据源分组展示)

## 项目结构

\`\`\`
ai-news-collector/
├── src/
│   ├── collectors/       # 数据采集器
│   │   ├── base.js      # 采集器基类
│   │   ├── aibase.js    # AIBase 采集器
│   │   └── zsxq.js      # 知识星球采集器
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
│   └── filter-rules.json  # 过滤规则
├── output/              # 输出目录
│   └── filtered-news.md   # 生成的报告
├── .env.example         # 环境变量示例
└── package.json
\`\`\`

## 配置说明

### 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| DEEPSEEK_API_KEY | 是 | - | DeepSeek API 密钥 |
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
- 在 \`ZSXQ_CONFIG.config.groups\` 中添加要采集的星球
- 每个星球可配置多个标签(tags)
- 示例:
\`\`\`javascript
{
  groupId: '15552545485212',  // 星球ID(从URL提取)
  groupName: 'AI风向标',       // 星球名称
  tags: ['中标', 'AI风向标']   // 要采集的标签列表
}
\`\`\`

### 过滤规则配置

配置文件: \`config/filter-rules.json\`

- **positiveExamples**: 正面样例(至少 1 个),表示你想看到的新闻类型
- **negativeExamples**: 反面样例(至少 1 个),表示你不想看到的新闻类型
- **keywords**: 关键词列表(可选),用于初筛
- **thresholdConfig**: 阈值配置
  - \`minPercentage\`: 最少保留百分比(默认 10%)
  - \`maxPercentage\`: 最多保留百分比(默认 30%)
  - \`preferredCount\`: 期望保留数量(默认 15 条)

### 样例要求

- 标题: 必填,1-200 字符
- 摘要: 必填,**100-200 字符**(严格要求)
- 理由: 可选,说明为什么喜欢/不喜欢

## 成本估算

使用 DeepSeek API 的成本极低:

- Input tokens: $0.27 / 1M tokens
- Output tokens: $1.10 / 1M tokens
- Cache hit tokens: $0.027 / 1M tokens (仅 10%)

**预估成本**: 每次采集 10 条新闻并评分,成本约 **$0.01-0.02**

## 常见问题

### 1. 如何启用/禁用数据源?

编辑 \`src/config/datasources.js\`:
- 设置 \`AIBASE_CONFIG.enabled = false\` 禁用 AIBase
- 设置 \`ZSXQ_CONFIG.enabled = false\` 禁用知识星球

### 2. 知识星球采集失败怎么办?

检查:
1. \`ZSXQ_COOKIE\` 是否正确设置
2. Cookie 是否过期(需要重新获取)
3. 账号是否有权访问配置的星球
4. 星球 ID 和标签名称是否正确

查看日志获取详细错误信息。

### 3. 为什么采集不到新闻?

可能的原因:
- 网站结构发生变化
- 网络连接问题
- HTML 选择器需要更新
- Cookie 认证失败(知识星球)

可以查看日志获取详细错误信息。

### 4. LLM 评分失败怎么办?

检查:
1. \`DEEPSEEK_API_KEY\` 是否正确
2. API 密钥是否有余额
3. 网络是否可以访问 DeepSeek API

### 5. 如何调整过滤阈值?

编辑 \`config/filter-rules.json\` 中的 \`thresholdConfig\`:
- 想要更多新闻: 增大 \`maxPercentage\` 或 \`preferredCount\`
- 想要更少但更精准: 减小 \`minPercentage\` 或 \`preferredCount\`

### 6. 如何添加更多知识星球?

编辑 \`src/config/datasources.js\` 中的 \`ZSXQ_CONFIG.config.groups\`,添加新的星球配置:
\`\`\`javascript
{
  groupId: 'your_group_id',     // 从星球URL中提取
  groupName: '星球名称',
  tags: ['标签1', '标签2']       // 要采集的标签
}
\`\`\`

## 技术栈

- **运行时**: Node.js 18+ (ESM)
- **LLM**: DeepSeek API (使用 OpenAI SDK)
- **网页抓取**: Cheerio + Axios
- **工具库**: dotenv, string-similarity

## 开发

### 调试模式

设置环境变量 \`DEBUG=1\` 可以查看更详细的日志。

### 添加新的数据源

1. 继承 \`BaseCollector\` 类
2. 实现 \`collect()\` 方法
3. 返回 \`NewsItem[]\` 数组
4. 在 \`datasources.js\` 注册

## License

MIT

## 支持

如有问题,请在 GitHub Issues 提交反馈。

