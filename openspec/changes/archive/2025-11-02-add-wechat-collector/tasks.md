# Implementation Tasks

本文档列出了实现微信公众号采集功能的具体任务。基于 wechat-article-exporter 项目的核心技术,使用公众号后台接口方式,通过**二维码扫码登录**实现零配置。

## Phase 1: 核心实现 (MVP)

### 1. 实现二维码登录服务
- **文件**: `src/services/wechat-login.js`
- **依赖**: 无
- **可并行**: 否
- **验证**: 能成功获取并显示二维码,完成登录流程

**任务清单**:
- [x] 创建 `WeChatLoginService` 类
- [x] 实现 `startLogin()` 方法:
  - 调用 `/cgi-bin/bizlogin?action=startlogin` 获取 uuid
  - 构建二维码 URL: `https://mp.weixin.qq.com/cgi-bin/loginqrcode?action=getqrcode&uuid={uuid}`
  - 返回二维码 URL 和 uuid
- [x] 实现 `checkLoginStatus(uuid)` 方法:
  - 调用 `/cgi-bin/bizlogin?action=ask&uuid={uuid}` 轮询状态
  - 解析响应中的 `status` 字段(0=成功, 1=等待扫码, 2=已扫码待确认)
  - 返回状态和相关信息
- [x] 实现 `completeLogin(uuid)` 方法:
  - 调用 `/cgi-bin/bizlogin?action=login&uuid={uuid}` 完成登录
  - 从响应的 `redirect_url` 中提取 `token` 参数
  - 从响应头的 `Set-Cookie` 中提取完整 cookie 字符串
  - 返回 token 和 cookie 对象
- [x] 实现 `login()` 主流程方法:
  - 调用 startLogin 获取二维码
  - 显示二维码(调用 qrcode-display 工具)
  - 轮询检查登录状态(每 2-3 秒)
  - 检测超时(2 分钟)
  - 登录成功后调用 completeLogin
  - 返回完整的登录信息

### 2. 实现二维码显示工具
- **文件**: `src/utils/qrcode-display.js`
- **依赖**: 无
- **可并行**: 可与任务 1 并行
- **验证**: 能在终端或浏览器中显示二维码

**任务清单**:
- [x] 安装依赖: `npm install qrcode-terminal qrcode`
- [x] 创建 `QRCodeDisplay` 工具类
- [x] 实现 `displayInTerminal(url)` 方法:
  - 使用 `qrcode-terminal` 在终端显示 ASCII 二维码
  - 设置选项: `{ small: true }` 使二维码更紧凑
  - 捕获显示错误
- [x] 实现 `displayInBrowser(url)` 方法:
  - 使用 `qrcode` 生成二维码图片(Data URL)
  - 创建简单的 HTML 页面嵌入二维码
  - 自动打开默认浏览器
- [x] 实现 `display(url)` 主方法:
  - 优先尝试终端显示
  - 如果终端显示失败,回退到浏览器显示
  - 打印提示信息:"请使用微信扫一扫功能扫描二维码"

### 3. 实现 Token 本地存储
- **文件**: `src/storage/token-store.js`
- **依赖**: 无
- **可并行**: 可与任务 1-2 并行
- **验证**: 能正确保存和读取 token

**任务清单**:
- [x] 创建 `TokenStore` 类
- [x] 定义 token 文件路径: `.wechat-token.json`(项目根目录)
- [x] 实现 `save(tokenData)` 方法:
  - 构建 token 对象包含:
    - `token`: 公众号后台 token
    - `cookie`: 完整 cookie 字符串
    - `nickname`: 登录的公众号名称(可选)
    - `expires_at`: 过期时间(当前时间+7天)
    - `created_at`: 创建时间
  - 保存为 JSON 格式
  - 设置文件权限为 600(仅当前用户可读写)
- [x] 实现 `load()` 方法:
  - 读取 `.wechat-token.json` 文件
  - 解析 JSON
  - 验证数据结构
  - 检查是否过期
  - 捕获文件不存在、JSON 解析错误等异常
  - 返回 token 数据或 null
- [x] 实现 `exists()` 方法:检查 token 文件是否存在
- [x] 实现 `delete()` 方法:删除 token 文件
- [x] 确保 `.wechat-token.json` 已加入 `.gitignore`

### 4. 创建 WeChatMPCollector 基础类
- **文件**: `src/collectors/wechat-mp.js`
- **依赖**: 任务 1, 2, 3
- **可并行**: 否
- **验证**: 类可实例化,能自动处理登录流程

