# wechat-article-exporter 项目技术分析报告

## 项目概述

**项目地址**: 参考的测试项目 `/Users/bytedance/Desktop/test/wechat-article-exporter`

**项目定位**: 一个在线的微信公众号文章批量下载工具,支持导出 HTML/JSON/Excel/TXT 格式,可获取阅读量与评论数据。

**技术栈**:
- **前端框架**: Nuxt.js 3 (Vue 3 + TypeScript)
- **UI 框架**: Nuxt UI + Tailwind CSS
- **数据管理**: Dexie (IndexedDB)
- **文件处理**: ExcelJS, JSZip, Turndown
- **服务端**: Nuxt Server API (h3)
- **部署**: 支持 Docker, Deno Deploy, Cloudflare Workers

---

## 核心实现原理 ⭐

### 1. 巧妙的数据获取方式

**关键发现**: 利用微信公众号后台的**文章搜索功能**来获取其他公众号的文章。

**原理说明**:
> 在公众号后台写文章时,微信提供了搜索其他公众号文章的功能(用于引用转载)。该功能会调用微信的内部接口 `/cgi-bin/appmsgpublish`,可以获取任意公众号的已发布文章列表。

**优势**:
- ✅ 无需手动抓包获取 `__biz` 等复杂参数
- ✅ 通过二维码扫码登录公众号后台即可使用
- ✅ 接口稳定,返回数据完整
- ✅ 官方接口,不容易被封禁
- ✅ 支持关键词搜索文章

**与传统方案对比**:

| 特性 | wechat-article-exporter | 传统协议抓包方案 |
|------|------------------------|------------------|
| 登录方式 | 二维码扫码登录 | 手动抓包获取参数 |
| 参数复杂度 | 仅需 token + fakeid | 需要 __biz, uin, key, cookie |
| 参数有效期 | 较长(取决于登录态) | key 约 1-2 小时失效 |
| 技术门槛 | 低(普通用户可用) | 高(需要会使用抓包工具) |
| 维护成本 | 低 | 高(参数频繁过期) |

---

## 核心 API 接口分析

### 1. 登录流程

**API 端点**: `POST /cgi-bin/bizlogin?action=login`

**实现文件**: `server/api/v1/login/login.post.ts`

**流程**:
1. 前端获取二维码 (`/api/v1/login/getqrcode.get`)
2. 用户扫码后,轮询检查登录状态 (`/api/v1/login/scan.get`)
3. 登录成功后,调用 `bizlogin` 接口
4. 提取 `token` 和 `cookie`,存储到服务端 KV 存储
5. 返回 UUID 作为用户的授权凭证

**关键代码**:
```typescript
const response = await proxyMpRequest({
  method: 'POST',
  endpoint: 'https://mp.weixin.qq.com/cgi-bin/bizlogin',
  query: { action: 'login' },
  body: {
    userlang: 'zh_CN',
    login_type: 3,
    lang: 'zh_CN',
    f: 'json',
    ajax: 1,
  },
});

// 从响应中提取 token
const _token = new URL(`http://localhost${_body.redirect_url}`)
  .searchParams.get('token')!;

// 存储 cookie 和 token
const cookieEntry = {
  key: uuid,
  token: _token,
  cookie: _cookie.join(';'),
};
await setCookie(cookieEntry);
```

**安全设计**:
- Cookie 存储在服务端 KV 存储中,不暴露给客户端
- 前端只持有 UUID 凭证,通过 Authorization 头传递
- 支持多个用户同时登录(每个用户独立的 UUID)

---

### 2. 获取文章列表

**API 端点**: `GET /cgi-bin/appmsgpublish`

**实现文件**: `server/api/v1/article.get.ts`

**请求参数**:
```typescript
{
  sub: 'list',              // 列表模式(或 'search' 搜索模式)
  search_field: 'null',     // 搜索字段(搜索时为 '7')
  begin: 0,                 // 分页起始位置
  count: 5,                 // 每页数量
  query: '',                // 搜索关键词
  fakeid: 'xxx',            // 公众号 ID
  type: '101_1',            // 固定参数
  free_publish_type: 1,     // 固定参数
  sub_action: 'list_ex',    // 固定参数
  token: 'xxx',             // 登录后的 token
  lang: 'zh_CN',
  f: 'json',
  ajax: 1,
}
```

**响应数据结构**:
```typescript
{
  base_resp: {
    ret: 0,        // 0表示成功, 200003表示登录过期
    err_msg: ''
  },
  publish_page: string  // JSON字符串,需要二次解析
}
```

**publish_page 结构**:
```typescript
{
  total_count: 1000,      // 文章总数
  publish_count: 5,       // 本次返回数量
  publish_list: [
    {
      publish_type: 10,
      publish_info: string  // 又是JSON字符串,需要三次解析
    }
  ]
}
```

**publish_info 结构**:
```typescript
{
  appmsgex: [              // 文章数组
    {
      aid: "xxx",          // 文章 ID
      title: "文章标题",
      digest: "文章摘要",
      link: "文章链接",
      cover: "封面图",
      create_time: 1234567890,
      update_time: 1234567890,
      author_name: "作者",
      copyright_stat: 11,  // 原创标识
      appmsg_album_infos: [], // 所属合集
      // ... 更多字段
    }
  ]
}
```

**关键实现**:
```typescript
// 解析多层嵌套的 JSON
const publish_page = JSON.parse(resp.publish_page);
const articles = publish_page.publish_list
  .filter((item: any) => !!item.publish_info)
  .flatMap((item: any) => {
    const publish_info = JSON.parse(item.publish_info);
    return publish_info.appmsgex;
  });
