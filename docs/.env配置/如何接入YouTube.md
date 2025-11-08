# 如何接入 YouTube

本文档介绍如何配置 YouTube 数据源,以便采集 YouTube 视频内容。

## 前置条件

- Node.js 18+ 已安装
- 已注册 [Composio](https://composio.dev) 账号
- 拥有 YouTube/Google 账号

## 配置步骤

### 1. 获取 Composio API Key

1. 访问 [Composio Dashboard](https://app.composio.dev)
2. 登录您的账号
3. 进入 **API Keys** 页面
4. 创建新的 API Key 或复制现有的 Key
5. 将 Key 保存到 `.env` 文件:

```bash
COMPOSIO_API_KEY=your_composio_api_key_here
```

### 2. 连接 YouTube 账号

#### 方法一: 使用 Composio CLI (推荐)

1. 安装 Composio CLI:

```bash
npm install -g composio-core
```

2. 登录 Composio:

```bash
composio login
```

3. 添加 YouTube 集成:

```bash
composio add youtube
```

这会打开浏览器进行 OAuth 授权。授权成功后,CLI 会显示:
- `Connection ID` (格式: `ca_xxxxx`)
- `User ID` / `Entity ID` (格式: `pg-test-xxxxx`)

4. 将这些值添加到 `.env` 文件:

```bash
COMPOSIO_CONNECTION_ID_YOUTUBE=ca_xxxxx
COMPOSIO_USER_ID_YOUTUBE=pg-test-xxxxx
```

#### 方法二: 使用 Composio Dashboard

1. 访问 [Composio Dashboard](https://app.composio.dev)
2. 进入 **Integrations** → **YouTube**
3. 点击 **Connect** 并完成 OAuth 授权
4. 授权成功后,在 **Connections** 页面找到您的连接
5. 复制 `Connection ID` 和 `Entity ID`,添加到 `.env` 文件

### 3. 验证配置

在项目根目录运行测试脚本:

```bash
node scripts/youtube-demo.js
```

如果配置正确,您应该看到类似输出:

```
✅ YouTube 连接成功
📊 采集到 5 条视频
```

## 环境变量说明

在 `.env` 文件中配置以下变量:

```bash
# Composio API Key (必填)
COMPOSIO_API_KEY=xxxxxxxxxxxxx

# YouTube 连接 ID (必填,格式: ca_xxxxx)
COMPOSIO_CONNECTION_ID_YOUTUBE=ca_xxxxx

# YouTube 用户 ID (必填,格式: pg-test-xxxxx 或 default)
COMPOSIO_USER_ID_YOUTUBE=pg-test-xxxxx
```

## 常见问题

### Q1: 如何找到 YouTube 频道 ID?

**方法一**: 从频道 URL 获取
- 访问频道主页
- URL 格式为 `https://www.youtube.com/channel/UCxxxxxx`
- `UCxxxxxx` 就是频道 ID

**方法二**: 使用频道 @ 句柄查找
- 访问 `https://www.youtube.com/@channelhandle/about`
- 在页面源代码中搜索 `channelId` 或 `externalId`

**方法三**: 使用第三方工具
- 访问 [commentpicker.com/youtube-channel-id.php](https://commentpicker.com/youtube-channel-id.php)
- 输入频道 URL 或名称即可获取

### Q2: 授权失败怎么办?

1. 确保您的 Google 账号已登录
2. 检查 Composio API Key 是否正确
3. 尝试清除浏览器缓存后重新授权
4. 如果使用企业 Google 账号,确保管理员允许第三方应用访问

### Q3: 配额限制是多少?

YouTube Data API v3 有以下配额限制:
- 每天 10,000 配额单位
- 搜索操作消耗 100 单位
- 视频详情操作消耗 1 单位(批量最多 50 个)

本采集器已优化为批量获取(每批 50 个视频),最大化配额利用率。

### Q4: 如何配置关注的频道?

参见: [如何配置关注的YouTube频道](../关注配置/YouTube.md)

## 下一步

配置完成后,您可以:

1. [配置要关注的 YouTube 频道](../关注配置/YouTube.md)
2. [运行完整采集流程](../../README.md#7-运行程序)

## 相关链接

- [Composio 官方文档](https://docs.composio.dev)
- [YouTube Data API 文档](https://developers.google.com/youtube/v3)
- [YouTube API 配额计算器](https://developers.google.com/youtube/v3/determine_quota_cost)
