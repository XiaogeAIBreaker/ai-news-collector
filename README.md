<div align="center">
    <img src="https://cdn.ziliu.online/images/2025/11/8936b26f-bc51-4e66-a1ac-018ebd1aef33.jpg" width="200" />
    <h1>🌱 信息收集过滤器</h1>
</div>

<p align="center">
    <strong>专注于从海量资讯中，筛选出精准有效的信息，提升信息获取效率</strong>
</p>

---

![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-3C873A)
![License](https://img.shields.io/badge/license-MIT-blue)
![Status](https://img.shields.io/badge/status-active-brightgreen)

## 🤔 干啥的？

公众号、知识星球、各大资讯站（[AIBase](https://www.aibase.com/zh)）、特推...

信息量爆炸？一条条刷？低质量营销号？没时间？漏消息？...

**AI 信息采集过滤器统统，分分钟给你搞定 🤓**

## 🔥 功能特性

- ✅ **多数据源采集**: 目前支持 [AIBase](https://www.aibase.com/zh)、知识星球、微信公众号、Twitter...(以后会支持更多)
- ✅ **公众号正文解析**: 自动抓取公众号文章全文, 让 LLM 评分更加精准
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
COMPOSIO_CONNECTION_ID_TWITTER=xxxxxxxxx
COMPOSIO_USER_ID_TWITTER=xxxxxxxxx
```

如何配置请见👇

- [如何配置DeepSeek](docs/.env配置/如何配置DeepSeek.md)

- [如何接入公众号](docs/.env配置/如何接入公众号.md)

- [如何接入知识星球](docs/.env配置/如何接入知识星球.md)

- [如何接入推特](docs/.env配置/如何接入推特.md)

### 4. 配置关注（公众号 / 知识星球 / 推特）
需要配置要关注的 公众号 / 星球号 / 推特账号 （AIBase无需配置）

配置文件在 \`config\/关注配置` 下


如何配置请见👇

- [如何配置关注的公众号](docs/关注配置/公众号.md)

- [如何配置关注的星球号](docs/关注配置/知识星球.md)

- [如何配置关注的推特](docs/关注配置/推特.md)

### 5. 配置偏好
采集程序会根据配置的偏好，自动筛除 70% - 80% 无用信息，仅保留有效信息

如何配置请见：[如何配置偏好](docs/偏好配置.md)

### 6. 配置时间窗口
统一控制所有数据源仅保留最近 N 天的内容

如何配置请见：[时间窗口配置](docs/采集窗口配置.md)

### 7. 运行程序

```bash
npm start
```

程序会自动:
1. 读取启用的数据源配置 (AIBase / 知识星球 / 微信公众号 / Twitter)
2. 统一应用采集时间窗口、并发控制等运行参数
3. 使用 DeepSeek LLM 结合正负向样例进行批量评分
4. 根据动态阈值保留重点新闻
5. 生成带时间戳的 Markdown 报告(示例: `output/filtered-news-20251102-223726.md`), 每个数据源以表格方式呈现


| 开始采集 | 采集结束 |
|------|------|
| ![](https://cdn.ziliu.online/images/2025/11/bab47bc6-664f-4cb4-a1b9-bc5fc57dae61.jpg)| ![](https://cdn.ziliu.online/images/2025/11/df31e1c0-2a87-4c08-bf28-a731ff5b6b9b.jpg) |

📄 **输出示例**

[采集输出示例文档](/docs/filtered-news-20251106-192811.md)

| 输出文档局部展示一 | 输出文档局部展示二 |
|------|------|
| ![](https://cdn.ziliu.online/images/2025/11/2a4648cf-ec7a-463f-8dae-02384b16d5a1.jpg) | ![](https://cdn.ziliu.online/images/2025/11/47435f6b-17c7-4435-8c05-a8d017875e89.jpg)|


## 💬 欢迎联系我

🙋 **关于我（李骁）：**

- 🎓 武汉大学计算机科学硕士
- 🔭 目前在大厂担任 技术负责人
- 🔍 具备全栈开发能力，包括设计、后台、客户端等全栈研发经验
- 📚 [Trae Expert](https://lcnziv86vkx6.feishu.cn/wiki/JkuHwnMseiiO6fkm3h1cz41Gn8c)
- 🎓 AI编程技术分享者，专注AI技术教学
- 🤖 长期聚焦 AI 方向（尤其在 AI 编程、智能 Agent 领域有持续的研究与实践），曾先后在公司内部技术分享会及行业外部交流活动中，多次围绕 AI 相关技术主题做分享；业余时间我也会持续深耕 AI 前沿技术，保持对行业动态的敏锐关注。

**有Bug？有需求？想聊AI？想面基？欢迎 🤗**

**联系方式：**

| 微信 | 公众号 |
|------|------|
| ![](https://cdn.ziliu.online/images/2025/11/cd418ef1-dd65-403e-8f8c-f1b7ecf1f5f0.jpg)| ![](https://cdn.ziliu.online/images/2025/11/5fd69718-89a3-43bc-9814-7f12c78d26da.jpg) |


## 📄 开源协议

本项目基于 MIT License
