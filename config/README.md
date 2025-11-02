# 配置文件说明

这个目录包含项目的各种配置文件。

## 📁 文件列表

### filter-rules-*.json
LLM 智能过滤规则配置(按数据源分类)。

**文件列表**:
- `filter-rules-aibase.json` - AIBase 数据源过滤规则
- `filter-rules-zsxq.json` - 知识星球数据源过滤规则
- `filter-rules-wechat-mp.json` - 微信公众号数据源过滤规则

**用途**: 为每个数据源定义独立的正反面样例,帮助 LLM 筛选高质量新闻。

**配置格式**:
```json
{
  "positiveExamples": [
    {
      "title": "你想看到的新闻类型",
      "summary": "新闻摘要(100-200字符)",
      "reason": "为什么喜欢这类新闻"
    }
  ],
  "negativeExamples": [
    {
      "title": "你不想看到的新闻类型",
      "summary": "新闻摘要(100-200字符)",
      "reason": "为什么不喜欢这类新闻"
    }
  ],
  "thresholdConfig": {
    "minPercentage": 10,
    "maxPercentage": 30,
    "preferredCount": 15
  }
}
```

**字段说明**:

| 字段 | 必需 | 说明 |
|------|------|------|
| `positiveExamples` | ✅ 是 | 正面样例数组(至少 1 个) |
| `negativeExamples` | ✅ 是 | 反面样例数组(至少 1 个) |
| `thresholdConfig` | ❌ 否 | 过滤阈值配置 |

**样例要求**:
- `title`: 必填,1-200 字符
- `summary`: 必填,**严格要求 100-200 字符**
- `reason`: 可选,说明喜欢/不喜欢的原因

**阈值配置**:
- `minPercentage`: 最少保留百分比(默认 10%)
- `maxPercentage`: 最多保留百分比(默认 30%)
- `preferredCount`: 期望保留数量(默认 15 条)

---

### wechat-accounts.json
微信公众号配置文件。

**用途**: 配置要采集的微信公众号列表。

**创建方法**:
```bash
cp wechat-accounts.example.json wechat-accounts.json
vim wechat-accounts.json
```

**配置格式**:
```json
[
  {
    "fakeid": "MzI1NjIyMTAwMA==",
    "nickname": "AI科技评论",
    "description": "可选的描述信息"
  },
  {
    "fakeid": "MzUxOTU3NjE4MA==",
    "nickname": "量子位",
    "description": "另一个公众号"
  }
]
```

**字段说明**:

| 字段 | 必需 | 说明 |
|------|------|------|
| `fakeid` | ✅ 是 | 公众号的唯一标识符 |
| `nickname` | ✅ 是 | 公众号名称 |
| `description` | ❌ 否 | 备注说明 |

**如何获取 Fakeid**:

1. **登录公众号后台**: https://mp.weixin.qq.com/

2. **进入素材管理**:
   - 左侧菜单 → 素材管理
   - 点击"新建图文消息"

3. **搜索目标公众号**:
   - 在编辑器中点击"超链接"按钮
   - 选择"文章链接"
   - 在搜索框输入目标公众号名称

4. **获取 Fakeid**:
   - 按 `F12` 打开浏览器开发者工具
   - 切换到 Network 标签
   - 在搜索结果中查找请求
   - 从请求 URL 中找到 `fakeid` 参数
   - 复制 fakeid 值

**示例 URL**:
```
https://mp.weixin.qq.com/cgi-bin/searchbiz?
  action=search_biz
  &token=xxx
  &lang=zh_CN
  &f=json
  &ajax=1
  &query=量子位
  &fakeid=MzUxOTU3NjE4MA==    ← 这就是 fakeid
```

**常见问题**:

Q: 找不到 fakeid 怎么办?
A: 确保:
- 已经在搜索框中输入了公众号名称
- DevTools 的 Network 标签已打开
- 查看 URL 参数或响应内容中的 fakeid 字段

Q: 可以添加多少个公众号?
A: 技术上无限制,但建议不超过 10 个,避免采集时间过长。

Q: 如何临时禁用某个公众号?
A: 直接从配置文件中删除或注释掉该公众号即可。

---

### wechat-accounts.example.json
微信公众号配置示例文件。

**用途**: 提供配置模板,方便快速开始。

**使用方法**:
```bash
# 复制为正式配置文件
cp wechat-accounts.example.json wechat-accounts.json

# 然后编辑 wechat-accounts.json,替换为实际的公众号信息
```

---

## 🔒 安全提醒

- ⚠️ 所有 `*.json` 配置文件都不应提交到 Git (已在 `.gitignore` 中配置)
- ⚠️ Fakeid 是公开信息,可以安全分享
- ⚠️ 但不要将你的 token 和 cookie 分享给他人

---

## 📚 相关文档

- [如何获取微信 Token 和 Cookie](../docs/how-to-get-wechat-token.md)
- [项目 README](../README.md)
