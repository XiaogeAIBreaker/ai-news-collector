# wechat-scraping Specification

## Purpose
定义微信公众号文章采集功能的需求和场景,基于**公众号后台接口**(`/cgi-bin/appmsgpublish`)实现文章列表获取、内容结构化和频率控制机制。

## Background
参考 wechat-article-exporter 项目的核心技术,利用微信公众号后台的文章搜索功能(用于写文章时引用其他公众号内容)来获取文章数据。此方案相比传统协议抓包方式具有:
- 参数更简单(仅需 token + fakeid)
- 有效期更长(token 可用时间长)
- 接口更稳定(官方后台功能)
- 门槛更低(个人订阅号即可)

## ADDED Requirements

### Requirement: 二维码扫码登录
系统必须(SHALL)支持通过二维码扫码登录微信公众号后台,自动获取 token 和 cookie。

#### Scenario: 首次登录获取二维码
- **GIVEN** 用户首次运行程序或 token 不存在
- **WHEN** 程序初始化微信数据源
- **THEN** 系统应调用 `/cgi-bin/bizlogin?action=startlogin` 获取二维码数据
- **AND** 应在终端显示 ASCII 二维码(使用 qrcode-terminal)
- **AND** 如果终端显示失败,应自动打开浏览器显示二维码图片
- **AND** 提示用户使用微信扫一扫功能扫描二维码

#### Scenario: 轮询检查登录状态
- **GIVEN** 二维码已显示给用户
- **WHEN** 等待用户扫码
- **THEN** 系统应每隔 2-3 秒调用 `/cgi-bin/bizlogin?action=ask` 检查登录状态
- **AND** 应显示等待提示:"等待扫码中..."
- **AND** 如果状态码为 0,表示登录成功
- **AND** 如果超过 2 分钟未扫码,应超时并提示重新开始

#### Scenario: 登录成功获取 token
- **GIVEN** 用户已扫码并在手机上确认登录
- **WHEN** 检测到登录成功状态
- **THEN** 系统应调用 `/cgi-bin/bizlogin?action=login` 完成登录
- **AND** 应从响应中提取 `redirect_url` 参数
- **AND** 应从 `redirect_url` 中解析 `token` 参数
- **AND** 应从响应头的 `Set-Cookie` 中提取完整 cookie
- **AND** 应将 token 和 cookie 保存到本地文件 `.wechat-token.json`

#### Scenario: Token 持久化存储
- **GIVEN** 成功获取 token 和 cookie
- **WHEN** 保存到本地文件
- **THEN** 应使用 JSON 格式存储
- **AND** 应包含以下字段:
  - `token`: 公众号后台 token
  - `cookie`: 完整的 cookie 字符串
  - `nickname`: 登录的公众号名称(如可获取)
  - `expires_at`: 过期时间(估算,如当前时间+7天)
  - `created_at`: 创建时间
- **AND** `.wechat-token.json` 应加入 .gitignore
- **AND** 文件权限应设置为仅当前用户可读写(600)

#### Scenario: 登录失败或超时
- **GIVEN** 用户在 2 分钟内未完成扫码
- **OR** 用户在手机上拒绝了登录
- **WHEN** 检测到登录失败
- **THEN** 系统应记录错误日志
- **AND** 提示用户可以重新运行程序再次登录
- **AND** 不应中断程序执行(跳过微信数据源)

### Requirement: Token 自动管理
系统必须(SHALL)自动管理 token 的加载、验证和刷新。

#### Scenario: 启动时加载已有 token
- **GIVEN** 本地存在 `.wechat-token.json` 文件
- **WHEN** 程序启动并初始化微信数据源
- **THEN** 应从文件中读取 token 和 cookie
- **AND** 应验证 token 的有效性(检查是否过期)
- **AND** 如果 token 看起来有效,应直接使用而不触发登录
- **AND** 记录日志:"使用已存储的微信登录信息"

#### Scenario: Token 过期自动重新登录
- **GIVEN** 采集时检测到 token 过期(ret=200003)
- **WHEN** 系统捕获到过期错误
- **THEN** 应记录日志:"Token 已过期,请重新扫码登录"
- **AND** 应自动触发二维码登录流程
- **AND** 用户扫码完成后,应自动继续采集
- **AND** 无需重启程序

