# data-collection Specification

## Purpose
TBD - created by archiving change add-zsxq-collector. Update Purpose after archive.
## Requirements
### Requirement: 知识星球数据源采集
系统必须(SHALL)支持从知识星球平台采集内容,包括主题帖子、评论和互动数据。

#### Scenario: 成功采集指定星球的标签内容
- **WHEN** 配置了有效的星球 ID 和标签列表
- **AND** 提供了有效的 Cookie 认证信息
- **THEN** 系统应成功采集该星球指定标签下的所有可见帖子
- **AND** 每个帖子应包含标题、内容、作者、发布时间、互动数据(点赞数、评论数)

#### Scenario: Cookie 认证失败时的处理
- **WHEN** 提供的 Cookie 已过期或无效
- **THEN** 系统应记录认证错误日志
- **AND** 跳过该数据源的采集
- **AND** 不影响其他数据源的正常采集

#### Scenario: 星球访问权限不足
- **WHEN** Cookie 对应的账号未加入指定星球
- **THEN** 系统应记录权限错误
- **AND** 在日志中提示用户检查星球访问权限

### Requirement: 多星球多标签配置
系统必须(SHALL)支持同时配置多个知识星球和每个星球的多个标签。

#### Scenario: 配置多个星球的采集
- **WHEN** 在配置文件中指定多个星球配置项
- **THEN** 系统应依次采集所有配置的星球
- **AND** 每个星球的采集结果应包含来源标识

#### Scenario: 单个星球配置多个标签
- **WHEN** 为一个星球配置了多个标签(例如「中标」和「AI风向标」)
- **THEN** 系统应采集该星球下所有指定标签的内容
- **AND** 自动对重复内容进行去重

### Requirement: 知识星球内容结构化
系统必须(SHALL)将知识星球的非结构化内容转换为统一的 NewsItem 数据模型。

#### Scenario: 长文本内容的摘要生成
- **WHEN** 知识星球帖子内容超过 2000 字符
- **THEN** 系统应截取前 500 字符作为摘要
- **AND** 在摘要末尾添加省略号标识

#### Scenario: 富文本内容的处理
- **WHEN** 帖子包含图片、链接等富文本元素
- **THEN** 系统应提取纯文本内容
- **AND** 保留原始 URL 链接

#### Scenario: 元数据的提取
- **WHEN** 采集到知识星球帖子
- **THEN** 系统应提取以下元数据:
  - 标题(如果有)或内容前 100 字符
  - 发布时间
  - 作者信息
  - 点赞数
  - 评论数
  - 帖子 URL

### Requirement: 数据源通用接口
系统必须(SHALL)确保知识星球采集器实现与 AIBase 采集器相同的接口规范。

#### Scenario: 采集器接口一致性
- **WHEN** 实现知识星球采集器
- **THEN** 必须继承 BaseCollector 抽象类
- **AND** 必须实现 `collect()` 方法返回 `NewsItem[]`
- **AND** 必须使用统一的重试机制和错误处理

#### Scenario: 配置结构一致性
- **WHEN** 添加知识星球数据源配置
- **THEN** 配置结构应与现有数据源保持一致
- **AND** 包含 name, type, enabled, maxItems, timeout 等通用字段
- **AND** 在 config 对象中放置特定配置(星球列表、Cookie 等)

### Requirement: 内容评分和过滤
知识星球采集的内容必须(SHALL)使用与 AIBase 相同的 LLM 评分和过滤机制。

#### Scenario: 复用 LLM 评分逻辑
- **WHEN** 知识星球内容被采集后
- **THEN** 应传递给相同的 Orchestrator 进行评分
- **AND** 使用相同的正反面样例进行评分
- **AND** 应用相同的动态阈值过滤

#### Scenario: 多数据源内容混合评分
- **WHEN** 同时采集了 AIBase 和知识星球内容
- **THEN** 所有内容应在同一批次中进行 LLM 评分
- **AND** 按统一的评分标准进行过滤
- **AND** 在输出报告中按数据源分组展示

### Requirement: 环境变量安全管理
Cookie 等敏感信息必须(SHALL)通过环境变量管理,不得硬编码在代码中。

#### Scenario: Cookie 配置
- **WHEN** 用户需要配置知识星球认证
- **THEN** 应在 .env 文件中设置 ZSXQ_COOKIE 环境变量
- **AND** .env.example 应包含配置说明和示例格式
- **AND** 实际的 .env 文件不应被 git 追踪

#### Scenario: Cookie 缺失的处理
- **WHEN** 环境变量中未设置 ZSXQ_COOKIE
- **AND** 知识星球数据源被启用
- **THEN** 系统应记录警告日志
- **AND** 跳过知识星球的采集
- **AND** 继续执行其他数据源的采集

