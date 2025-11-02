# 如何获取微信公众号 Token 和 Cookie

本指南将教你如何从浏览器开发者工具中获取微信公众号的登录凭证(Token 和 Cookie)。

---

## 📋 准备工作

1. **浏览器**: 推荐使用 Chrome 或 Edge 浏览器
2. **微信公众号账号**: 需要有一个微信公众号(个人订阅号即可)

---

## 🔧 详细步骤

### 步骤 1: 登录微信公众号后台

1. 打开浏览器,访问 [https://mp.weixin.qq.com/](https://mp.weixin.qq.com/)
2. 使用微信扫码登录你的公众号

![登录界面](https://via.placeholder.com/600x300?text=WeChat+Login+Page)

### 步骤 2: 打开开发者工具

登录成功后,按下面的快捷键打开开发者工具:

- **Windows/Linux**: `F12` 或 `Ctrl + Shift + I`
- **macOS**: `Command + Option + I`

或者右键点击页面 → 选择"检查"(Inspect)

### 步骤 3: 切换到 Network 标签

在开发者工具中,点击顶部的 **"Network"**(网络)标签

![DevTools Network Tab](https://via.placeholder.com/800x400?text=DevTools+Network+Tab)

### 步骤 4: 刷新页面并找到请求

1. 确保 Network 标签已打开
2. **刷新页面** (按 `F5` 或 `Ctrl+R` / `Command+R`)
3. 等待页面加载完成,你会看到很多网络请求

### 步骤 5: 过滤并查找主请求

在 Network 标签的**过滤框**中输入: `cgi-bin`

这样可以过滤出微信公众号后台的 API 请求。

找到任意一个请求(比如 `home` 或其他请求),点击它。

![Filter Requests](https://via.placeholder.com/800x400?text=Filter+cgi-bin+requests)

### 步骤 6: 查看请求头信息

点击某个请求后,右侧会显示详细信息:

1. 点击 **"Headers"**(请求头)标签
2. 向下滚动找到 **"Request Headers"**(请求头)部分

### 步骤 7: 复制 Cookie

在 Request Headers 中找到 **`Cookie:`** 字段:

1. 点击 `Cookie:` 后面的值
2. **右键 → "Copy value"**(复制值)
   - 或者直接选中整行文本并复制

![Copy Cookie](https://via.placeholder.com/800x400?text=Copy+Cookie+Value)

**Cookie 示例**:
```
slave_user=gh_xxxxxxxxxxxxx; slave_sid=xxxxxxxxxxxxxx; bizuin=xxxxxxxxxxxxx; data_bizuin=xxxxxxxxxxxxx; data_ticket=xxxxxxxxxxxxxx; ...
```

**重要**: Cookie 很长,确保复制完整!

### 步骤 8: 提取 Token

Token 通常在 URL 参数中,有两种方法获取:

#### 方法一: 从 URL 中直接复制

1. 查看浏览器地址栏的 URL
2. 找到 `token=` 参数
3. 复制 `token=` 后面的值(到 `&` 或 URL 结尾为止)

**示例 URL**:
```
https://mp.weixin.qq.com/cgi-bin/home?t=home/index&lang=zh_CN&token=1234567890
```

**Token**: `1234567890`

#### 方法二: 从请求参数中查看

在 Network 标签中:

1. 点击任意一个请求
2. 查看 **"Query String Parameters"**(查询字符串参数)部分
3. 找到 `token` 参数,复制它的值

![Extract Token](https://via.placeholder.com/800x400?text=Extract+Token+from+URL)

---

## 💾 保存到配置文件

### 编辑 .env 文件

在项目根目录编辑 `.env` 文件:

```bash
cd /Users/bytedance/Desktop/ai-news-collector
vim .env
```

### 添加配置

在 `.env` 文件中添加以下两行:

```bash
WECHAT_TOKEN=你复制的token值
WECHAT_COOKIE=你复制的完整cookie值
```

**示例**:

```bash
WECHAT_TOKEN=1234567890
WECHAT_COOKIE=slave_user=gh_xxxxx; slave_sid=xxxxx; bizuin=xxxxx; data_bizuin=xxxxx; data_ticket=xxxxx
```

**注意事项**:
- Token 值不需要加引号
- Cookie 值也不需要加引号
- 确保 Cookie 是完整的,包含所有分号分隔的键值对
- `.env` 文件已加入 `.gitignore`,不会被提交到 Git

---

## ⚠️ 注意事项

### 1. Cookie 的完整性

**确保复制完整的 Cookie**!Cookie 通常很长,包含多个键值对,例如:

```
slave_user=xxx; slave_sid=xxx; bizuin=xxx; data_bizuin=xxx; data_ticket=xxx; ...
```

如果 Cookie 不完整,程序将无法正常工作。

### 2. Token 有效期

- Token 通常有效期为 **7天左右**
- 过期后需要重新获取
- 程序会自动检测 token 是否过期并提示

### 3. 安全性

⚠️ **重要**: Token 和 Cookie 相当于你的登录凭证,**请勿泄露给他人**!

- ✅ `.wechat-token.json` 已加入 `.gitignore`,不会提交到 Git
- ✅ 不要将 token 和 cookie 分享给其他人
- ✅ 建议使用测试公众号,而不是重要的生产公众号
- ✅ 定期更换 token

### 4. 多公众号支持

如果你有多个公众号,目前程序只使用一个 token。如果需要采集不同公众号,需要:

1. 使用对应公众号登录
2. 获取该公众号的 token 和 cookie
3. 更新 `.wechat-token.json` 文件

---

## 🧪 验证配置

保存文件后,运行程序验证配置是否正确:

```bash
npm start
```

如果配置正确,你会看到:

```
✅ 加载已保存的 Token
正在采集: WeChat-MP
✅ [公众号名称]: 获取 XX 条文章
```

如果 token 无效或过期,会提示:

```
❌ Token 已过期或无效,请重新获取
```

---

## 🔄 Token 过期后的处理

当 token 过期时:

1. 重新在浏览器中登录微信公众号后台
2. 按照上述步骤重新获取新的 token 和 cookie
3. 更新 `.wechat-token.json` 文件
4. 重新运行程序

---

## ❓ 常见问题

### Q1: 找不到 token 参数?

**解决方法**:
- 确保已经成功登录微信公众号后台
- 刷新页面,查看地址栏 URL
- Token 通常在 `token=` 参数后面

### Q2: Cookie 太长,复制不完整?

**解决方法**:
- 右键点击 Cookie 值 → "Copy value"
- 或者双击选中整行,然后复制
- 粘贴到文本编辑器中检查是否完整

### Q3: 程序提示 "Token 无效"?

**可能原因**:
1. Token 已过期(超过7天)
2. Cookie 不完整或格式错误
3. 已在浏览器中退出登录

**解决方法**: 重新获取 token 和 cookie

### Q4: 如何查看 token 是否过期?

查看 `.wechat-token.json` 中的 `expires_at` 字段,如果当前时间超过该时间,说明已过期。

---

## 📞 技术支持

如果遇到问题:
1. 检查 token 和 cookie 是否正确复制
2. 查看程序日志输出的错误信息
3. 确认公众号账号状态正常
4. 查看项目 GitHub Issues

---

## 🎉 开始使用

完成配置后,你就可以开始使用程序采集微信公众号文章了!

```bash
npm start
```

祝你使用愉快! 🎊