```

---

### 3. 搜索公众号

**API 端点**: 项目中未直接暴露,但前端实现了公众号搜索功能

**关键参数**:
- `fakeid`: 公众号的唯一标识符(类似 __biz)
- 可以通过公众号名称搜索获取 fakeid

---

### 4. 获取公众号信息

**API 端点**: `GET /mp/authorinfo`

**实现文件**: `server/api/authorinfo.get.ts`

**请求参数**:
```typescript
{
  wxtoken: '777',    // 固定参数
  biz: fakeid,       // 公众号 ID
  __biz: fakeid,     // 同上
  x5: 0,
  f: 'json'
}
```

**响应数据**:
```typescript
{
  base_resp: { ret: 0 },
  identity_name: "公众号认证名称",
  is_verify: 1,              // 是否认证
  original_article_count: 100  // 原创文章数
}
```

---

### 5. 获取合集数据

**API 端点**: `GET /mp/appmsgalbum`

**实现文件**: `server/api/appmsgalbum.get.ts`

**用途**: 获取公众号的文章合集(专辑)列表

**请求参数**:
```typescript
{
  action: 'getalbum',
  __biz: fakeid,
  album_id: 'xxx',
  begin_msgid: 'xxx',
  begin_itemidx: 'xxx',
  count: 20,
  is_reverse: '0',  // 是否倒序
  f: 'json'
}
```

---

### 6. 获取文章评论和统计数据

**实现方式**: 需要用户通过抓包提供 `credentials` 信息

**所需参数**:
```typescript
{
  __biz: 'xxx',
  pass_ticket: 'xxx',
  key: 'xxx',
  uin: 'xxx'
}
```

**说明**: 这部分功能需要额外的认证参数,项目提供了 Python 脚本辅助用户抓包获取。

---

## 核心技术实现

### 1. 代理请求封装

**文件**: `server/utils/index.ts`

**功能**: 统一处理对微信 mp.weixin.qq.com 的请求

**关键实现**:
```typescript
export async function proxyMpRequest(options: RequestOptions) {
  // 1. 从请求头或参数中获取 Cookie
  let cookie = options.cookie;
  if (!cookie) {
    const cookies = parseCookies(options.event);
    cookie = Object.keys(cookies)
      .map(key => `${key}=${cookies[key]}`)
      .join(';');
  }

  // 2. 构建请求配置
  const fetchInit: RequestInit = {
    method: options.method,
    headers: {
      Referer: 'https://mp.weixin.qq.com/',
      Origin: 'https://mp.weixin.qq.com',
      'User-Agent': 'Mozilla/5.0 ...',
      Cookie: options.withCredentials ? cookie : '',
    },
  };

  // 3. 发起请求
  const response = await fetch(options.endpoint, fetchInit);

  // 4. 修改响应的 Cookie SameSite 属性
  // 从 Lax 改为 None,支持 iframe 跨域访问
  const modifiedCookies = modCookies(response.headers.getSetCookie());

  return response;
}
```

**设计亮点**:
- 统一的错误处理
- 自动添加必需的请求头
- 修改 Cookie 的 SameSite 属性支持跨域
- 支持 JSON 自动解析

---

### 2. Cookie 管理

**文件**: `server/kv/cookie.ts`

**存储结构**:
```typescript
interface CookieEntry {
  key: string;       // UUID
  token: string;     // 微信 token
  cookie: string;    // 完整的 cookie 字符串
}
```

**实现方式**:
- 开发环境: 内存存储
- 生产环境: 支持多种 KV 存储(Deno KV, Cloudflare KV 等)

**关键方法**:
```typescript
// 存储 Cookie
export async function setCookie(entry: CookieEntry): Promise<void>