**任务清单**:
- [x] 创建 `WeChatMPCollector` 类并继承 `BaseCollector`
- [x] 在构造函数中初始化:
  - 配置参数(从 config 中读取)
  - 登录服务实例 `WeChatLoginService`
  - Token 存储实例 `TokenStore`
  - 公众号列表 `accounts`
- [x] 实现 `ensureAuthenticated()` 方法:
  - 尝试从 TokenStore 加载已有 token
  - 如果 token 存在且未过期,直接使用
  - 如果 token 不存在或已过期,触发登录流程
  - 调用 `WeChatLoginService.login()` 获取新 token
  - 将新 token 保存到 TokenStore
- [x] 实现 token 过期自动重新登录:
  - 在接口调用返回 ret=200003 时
  - 自动调用 `ensureAuthenticated()` 重新登录
  - 重试原请求
- [x] 添加类级别的 JSDoc 注释说明使用公众号后台接口

### 5. 实现 appmsgpublish 接口调用
- **文件**: `src/collectors/wechat-mp.js`
- **依赖**: 任务 4
- **可并行**: 否
- **验证**: 能成功调用微信 API 并获取原始响应

**任务清单**:
- [x] 实现 `collect()` 方法作为主入口:
  - 调用 `ensureAuthenticated()` 确保已登录
  - 循环处理所有已启用的公众号
  - 对每个公众号调用 `fetchArticleList()`
  - 汇总所有文章
- [x] 实现 `fetchArticleList(account, begin = 0)` 方法
- [x] 构建请求参数:
  - `sub`: 'list' (固定)
  - `search_field`: 'null' (固定)
  - `begin`: 分页起始位置
  - `count`: 每页数量(默认 10)
  - `query`: '' (空字符串)
  - `fakeid`: 公众号 ID
  - `type`: '101_1' (固定)
  - `free_publish_type`: 1 (固定)
  - `sub_action`: 'list_ex' (固定)
  - `token`: 从 TokenStore 获取
  - `lang`: 'zh_CN'
  - `f`: 'json'
  - `ajax`: 1
- [x] 设置请求头:
  - `Referer`: 'https://mp.weixin.qq.com/'
  - `Origin`: 'https://mp.weixin.qq.com'
  - `User-Agent`: 标准浏览器 UA
  - `Cookie`: 从 TokenStore 获取
- [x] 使用 `this.retryWithBackoff()` 包装 HTTP 请求
- [x] 检查响应的 `base_resp.ret` 状态码:
  - 0=成功,继续处理
  - 200003=token 过期,触发重新登录
  - 其他错误码,记录日志并跳过

### 6. 实现多层 JSON 解析逻辑
- **文件**: `src/collectors/wechat-mp.js`
- **依赖**: 任务 5
- **可并行**: 否
- **验证**: 能正确提取 appmsgex 数组

**任务清单**:
- [x] 实现 `parseResponse(response)` 方法
- [x] 第一层解析: `publish_page = JSON.parse(response.publish_page)`
- [x] 提取 `total_count` 和 `publish_list` 数组
- [x] 过滤出包含 `publish_info` 的项: `filter(item => !!item.publish_info)`
- [x] 第二层解析: 对每个 item,`publish_info = JSON.parse(item.publish_info)`
- [x] 第三层提取: 从 `publish_info.appmsgex` 数组中获取文章列表
- [x] 使用 `flatMap` 将所有文章合并为一维数组
- [x] 添加详细的错误处理和日志,定位解析失败的层级

### 7. 实现文章数据转换为 NewsItem
- **文件**: `src/collectors/wechat-mp.js`
- **依赖**: 任务 6
- **可并行**: 否
- **验证**: 转换的文章能通过 NewsItem 验证

**任务清单**:
- [x] 实现 `convertToNewsItems(articles, accountName)` 方法
- [x] 对每个 appmsgex 对象:
  - 提取 `title` 字段作为标题
  - 提取 `digest` 字段作为摘要(为空则使用标题)
  - 提取 `link` 字段作为 URL(补全协议如需要)
  - 提取 `update_time` 或 `create_time` 转为 Date(乘以1000)
  - 设置 `source` 为公众号名称
- [x] 构建 metadata 对象,包含:
  - `aid`: 文章唯一 ID
  - `appmsgid`: 文章消息 ID
  - `author_name`: 作者
  - `copyright_stat`: 版权状态
  - `cover`: 封面图
  - `itemidx`: 文章索引
  - `album_id`: 合集 ID
  - `item_show_type`: 展示类型
