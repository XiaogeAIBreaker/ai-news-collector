# 实现任务清单

## 1. 配置与准备
- [x] 1.1 在 `.env.example` 添加 `COMPOSIO_API_KEY`、`COMPOSIO_CONNECTION_ID_TWITTER`、`COMPOSIO_USER_ID_TWITTER` 等认证说明(含如何在控制台查找 user_id)
- [x] 1.2 在 `config/` 下新增 `twitter-accounts.example.json` 及说明文档(需说明推主字段、可选自定义查询、标签等)
- [x] 1.3 扩展 `src/config/datasources.js` 与 `config/validators.js` 支持 Twitter 配置,包含推主列表与默认查询生成
- [x] 1.4 提供脚本/说明,从 Composio 连接信息中读取默认 `userId` 并验证

## 2. TwitterCollector 实现
- [x] 2.1 创建 `src/collectors/twitter.js`, 继承 `BaseCollector`
- [x] 2.2 实现 `collect()` 主流程, 包含:
  - [x] 2.2.1 读取查询配置, 组合关键词并分页拉取
  - [x] 2.2.2 通过 Composio `twitter` 工具执行搜索/时间线拉取,处理速率限制与重试
  - [x] 2.2.3 将结果转换为 `NewsItem`, 去除重复推文
- [x] 2.3 为核心解析/分页逻辑编写单元测试 (可 Mock Composio 客户端)
  - 单测需覆盖: `from:<handle>` 查询生成、`max_results` 不低于 10、`sinceHours=168` 时的时间窗口计算

## 3. 主流程集成
- [x] 3.1 更新 `src/index.js` 的采集器映射与日志
- [x] 3.2 在 `config/filter-rules-twitter.json` 提供示例 few-shot
- [x] 3.3 确认 `output/markdown.js` 在新增来源下仍按数据源分组展示

## 4. 验证与文档
- [x] 4.1 运行 `npm test`(或等效测试命令) 验证新测试通过
- [ ] 4.2 手动配置假数据/凭证, 运行 `npm start` 验证采集-评分-导出流程 _(微信公众号登录需人工扫码,暂未执行)_
- [x] 4.3 更新 README / config 文档, 描述 Twitter 集成与注意事项
- [x] 4.4 验证近 7 天时间窗口逻辑(含空数据、超期数据)
- [x] 4.5 复核 `openspec/project.md` 与相关规格引用, 确保新增数据源被记录

## 依赖说明
- 任务 2 依赖任务 1 的配置完成
- 任务 3 依赖任务 2 提供的采集结果结构
- 任务 4 需在 1-3 完成后执行

## 验证清单
- [ ] CLI 运行日志显示 Twitter 采集条数、分页信息与使用的 `userId/connectedAccount`
- [ ] Markdown 输出中新增 `Twitter` 分组, 保留历史文件
- [x] 过滤规则加载日志显示 `filter-rules-twitter.json`
- [x] Demo/实测记录能使用 `from:<handle>` 查询拉取近 7 天推文