// 获取 Cookie
export async function getCookie(key: string): Promise<CookieEntry | null>

// 删除 Cookie
export async function deleteCookie(key: string): Promise<void>
```

---

### 3. 前端数据缓存

**使用库**: Dexie (IndexedDB 封装)

**缓存策略**:
- 文章列表缓存: 减少 API 调用次数
- 公众号信息缓存
- API 调用历史记录

**实现文件**: `store/v2/article.ts`, `store/v2/api.ts`

---

### 4. 文章导出功能

**支持格式**:
1. **HTML**: 完整还原文章样式,打包图片和 CSS
2. **JSON**: 结构化数据
3. **Excel**: 表格形式,包含元数据
4. **TXT**: 纯文本(使用 Turndown 转 Markdown)

**导出流程**:
```typescript
// 1. 获取文章列表
const articles = await getArticleList(account, token, begin);

// 2. 下载文章 HTML 内容
const html = await $fetch(article.link);

// 3. 处理图片和样式
// 将图片转为 base64 或本地文件
// 提取和打包 CSS

// 4. 打包成 ZIP
const zip = new JSZip();
zip.file('article.html', html);
zip.file('images/xxx.jpg', imageBlob);

// 5. 触发下载
const blob = await zip.generateAsync({ type: 'blob' });
saveAs(blob, 'articles.zip');
```

---

## 数据模型分析

### 文章数据模型 (AppMsgEx)

```typescript
interface AppMsgEx {
  aid: string;                  // 文章唯一 ID
  appmsgid: number;             // 文章消息 ID
  title: string;                // 标题
  digest: string;               // 摘要
  link: string;                 // 文章链接
  cover: string;                // 封面图
  author_name: string;          // 作者
  create_time: number;          // 创建时间(Unix时间戳)
  update_time: number;          // 更新时间
  copyright_stat: number;       // 版权状态(11=原创)
  copyright_type: number;       // 版权类型
  appmsg_album_infos: AppMsgAlbumInfo[];  // 所属合集
  item_show_type: number;       // 展示类型(1=文章, 3=视频)
  itemidx: number;              // 文章在推送中的索引
  media_duration: string;       // 媒体时长(视频)
  // ... 更多字段
}
```

### 公众号数据模型 (AccountInfo)

```typescript
interface AccountInfo {
  type: 'account';
  alias: string;                // 公众号别名
  fakeid: string;               // 公众号 ID
  nickname: string;             // 公众号名称
  round_head_img: string;       // 头像
  service_type: number;         // 服务类型
  signature: string;            // 签名
}
```

---

## 关键技术对比

### 与我们的 ai-news-collector 项目的差异

| 维度 | wechat-article-exporter | ai-news-collector |
|------|------------------------|-------------------|
| **定位** | 通用文章下载工具 | AI 新闻采集与过滤 |
| **用户群体** | 普通用户(Web界面) | 开发者(CLI工具) |
| **获取方式** | 公众号后台接口 | 协议抓包 |
| **技术门槛** | 低(扫码即用) | 中(需手动抓包) |
| **登录方式** | 二维码扫码 | 环境变量配置 |
| **数据处理** | 原样导出 | LLM 评分过滤 |
| **部署方式** | Web服务(Nuxt.js) | Node.js CLI |

---

## 核心优势总结

### 1. 技术创新点 ⭐⭐⭐

**利用公众号后台接口**是该项目最大的亮点:
- 无需复杂的抓包流程
- 参数有效期长,维护成本低
- 接口稳定,不易被封禁
- 降低了普通用户的使用门槛

### 2. 架构设计优势

1. **前后端分离**: Nuxt.js SSR + Server API
2. **多端部署**: 支持 Docker, Serverless (Deno Deploy, CF Workers)
3. **数据缓存**: IndexedDB 本地缓存减少 API 调用
4. **批量处理**: p-queue 控制并发,避免频率限制

### 3. 用户体验优势

- **零配置**: 扫码即用,无需手动配置参数
- **可视化界面**: AG Grid 表格展示,支持筛选和排序
- **多格式导出**: HTML/JSON/Excel/TXT 满足不同需求
- **进度反馈**: 实时显示下载进度

---

## 可借鉴的设计思路

### 对于 ai-news-collector 项目

1. **考虑引入公众号后台接口方案**:
   - 优点: 降低使用门槛,参数维护简单
   - 缺点: 需要用户有公众号账号(可以是个人订阅号)
   - **建议**: 作为可选方案,与抓包方案并存

2. **统一的代理请求封装**:
   ```javascript
   // 可以借鉴 proxyMpRequest 的设计
   class WeChatAPIClient {
     constructor(auth) {
       this.auth = auth;
     }

     async request(endpoint, params) {
       // 统一处理请求头、Cookie、错误等
     }
   }
   ```

3. **更友好的错误提示**:
   - 当前: "Cookie 过期"
   - 改进: "您的认证参数已过期,请按照文档重新获取"

4. **配置管理优化**:
   - 支持多种认证方式
   - 自动检测参数有效性
   - 提供参数更新提示

---

## 实现差异分析

### 获取文章列表的两种方式对比

#### wechat-article-exporter 方式

```typescript
// API: /cgi-bin/appmsgpublish
// 所需参数:
{
  fakeid: 'xxx',    // 从搜索公众号获取
  token: 'xxx',     // 从登录接口获取
  begin: 0,
  count: 5
}