- [x] 创建 NewsItem 对象
- [x] 使用 `this.validateNewsItems()` 验证,过滤无效数据

### 8. 添加微信 MP 数据源配置
- **文件**: `src/config/datasources.js`
- **依赖**: 无
- **可并行**: 可与任务 1-7 并行
- **验证**: 配置能被正确加载

**任务清单**:
- [x] 在 `datasources.js` 中添加 `WECHAT_MP_CONFIG` 对象
- [x] 配置基础字段:
  - `name: 'WeChat-MP'`
  - `type: 'api'`
  - `enabled: true`
  - `maxItems: 20`
  - `timeout: 30000`
- [x] 在 `config` 中配置:
  - `apiUrl`: 'https://mp.weixin.qq.com/cgi-bin/appmsgpublish'
  - `accounts`: [] (公众号数组,每个包含 fakeid, nickname, enabled)
  - `rateLimit`: { minDelay: 3000, maxDelay: 5000 }
- [x] 在 `getEnabledDataSources()` 中添加 `WECHAT_MP_CONFIG`
- [x] 在 `getDataSourceByName()` 中添加映射
- [x] 导出 `WECHAT_MP_CONFIG`
- [x] 添加配置示例注释

### 9. 实现频率控制
- **文件**: `src/collectors/wechat-mp.js`
- **依赖**: 任务 4
- **可并行**: 可与任务 5-7 并行
- **验证**: 公众号之间有适当延迟

**任务清单**:
- [x] 实现 `delay(ms)` 辅助方法,返回 Promise
- [x] 实现 `getRandomDelay(min, max)` 生成随机延迟
- [x] 在采集每个公众号后调用延迟
- [x] 从配置中读取 `rateLimit` 参数
- [x] 记录延迟日志: "等待 X 秒后继续..."

### 10. 更新 .gitignore 文件
- **文件**: `.gitignore`
- **依赖**: 无
- **可并行**: 可与所有任务并行
- **验证**: `.wechat-token.json` 不会被提交到 Git

**任务清单**:
- [x] 在 `.gitignore` 中添加:
  ```
  # 微信登录 token(自动生成)
  .wechat-token.json
  ```

### 11. 编写使用文档
- **文件**: `docs/wechat-mp-guide.md`
- **依赖**: 任务 1-10
- **可并行**: 可在任务 1-10 完成后并行
- **验证**: 文档完整清晰

**任务清单**:
- [x] 创建文档,说明功能特点和优势:
  - 零配置:通过二维码扫码自动登录
  - 无需手动获取任何参数
  - Token 自动管理和刷新
  - 对比传统抓包方案的优势
- [x] 提供完整的使用流程:
  1. 准备工作:注册微信公众号(个人订阅号即可,无需认证)
  2. 首次运行:程序会自动显示二维码,使用微信扫码登录
  3. 配置公众号:在配置文件中添加要采集的公众号 fakeid 和名称
  4. 运行采集:自动采集所有配置的公众号文章
- [x] 说明 Fakeid 获取方式:
  - 登录公众号后台
  - 在"新建图文素材"中搜索目标公众号
  - 从浏览器开发者工具的 Network 请求中提取 fakeid
  - 提供常见 AI 公众号的 fakeid 示例
- [x] 提供配置示例:
  ```javascript
  accounts: [
    {
      fakeid: 'MzI1NjIyMTAwMA==',
      nickname: 'AI科技评论',
      enabled: true
    }
  ]
  ```
- [x] 添加限制和注意事项:
  - 需要公众号账号(个人订阅号即可)
  - Token 自动管理,但长时间不用会过期(过期时自动重新登录)
  - 建议合理控制采集频率
  - 仅供学习研究使用
- [x] 添加常见问题和故障排查:
  - Q: 二维码无法显示怎么办?
  - Q: Token 过期怎么办?(自动重新登录)
  - Q: 如何找到目标公众号的 fakeid?
  - Q: 是否需要认证公众号?(不需要,个人订阅号即可)
  - Q: 可以采集多少个公众号?(无限制,建议控制在10个以内)

### 12. 集成测试
- **文件**: `src/index.js` (主程序入口)
- **依赖**: 任务 1-11
- **可并行**: 否
- **验证**: 能成功运行完整的采集流程

**任务清单**:
- [x] 首次运行测试(无 token 文件):
  - 验证程序自动显示二维码
  - 使用测试公众号扫码登录
  - 验证 token 成功保存到 `.wechat-token.json`
