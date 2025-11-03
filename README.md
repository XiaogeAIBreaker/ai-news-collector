# AI 新闻采集器

轻量级 AI 新闻采集器 - 从 AIBase、知识星球、微信公众号等数据源采集最新的 AI 相关新闻,使用 DeepSeek LLM 根据用户提供的正反面样例进行智能过滤,输出高质量新闻到 Markdown 文档。

## 功能特性

- ✅ **多数据源采集**: 支持 AIBase、知识星球、微信公众号和 Twitter,可扩展更多数据源
- ✅ **智能采集**: 自动抓取最新 AI 新闻和社群讨论
- ✅ **微信公众号采集**: 通过二维码扫码登录,零配置采集公众号文章
- 🆕 **Twitter 采集**: 基于 Composio 一键接入,支持关注推主与关键词搜索
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
- (可选) 微信公众号 Token/Cookie - 如需采集公众号文章(个人订阅号即可)
- (可选) Composio API Key + Twitter 连接 ID/user_id - 如需采集 Twitter 资讯

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

# 可选: Twitter 采集所需的 Composio 凭证
# COMPOSIO_API_KEY=ak_xxxxxxxxxxxxx
# COMPOSIO_CONNECTION_ID=ca_xxxxxxxxxxxxx
# COMPOSIO_USER_ID=pg-test-xxxxxxxxxxxxxxx

# 可选:知识星球 Cookie (如需采集知识星球内容)
# ZSXQ_COOKIE=your_zsxq_cookie_here
```

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

**配置微信公众号采集**(可选):

**第一步: 获取 Token 和 Cookie**

1. 浏览器登录微信公众号后台 https://mp.weixin.qq.com/
2. 打开浏览器开发者工具 (F12 或 Command+Option+I)
3. 从 URL 中复制 `token` 参数
4. 从 Network → Headers → Cookie 中复制完整的 Cookie 值
5. 添加到 `.env` 文件

详细图文教程: [如何获取微信公众号 Token 和 Cookie](docs/how-to-get-wechat-token.md)

**快速配置**:

编辑 `.env` 文件,添加以下配置:
```bash
WECHAT_TOKEN=你的token值
WECHAT_COOKIE=完整的cookie字符串
```

示例:
```bash
WECHAT_TOKEN=1234567890
WECHAT_COOKIE=slave_user=gh_xxxxx; slave_sid=xxxxx; bizuin=xxxxx
```

**第二步: 配置要采集的公众号**

编辑 `config/wechat-accounts.json` 文件:

```bash
# 如果文件不存在,从示例文件复制
cp config/wechat-accounts.example.json config/wechat-accounts.json

# 编辑配置
vim config/wechat-accounts.json
```

添加要采集的公众号:
```json
[
  {
    "fakeid": "MzI1NjIyMTAwMA==",
    "nickname": "AI科技评论"
  },
  {
    "fakeid": "MzUxOTU3NjE4MA==",
    "nickname": "量子位"
  }
]
```

**如何获取 Fakeid**:
1. 登录你的公众号后台 https://mp.weixin.qq.com/
2. 进入"素材管理" → "新建图文消息"
3. 点击"超链接" → "文章链接"
4. 搜索目标公众号名称
5. 打开 DevTools (F12) → Network 标签
6. 从请求 URL 中复制 `fakeid` 参数

**注意**: Token 有效期约 7 天,过期后需要重新获取

**配置 Twitter 采集**(可选):

1. 登录 [Composio 控制台](https://app.composio.dev/),在 Settings → API Keys 中创建 API Key 并写入 `.env`。
2. 在 Connections 页面搜索 Twitter,完成 OAuth 授权后复制 Connection ID(`ca_xxx`)。
3. 运行 `npm run composio:connection` 或查看连接详情,将输出的 `user_id` 填入 `.env` 的 `COMPOSIO_USER_ID`。
4. 复制示例配置: `cp config/twitter-accounts.example.json config/twitter-accounts.json`
5. 编辑 `config/twitter-accounts.json`,填写需要关注的推主。未配置推主时会使用 `keywords` 列表进行回退搜索。

> ⚠️ `config/twitter-accounts.json` 已在 `.gitignore` 中排除,请勿提交包含个人账号信息的配置

### 4. 配置过滤规则

编辑 \`config/filter-rules.json\` 文件,设置你的正反面样例:

```json
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
```

### 5. 运行程序

```bash
npm start
```

程序会自动:
1. 从启用的数据源(AIBase/知识星球/微信公众号)采集最新内容
2. 加载微信 Token 配置(如已配置)
3. 使用 LLM 对所有内容进行混合评分
4. 过滤出高质量内容
5. 生成带时间戳的 Markdown 报告(示例: \`output/filtered-news-20241102-203045.md\`)

## 项目结构

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
│   ├── wechat-accounts.json       # 微信公众号列表(已忽略提交)
│   └── twitter-accounts.json      # Twitter 推主配置(已忽略提交)
├── scripts/             # 实用脚本
│   ├── composio-connection-info.js # 辅助查询连接 user_id
│   └── twitter-demo.js            # Twitter 采集 Demo
├── output/              # 输出目录(自动保存带时间戳的 Markdown 报告)
├── .env.example         # 环境变量示例
└── package.json
```

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
- 在 `ZSXQ_CONFIG.config.groups` 中添加要采集的星球
- 为每个星球配置一个或多个话题(hashtags)
- 示例:
```javascript
{
  groupId: '15552545485212',  // 星球ID(从URL提取)
  groupName: 'AI风向标',       // 星球名称
  hashtags: [
    { id: '15555541155522', name: 'AI风向标' },
    { id: '15555541155523', name: '中标' }
  ]
}
```
- ⚠️ 知识星球话题接口单次最多返回 20 条,程序会根据 `maxItems` 自动降级并分批拉取

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

**预估成本**: 按默认配置(不超过 50 条新闻)运行一次完整流程,成本约 **$0.05-0.10**

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
```javascript
{
  groupId: 'your_group_id',     // 从星球URL中提取
  groupName: '星球名称',
  hashtags: [
    { id: '15555541155522', name: 'AI风向标' },
    { id: '15555541155523', name: '中标' }
  ]
}
```

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
