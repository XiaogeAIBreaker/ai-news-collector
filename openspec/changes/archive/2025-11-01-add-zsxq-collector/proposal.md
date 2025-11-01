# 添加知识星球数据源采集器

## Why
当前系统仅支持 AIBase 作为唯一的 AI 新闻数据源。用户需要从知识星球(ZSXQ)采集特定星球的高质量内容,例如从 https://wx.zsxq.com/group/15552545485212 采集「中标」和「AI风向标」等标签下的帖子。知识星球包含大量专业社群产生的优质 AI 讨论和见解,是重要的补充数据源。

## What Changes
- **新增知识星球采集器** (`ZSXQCollector`)
  - 支持通过 Cookie 认证访问知识星球内容
  - 支持按星球 ID 和标签(Tab)过滤内容
  - 支持配置多个星球和标签组合
- **扩展数据源配置系统**
  - 在 `datasources.js` 中添加知识星球配置
  - 支持星球 ID 和标签列表的配置
  - Cookie 通过环境变量管理
- **复用现有评分和过滤机制**
  - 知识星球内容使用相同的 LLM 评分逻辑
  - 采用相同的动态过滤策略
- **输出格式保持一致**
  - 知识星球内容整合到相同的 Markdown 报告中
  - 按数据源分组展示

## Impact
- **影响的规格**: `data-collection` (新增)
- **影响的代码**:
  - `src/collectors/zsxq.js` (新建)
  - `src/config/datasources.js` (修改 - 添加 ZSXQ 配置)
  - `src/index.js` (修改 - 支持多数据源编排)
  - `.env.example` (修改 - 添加 ZSXQ_COOKIE 说明)
  - `config/filter-rules.json` (可选 - 用户可根据需要调整样例)
- **破坏性变更**: 无
- **依赖变更**: 无新增依赖,复用现有的 axios 和 cheerio