- [x] 配置至少一个测试公众号的 fakeid
- [x] 运行完整采集流程,验证微信 MP 数据源被调用
- [x] 检查日志输出:
  - 登录状态检查
  - Token 加载
  - 接口调用
  - JSON 解析
  - 文章数量
- [x] 检查采集的文章数据格式
- [x] 验证采集的文章能通过 LLM 评分
- [x] 验证过滤后的文章能输出到 Markdown
- [x] 测试二次运行(已有 token):
  - 验证直接使用已保存的 token,不再显示二维码
  - 验证采集正常工作
- [x] 测试错误场景:
  - Token 文件损坏(删除或修改文件内容)
  - Token 过期(手动修改 expires_at 为过去时间)
  - Fakeid 无效
  - 网络超时
  - 二维码超时(2分钟不扫码)
- [x] 验证 token 过期自动重新登录:
  - 模拟接口返回 ret=200003
  - 验证自动显示二维码
  - 扫码后验证采集继续
- [x] 验证错误不影响其他数据源(AIBase, 知识星球)
- [x] 验证多公众号配置正常工作
- [x] 验证频率控制生效

## Phase 2: 增强功能 (可选)

### 13. 支持关键词搜索文章
- **文件**: `src/collectors/wechat-mp.js`
- **依赖**: Phase 1 完成
- **可并行**: 否
- **验证**: 能通过关键词筛选文章

**任务清单**:
- [ ] 在配置中添加 `keyword` 可选字段
- [ ] 修改请求参数:
  - `sub`: 'search' (搜索模式)
  - `search_field`: '7'
  - `query`: keyword
- [ ] 更新文档说明搜索功能
- [ ] 注意: 搜索结果不应写入缓存

### 14. 获取文章统计数据
- **文件**: `src/collectors/wechat-mp.js`
- **依赖**: Phase 1 完成
- **可并行**: 可与任务 13 并行
- **验证**: 能获取阅读数和点赞数

**任务清单**:
- [ ] 添加配置开关: `fetchStats: false`
- [ ] 实现 `fetchArticleStats(articleUrl)` 方法
- [ ] 调用 `/mp/getappmsgext` API
- [ ] 解析 `read_num`, `like_num`, `old_like_num`
- [ ] 将统计数据保存在 NewsItem 的 metadata 中
- [ ] 实现统计 API 的频率控制(3-5秒延迟)
- [ ] 处理统计 API 失败场景,不影响文章采集

### 15. 实现公众号搜索功能
- **文件**: `src/utils/wechat-search.js`
- **依赖**: Phase 1 完成
- **可并行**: 可与任务 13-14 并行
- **验证**: 能通过名称搜索公众号获取 fakeid

**任务清单**:
- [ ] 创建独立的搜索工具
- [ ] 调用公众号后台的搜索 API
- [ ] 返回公众号列表(包含 fakeid, nickname, avatar)
- [ ] 提供 CLI 命令方便用户搜索
- [ ] 更新文档说明搜索功能

## 验证检查清单

### 二维码登录功能
- [ ] 能成功调用 `/cgi-bin/bizlogin?action=startlogin` 获取二维码
- [ ] 二维码能在终端正确显示(ASCII 格式)
- [ ] 如果终端显示失败,能回退到浏览器显示
- [ ] 能正确轮询登录状态(action=ask)
- [ ] 登录成功后能正确提取 token 和 cookie
- [ ] Token 能正确保存到 `.wechat-token.json` 文件
- [ ] 二次运行时能自动加载已保存的 token,不再显示二维码
- [ ] Token 过期时能自动触发重新登录流程
- [ ] `.wechat-token.json` 已加入 `.gitignore`

### 代码质量
- [ ] 所有代码遵循项目编码规范(camelCase, 2 空格缩进)
- [ ] 关键逻辑有中文注释,说明多层 JSON 解析过程和登录流程
- [ ] JSDoc 注释完整
- [ ] 没有硬编码的 token、cookie 或 fakeid

### 功能完整性
- [ ] 能成功调用 `/cgi-bin/appmsgpublish` 接口
- [ ] 能正确解析三层嵌套的 JSON(publish_page → publish_info → appmsgex)
- [ ] 能成功采集指定公众号的文章列表(至少10篇)
- [ ] 采集的数据能通过 NewsItem 验证
- [ ] 支持配置多个公众号
- [ ] 错误处理完善,token 过期有清晰提示并自动重新登录
- [ ] 频率控制生效,公众号之间有延迟