// 优点:
// - 参数简单,只需 fakeid + token
// - token 有效期长
// - 接口稳定
```

#### 传统抓包方式(我们的方案)

```javascript
// API: /mp/profile_ext
// 所需参数:
{
  __biz: 'xxx',     // 需要抓包获取
  uin: 'xxx',       // 需要抓包获取
  key: 'xxx',       // 需要抓包获取(1-2小时过期)
  cookie: 'xxx',    // 需要抓包获取
  offset: 0,
  count: 10
}

// 优点:
// - 不需要公众号账号
// - 可以采集任意公众号
```

---

## 代码质量分析

### 优点

1. **TypeScript 类型完整**: 所有接口都有类型定义
2. **错误处理完善**: 统一的错误捕获和提示
3. **代码模块化**: API、工具、类型分离清晰
4. **可扩展性强**: 容易添加新的导出格式

### 可改进点

1. **重复代码**: 多处相似的 JSON 解析逻辑
2. **魔法数字**: 部分固定参数缺少常量定义
3. **注释不足**: 复杂逻辑缺少中文注释

---

## 总结与建议

### 对于我们的项目

1. **短期方案**: 保持当前的抓包方案
   - 实现简单
   - 无需额外依赖
   - 适合技术用户

2. **中期优化**: 添加二维码登录方案
   - 作为可选的认证方式
   - 降低使用门槛
   - 参考 wechat-article-exporter 的实现

3. **长期规划**: 提供 Web 界面版本
   - 类似 wechat-article-exporter 的 UI
   - 集成 LLM 评分功能
   - 支持批量下载和过滤

### 核心学习点

1. **接口选择很重要**: 公众号后台接口 vs 前端接口,前者更稳定
2. **用户体验优先**: 降低技术门槛能扩大用户群体
3. **架构要灵活**: 支持多种部署方式和认证方式
4. **数据模型要完整**: TypeScript 类型定义提升代码质量

---

## 附录: 关键文件清单

### 服务端 API
- `server/api/appmsgpublish.get.ts` - 获取文章列表(老版本)
- `server/api/v1/article.get.ts` - 获取文章列表(新版本)
- `server/api/authorinfo.get.ts` - 获取公众号信息
- `server/api/appmsgalbum.get.ts` - 获取合集数据
- `server/api/v1/login/login.post.ts` - 登录接口

### 工具函数
- `server/utils/index.ts` - 代理请求封装
- `server/utils/cookie.ts` - Cookie 处理工具

### 数据存储
- `server/kv/cookie.ts` - Cookie 存储管理
- `store/v2/article.ts` - 文章缓存
- `store/v2/api.ts` - API 调用历史

### 类型定义
- `types/types.d.ts` - 核心类型定义
- `types/comment.d.ts` - 评论数据类型
- `types/credential.d.ts` - 认证信息类型

### 前端 API
- `apis/index.ts` - 前端 API 调用封装