#### Scenario: Token 文件损坏或格式错误
- **GIVEN** `.wechat-token.json` 文件存在但内容损坏
- **WHEN** 尝试读取 token
- **THEN** 应捕获 JSON 解析错误
- **AND** 记录警告日志:"Token 文件损坏,将重新登录"
- **AND** 删除损坏的文件
- **AND** 触发二维码登录流程

### Requirement: 微信公众号文章列表采集
系统必须(SHALL)支持通过公众号后台接口采集指定微信公众号的文章列表。

#### Scenario: 成功采集指定公众号的文章列表
- **GIVEN** 用户已配置有效的 `token`(公众号后台 token)和 `fakeid`(公众号 ID)
- **WHEN** 执行采集任务
- **THEN** 系统应成功调用 `/cgi-bin/appmsgpublish` 接口
- **AND** 应正确解析多层嵌套的 JSON 响应
- **AND** 每篇文章应包含标题、摘要、文章 URL、发布时间
- **AND** 默认获取最新 10-20 篇文章

#### Scenario: 多层 JSON 解析
- **GIVEN** 微信接口返回的响应包含嵌套 JSON 字符串
- **WHEN** 解析响应数据
- **THEN** 应先解析顶层 `publish_page` 字段(JSON 字符串)
- **AND** 再从 `publish_list` 数组中提取每个 `publish_info` 字段(又是 JSON 字符串)
- **AND** 最后从 `publish_info` 中提取 `appmsgex` 数组(文章列表)
- **AND** 应处理任何解析异常,记录详细错误信息

#### Scenario: Token 过期或失效时的处理
- **GIVEN** 配置的 `token` 参数已过期或失效
- **WHEN** 尝试采集文章
- **THEN** 系统应捕获认证错误(ret !== 0 或 ret === 200003)
- **AND** 记录清晰的错误日志:"Token 已过期,请重新登录公众号后台获取"
- **AND** 跳过该数据源的采集
- **AND** 不影响其他数据源的正常工作

#### Scenario: Fakeid 无效或公众号不存在
- **GIVEN** 配置的 `fakeid` 对应的公众号不存在或已注销
- **WHEN** 尝试采集文章
- **THEN** 系统应检测到空列表响应
- **AND** 记录警告日志:"公众号 [名称] 未返回文章,请检查 fakeid 是否正确"
- **AND** 返回空列表,不中断程序执行

### Requirement: 微信文章内容结构化
系统必须(SHALL)将微信公众号的文章数据转换为统一的 NewsItem 数据模型。

#### Scenario: 从 appmsgex 提取文章字段
- **GIVEN** 解析后的 `appmsgex` 数组中的单个文章对象
- **WHEN** 构建 NewsItem
- **THEN** 应提取 `title` 字段作为标题
- **AND** 应提取 `digest` 字段作为摘要
- **AND** 如果摘要为空,应使用标题作为摘要
- **AND** 摘要长度应限制在 10-2000 字符范围内

#### Scenario: 构建文章 URL
- **GIVEN** 文章对象的 `link` 字段
- **WHEN** 构建 NewsItem 对象
- **THEN** 应使用 `link` 字段作为文章 URL
- **AND** 如果 URL 不包含协议,应补全为 `https://mp.weixin.qq.com` 开头
- **AND** URL 格式应通过 NewsItem 的 validate() 验证

#### Scenario: 解析发布时间
- **GIVEN** 文章的 `update_time` 或 `create_time` 字段(Unix 时间戳,秒级)
- **WHEN** 解析发布时间
- **THEN** 应将 Unix 时间戳(秒)转换为 JavaScript Date 对象
- **AND** 应乘以 1000 转换为毫秒级时间戳
- **AND** 如果时间字段缺失或无效,应使用当前时间作为默认值
- **AND** 时间应通过 NewsItem 的 validate() 验证

