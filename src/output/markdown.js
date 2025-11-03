import { writeFileSync } from 'fs';
import {
  resolve,
  dirname,
  extname,
  basename,
  isAbsolute
} from 'path';
import { createLogger } from '../utils/logger.js';
import { ensureDirectorySync } from '../utils/fs.js';

const logger = createLogger('Markdown');

/**
 * Markdown 报告生成器
 * 负责将筛选后的新闻与统计信息输出为结构化文档
 */
export class MarkdownGenerator {
  constructor(options = {}) {
    // 默认输出路径支持传入文件或目录
    this.defaultOutputPath = options.outputPath || 'output/filtered-news.md';
  }

  /**
   * 生成 Markdown 文档
   * @param {Array} filteredNews
   * @param {Object} stats
   * @param {string} outputPath
   * @returns {Promise<string>}
   */
  async generate(filteredNews, stats, outputPath = this.defaultOutputPath) {
    logger.info('开始生成 Markdown 文档...');

    try {
      const absolutePath = this.resolveOutputPath(outputPath);
      ensureDirectorySync(absolutePath);

      const content = this.buildMarkdownContent(filteredNews, stats);
      writeFileSync(absolutePath, content, 'utf-8');

      logger.success(`Markdown 文档生成成功: ${absolutePath}`);
      return absolutePath;
    } catch (error) {
      logger.error('生成 Markdown 文档失败:', error.message);
      throw error;
    }
  }

  /**
   * 拼装完整的 Markdown 内容
   * @param {Array} filteredNews
   * @param {Object} stats
   * @returns {string}
   */
  buildMarkdownContent(filteredNews, stats) {
    const sections = [
      this.buildHeader(),
      this.buildStatsSummary(stats),
      this.buildNewsSection(filteredNews),
      this.buildFooter()
    ];

    return sections.join('\n\n');
  }

  /**
   * 构建文档头部信息
   * @returns {string}
   */
  buildHeader() {
    const now = new Date();
    const dateStr = now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    return `# AI 新闻采集报告

**生成时间**: ${dateStr}
**过滤方式**: LLM 智能评分`;
  }

  /**
   * 构建统计摘要表格
   * @param {Object} stats
   * @returns {string}
   */
  buildStatsSummary(stats) {
    const costEstimate = this.estimateCost(stats);
    const rows = [
      this.createTableRow('总采集数', `${stats.totalNews} 条`),
      this.createTableRow('有效评分', `${stats.validNews} 条`),
      this.createTableRow('过滤后数量', `${stats.filteredCount} 条`),
      this.createTableRow('过滤率', `${stats.filterRate.toFixed(1)}%`),
      this.createTableRow('平均评分', `${stats.averageScore.toFixed(2)} 分`),
      this.createTableRow('最高评分', `${stats.highestScore.toFixed(2)} 分`),
      this.createTableRow('执行耗时', `${stats.duration.toFixed(2)} 秒`),
      this.createTableRow('Token 使用', stats.totalTokens.toLocaleString()),
      this.createTableRow(
        '缓存命中',
        `${stats.cacheHitTokens.toLocaleString()} (${stats.cacheHitRate.toFixed(1)}%)`
      ),
      this.createTableRow('预估成本', `$${costEstimate.toFixed(4)}`)
    ];

    return `## 📊 统计摘要

| 指标 | 数值 |
|------|------|
${rows.join('\n')}`;
  }

  /**
   * 构建新闻主体部分
   * @param {Array} filteredNews
   * @returns {string}
   */
  buildNewsSection(filteredNews) {
    if (!filteredNews || filteredNews.length === 0) {
      return `## 📰 过滤后的新闻

*暂无符合过滤条件的新闻*`;
    }

    const grouped = this.groupBySource(filteredNews);
    const sourceSections = Object.entries(grouped).map(
      ([source, items]) => this.formatSourceSection(source, items)
    );

    return `## 📰 过滤后的新闻 (按评分排序，按数据源分组)

${sourceSections.join('\n\n')}`;
  }

  /**
   * 构建单个数据源的展示段落
   * @param {string} source
   * @param {Array} items
   * @returns {string}
   */
  formatSourceSection(source, items) {
    const content = items
      .map((item, index) => this.formatNewsItem(item, index + 1))
      .join('\n\n---\n\n');

    return `### 📡 ${source} (${items.length} 条)\n\n${content}`;
  }