### 可维护性
- [ ] 代码结构清晰,遵循 BaseCollector 模式
- [ ] 登录、存储、采集逻辑分离(WeChatLoginService, TokenStore, WeChatMPCollector)
- [ ] 配置与代码分离
- [ ] 日志信息详细且易于调试
- [ ] 文档完整,用户能快速上手(零配置体验)

### 合规性
- [ ] 代码注释包含"仅供学习研究"声明
- [ ] 文档包含法律风险提示
- [ ] 启动时输出使用风险提醒
- [ ] Token 自动管理,不需要手动配置敏感信息
- [ ] 文档说明需要公众号账号的前提(个人订阅号即可)

### OpenSpec 验证
- [ ] `openspec validate add-wechat-collector --strict` 通过
- [ ] 所有 spec 要求都有对应的实现任务
- [ ] 任务描述清晰,可验证
- [ ] 依赖关系正确标注

## 关键技术要点总结

### 1. 二维码登录流程

**登录 API 端点**:
```
https://mp.weixin.qq.com/cgi-bin/bizlogin
```

**完整登录流程**:
```javascript
// Step 1: 启动登录,获取 uuid
GET /cgi-bin/bizlogin?action=startlogin
→ Response: { uuid: "xxx" }

// Step 2: 构建二维码 URL
https://mp.weixin.qq.com/cgi-bin/loginqrcode?action=getqrcode&uuid={uuid}

// Step 3: 轮询检查登录状态(每 2-3 秒)
GET /cgi-bin/bizlogin?action=ask&uuid={uuid}
→ Response: { status: 0/1/2 }
// 0=登录成功, 1=等待扫码, 2=已扫码待确认

// Step 4: 完成登录,获取 token
GET /cgi-bin/bizlogin?action=login&uuid={uuid}
→ Response: {
    redirect_url: "https://mp.weixin.qq.com/...?token=xxx&lang=zh_CN"
  }
→ Response Headers: Set-Cookie: ...
```

**Token 存储结构**:
```json
{
  "token": "从 redirect_url 中提取",
  "cookie": "从 Set-Cookie 响应头中提取",
  "nickname": "公众号名称(可选)",
  "expires_at": "2024-01-08T12:00:00.000Z",
  "created_at": "2024-01-01T12:00:00.000Z"
}
```

### 2. 文章采集 API 端点
```
https://mp.weixin.qq.com/cgi-bin/appmsgpublish
```

### 3. 请求参数结构
```javascript
{
  sub: 'list',
  begin: 0,
  count: 10,
  fakeid: '公众号ID',
  token: '从 TokenStore 获取',
  // ... 其他固定参数
}
```

**请求头**:
```javascript
{
  'Cookie': '从 TokenStore 获取',
  'Referer': 'https://mp.weixin.qq.com/',
  'Origin': 'https://mp.weixin.qq.com',
  'User-Agent': '标准浏览器 UA'
}
```

### 4. 响应数据结构
```javascript
{
  base_resp: { ret: 0 },  // 0=成功, 200003=token过期
  publish_page: "JSON字符串1"  // 需要第一次 JSON.parse
}

// 第一次解析后:
{
  total_count: 100,
  publish_list: [
    {
      publish_info: "JSON字符串2"  // 需要第二次 JSON.parse
    }
  ]
}

// 第二次解析后:
{
  appmsgex: [  // 这才是文章数组
    {
      aid: "xxx",
      title: "标题",
      digest: "摘要",
      link: "链接",
      update_time: 1234567890,
      // ... 更多字段
    }
  ]
}
```

### 5. 关键差异对比

| 项目 | 传统抓包方案 | 手动配置方案 | **二维码登录方案(本实现)** |
|------|-------------|-------------|--------------------------|
| API | `/mp/profile_ext` | `/cgi-bin/appmsgpublish` | `/cgi-bin/appmsgpublish` |
| 认证参数 | __biz, uin, key, cookie | token, fakeid | **自动获取 token** |
| 配置方式 | 抓包提取 | 后台手动复制 | **扫码自动获取** |
| 有效期 | key 约1-2小时 | token 数天 | token 数天(过期自动重新登录) |
| 前提条件 | 无需公众号 | 需要公众号账号 | 需要公众号账号 |
| 使用门槛 | 高(抓包技能) | 中(后台操作) | **低(扫码即用)** |
| Token 管理 | 需手动更新 | 需手动更新 | **自动管理** |
| 稳定性 | 中 | 高(官方接口) | 高(官方接口) |
| 用户体验 | 复杂 | 中等 | **零配置,体验最佳** |