#### Scenario: 保存文章元数据
- **GIVEN** `appmsgex` 对象包含额外信息
- **WHEN** 创建 NewsItem
- **THEN** 应将以下字段保存在 `metadata` 对象中:
  - `aid`: 文章唯一 ID
  - `appmsgid`: 文章消息 ID
  - `author_name`: 文章作者
  - `copyright_stat`: 版权状态(11=原创)
  - `cover`: 封面图片 URL
  - `itemidx`: 文章在推送中的索引位置
  - `album_id`: 所属合集 ID(如有)
  - `item_show_type`: 展示类型(1=文章, 3=视频)

#### Scenario: 处理多图文消息
- **GIVEN** 单次推送包含多篇文章(头条+次条)
- **WHEN** 解析 `appmsgex` 数组
- **THEN** 应保留所有文章
- **AND** 通过 `itemidx` 字段识别文章顺序(0=头条, 1-N=次条)
- **AND** 将 `itemidx` 保存在 metadata 中供后续分析

### Requirement: Token 和 Fakeid 配置管理
系统必须(SHALL)支持通过环境变量和配置文件管理微信采集所需的 token 和公众号列表。

#### Scenario: 环境变量配置 Token
- **GIVEN** 用户在 .env 文件中设置了 `WECHAT_MP_TOKEN` 环境变量
- **WHEN** WeChatMPCollector 初始化
- **THEN** 应从环境变量中读取 token
- **AND** 如果 token 缺失,应记录警告:"未配置 WECHAT_MP_TOKEN,微信数据源已禁用"
- **AND** 跳过该数据源的初始化,不抛出异常

#### Scenario: 配置文件中配置公众号列表
- **GIVEN** 用户在 datasources.js 的 WECHAT_MP_CONFIG.config.accounts 中配置公众号数组
- **WHEN** 初始化配置
- **THEN** 每个公众号配置应包含以下字段:
  - `fakeid`: 公众号 ID(必需)
  - `nickname`: 公众号名称(必需,用于日志和 source 标识)
  - `enabled`: 是否启用(可选,默认 true)
- **AND** 系统应验证每个配置的完整性

#### Scenario: 多公众号采集
- **GIVEN** 配置了多个公众号(如 3 个 AI 相关公众号)
- **WHEN** 执行采集任务
- **THEN** 系统应依次采集每个已启用的公众号
- **AND** 每个公众号的采集结果应使用其 nickname 作为 source 标识
- **AND** 单个公众号采集失败不应影响其他公众号

#### Scenario: Token 获取指引
- **GIVEN** 用户首次使用微信数据源
- **WHEN** 查看配置文档
- **THEN** 文档应提供详细的 token 获取步骤:
  1. 登录微信公众号后台(mp.weixin.qq.com)
  2. 打开浏览器开发者工具,切换到 Network 标签页
  3. 在后台任意操作,查找包含 `token=` 的请求
  4. 从 URL 参数中复制 token 值
  5. 将 token 添加到 .env 文件

### Requirement: 频率控制和反封禁机制
系统必须(SHALL)实现请求频率控制,避免因频繁请求被微信平台限制。

#### Scenario: 公众号之间的请求间隔
- **GIVEN** 配置了多个公众号需要采集
- **WHEN** 依次采集每个公众号
- **THEN** 每个公众号请求之间应有延迟
- **AND** 默认延迟时间应为 3-5 秒(可配置)
- **AND** 延迟时间应使用随机值(如 3000-5000 毫秒)避免被识别为机器行为

#### Scenario: 失败重试策略
- **GIVEN** 单次请求失败(网络错误或服务器错误)
- **WHEN** 触发重试机制
- **THEN** 应使用 BaseCollector 的 retryWithBackoff 方法
- **AND** 最多重试 3 次
- **AND** 重试间隔应递增(1s, 2s, 4s)
- **AND** 如果是认证错误(401/403),不应重试,直接返回错误

#### Scenario: 并发控制
- **GIVEN** 系统配置了多个公众号或多个数据源
- **WHEN** 执行采集任务
- **THEN** 微信公众号的请求不应并发执行
- **AND** 应串行处理每个公众号的采集
- **AND** 与其他数据源(AIBase、知识星球)的采集可以并发