  /**
   * 格式化单条新闻内容
   * @param {Object} scoredItem
   * @param {number} index
   * @returns {string}
   */
  formatNewsItem(scoredItem, index) {
    const { newsItem, score, reason } = scoredItem;
    const scoreEmoji = this.getScoreEmoji(score);
    const publishTime = newsItem.createdAt.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    const metadata = this.formatMetadata(newsItem.metadata);

    return `#### ${index}. ${newsItem.title}

**评分**: ${scoreEmoji} **${score.toFixed(1)}** / 10.0
**发布时间**: ${publishTime}  ${metadata}
**链接**: [查看原文](${newsItem.url})

**摘要**:
${newsItem.summary}

**评分理由**:
${reason}`;
  }

  /**
   * 格式化新闻的附加元数据
   * @param {Object} metadata
   * @returns {string}
   */
  formatMetadata(metadata = {}) {
    const parts = [];
    if (metadata.author) parts.push(`**作者**: ${metadata.author}`);
    if (metadata.likes !== undefined) parts.push(`👍 ${metadata.likes}`);
    if (metadata.comments !== undefined) parts.push(`💬 ${metadata.comments}`);
    if (metadata.retweets !== undefined) parts.push(`🔁 ${metadata.retweets}`);
    if (metadata.quotes !== undefined) parts.push(`📌 ${metadata.quotes}`);
    if (metadata.views !== undefined) parts.push(`👀 ${metadata.views}`);

    return parts.length > 0 ? `\n**互动数据**: ${parts.join(' | ')}  ` : '';
  }

  /**
   * 获取评分对应的表情符号
   * @param {number} score
   * @returns {string}
   */
  getScoreEmoji(score) {
    if (score >= 9) return '🔥';
    if (score >= 8) return '⭐';
    if (score >= 7) return '👍';
    if (score >= 6) return '👌';
    return '📋';
  }

  /**
   * 文档结尾说明
   * @returns {string}
   */
  buildFooter() {
    return `---

*本报告由 AI 新闻采集器自动生成*  
*使用 DeepSeek API 进行智能评分和过滤*`;
  }

  /**
   * 估算 LLM 调用成本
   * @param {Object} stats
   * @returns {number}
   */
  estimateCost(stats) {
    const inputTokens = stats.totalTokens - stats.cacheHitTokens;
    const outputTokens = stats.totalTokens * 0.1; // 输出占比粗略估算
    const cacheTokens = stats.cacheHitTokens;

    const inputCost = (inputTokens / 1_000_000) * 0.27;
    const outputCost = (outputTokens / 1_000_000) * 1.10;
    const cacheCost = (cacheTokens / 1_000_000) * 0.027;

    return inputCost + outputCost + cacheCost;
  }

  /**
   * 将新闻按来源分组
   * @param {Array} filteredNews
   * @returns {Object<string, Array>}
   */
  groupBySource(filteredNews) {
    return filteredNews.reduce((acc, item) => {
      const source = item.newsItem.source;
      if (!acc[source]) {
        acc[source] = [];
      }
      acc[source].push(item);
      return acc;
    }, {});
  }

  /**
   * 构建 Markdown 表格的一行
   * @param {string} label
   * @param {string} value
   * @returns {string}
   */
  createTableRow(label, value) {
    return `| ${label} | ${value} |`;
  }

  /**
   * 解析输出路径并转为绝对路径
   * @param {string} outputPath
   * @returns {string}
   */
  resolveOutputPath(outputPath) {
    const target = outputPath || this.defaultOutputPath;
    const absoluteTarget = this.normalizeToAbsolute(target);
    const extension = extname(absoluteTarget);

    if (!extension) {
      // 当目标是目录时,使用默认文件名前缀生成时间戳文件
      return resolve(absoluteTarget, this.buildTimestampedFilename('filtered-news', '.md'));
    }

    const directory = dirname(absoluteTarget);
    const baseName = basename(absoluteTarget, extension);
    return resolve(directory, this.buildTimestampedFilename(baseName, extension));
  }

  /**
   * 构建带时间戳的文件名
   * @param {string} baseName
   * @param {string} extension
   * @returns {string}
   */
  buildTimestampedFilename(baseName, extension) {
    return `${baseName}-${this.buildTimestamp()}${extension}`;
  }

  /**
   * 生成文件名使用的时间戳
   * @returns {string}
   */
  buildTimestamp() {
    const now = new Date();
    const pad = number => String(number).padStart(2, '0');

    const datePart = [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate())
    ].join('');

    const timePart = [
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds())
    ].join('');

    return `${datePart}-${timePart}`;
  }

  /**
   * 将路径转换为绝对路径
   * @param {string} target
   * @returns {string}
   */
  normalizeToAbsolute(target) {
    return isAbsolute(target)
      ? target
      : resolve(process.cwd(), target);
  }
}