### Requirement: 文章统计数据获取(可选特性)
系统应该(SHALL)提供可选的文章统计数据采集功能,允许用户通过配置开关启用或禁用。

#### Scenario: 配置开关控制统计数据采集
- **GIVEN** 用户在配置中设置 `fetchStats: true`
- **WHEN** 采集文章列表
- **THEN** 系统应调用微信的统计 API(`getappmsgext`)获取数据
- **AND** 应将统计数据保存在 metadata 中:
  - `read_num`: 阅读数
  - `like_num`: 点赞数
  - `old_like_num`: 在看数
- **AND** 如果统计 API 调用失败,应继续处理,不影响文章本身的采集

#### Scenario: 禁用统计数据采集
- **GIVEN** 用户在配置中设置 `fetchStats: false` 或未设置
- **WHEN** 采集文章列表
- **THEN** 系统应跳过统计数据的获取
- **AND** 文章的 metadata 中不包含统计数据字段
- **AND** 采集速度应更快(无额外 API 调用)

#### Scenario: 统计数据获取的频率控制
- **GIVEN** 启用了统计数据采集
- **WHEN** 调用统计 API
- **THEN** 每次调用之间应有延迟(建议 3-5 秒)
- **AND** 如果统计 API 返回频率限制错误,应停止后续统计数据获取
- **AND** 已采集的文章列表不应被丢弃

### Requirement: 数据源接口一致性
微信公众号采集器必须(SHALL)实现与其他数据源相同的接口规范。

#### Scenario: 采集器接口实现
- **GIVEN** 创建 WeChatCollector 类
- **WHEN** 实现采集功能
- **THEN** 必须继承 BaseCollector 抽象类
- **AND** 必须实现 `collect()` 方法并返回 `Promise<NewsItem[]>`
- **AND** 必须使用 BaseCollector 的 `retryWithBackoff()` 处理网络请求
- **AND** 必须使用 BaseCollector 的 `validateNewsItems()` 验证数据

#### Scenario: 配置结构一致性
- **GIVEN** 在 datasources.js 中添加微信配置
- **WHEN** 定义 WECHAT_CONFIG 对象
- **THEN** 配置结构应与 AIBASE_CONFIG 和 ZSXQ_CONFIG 保持一致
- **AND** 应包含通用字段: `name`, `type`, `enabled`, `maxItems`, `timeout`
- **AND** 特定配置(如 `accounts`, `headers`, `rateLimit`)应放在 `config` 对象中

#### Scenario: 错误处理一致性
- **GIVEN** 微信采集过程中发生错误
- **WHEN** 处理错误
- **THEN** 应使用 this.logger 记录错误
- **AND** 不应抛出异常导致程序崩溃
- **AND** 应返回空数组 `[]`,允许其他数据源继续执行

### Requirement: 合规性和风险提示
系统必须(SHALL)在文档和日志中明确标注微信采集的法律风险和使用限制。

#### Scenario: 使用声明
- **GIVEN** 项目文档和代码注释
- **WHEN** 描述微信采集功能
- **THEN** 必须包含以下声明:
  - "本功能仅供个人学习和研究使用"
  - "请勿用于商业用途或大规模数据采集"
  - "使用前请确保符合微信平台服务条款"
  - "建议在采集他人内容前获得授权"

#### Scenario: 启动时风险提示
- **GIVEN** 微信数据源已启用
- **WHEN** 程序启动并初始化 WeChatCollector
- **THEN** 应在日志中输出风险提示
- **AND** 提示内容应包含可能的封号风险
- **AND** 建议用户使用小号或设置保守的采集频率

#### Scenario: Cookie 安全提醒
- **GIVEN** 用户配置 Cookie 参数
- **WHEN** 提供配置文档
- **THEN** 应明确提醒用户:
  - Cookie 包含个人账号信息,不应泄露或分享
  - 应将 .env 文件添加到 .gitignore
  - 不应在公开代码仓库中提交 Cookie 信息
  - 建议定期更换测试账号的密码
