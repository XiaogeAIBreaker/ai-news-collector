import { writeFileSync } from 'fs';
import { join } from 'path';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Markdown');

/**
 * Markdown 生成器
 */
export class MarkdownGenerator {
  /**
   * 生成 Markdown 文档
   * @param {Array} filteredNews - 过滤后的新闻列表
   * @param {Object} stats - 统计信息
   * @param {string} outputPath - 输出文件路径
   * @returns {Promise<string>} 输出文件的绝对路径
   */
  async generate(filteredNews, stats, outputPath = 'output/filtered-news.md') {
    logger.info('开始生成 Markdown 文档...');

    try {
      // 生成文档内容
      const content = this.buildMarkdownContent(filteredNews, stats);

      // 确保输出目录存在
      const absolutePath = join(process.cwd(), outputPath);
      const dir = join(absolutePath, '..');
      
      // 写入文件
      writeFileSync(absolutePath, content, 'utf-8');

      logger.success(`Markdown 文档生成成功: ${absolutePath}`);
      
      return absolutePath;
    } catch (error) {
      logger.error('生成 Markdown 文档失败:', error.message);
      throw error;
    }
  }

  /**
   * 构建 Markdown 文档内容
   * @param {Array} filteredNews
   * @param {Object} stats
   * @returns {string}
   */
  buildMarkdownContent(filteredNews, stats) {
    const sections = [];

    // 1. 文档头部
    sections.push(this.buildHeader(stats));

    // 2. 统计摘要
    sections.push(this.buildStatsSummary(stats));

    // 3. 新闻列表
    sections.push(this.buildNewsList(filteredNews));

    // 4. 文档尾部
    sections.push(this.buildFooter());

    return sections.join('\n\n');
  }

  /**
   * 构建文档头部
   * @param {Object} stats
   * @returns {string}
   */
  buildHeader(stats) {
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
   * 构建统计摘要
   * @param {Object} stats
   * @returns {string}
   */
  buildStatsSummary(stats) {
    const costEstimate = this.estimateCost(stats);

    return `## 📊 统计摘要

| 指标 | 数值 |
|------|------|
| 总采集数 | ${stats.totalNews} 条 |
| 有效评分 | ${stats.validNews} 条 |
| 过滤后数量 | ${stats.filteredCount} 条 |
| 过滤率 | ${stats.filterRate.toFixed(1)}% |
| 平均评分 | ${stats.averageScore.toFixed(2)} 分 |
| 最高评分 | ${stats.highestScore.toFixed(2)} 分 |
| 执行耗时 | ${stats.duration.toFixed(2)} 秒 |
| Token 使用 | ${stats.totalTokens.toLocaleString()} |
| 缓存命中 | ${stats.cacheHitTokens.toLocaleString()} (${stats.cacheHitRate.toFixed(1)}%) |
| 预估成本 | $${costEstimate.toFixed(4)} |`;
  }

  /**
   * 构建新闻列表(按数据源分组)
   * @param {Array} filteredNews
   * @returns {string}
   */
  buildNewsList(filteredNews) {
    if (filteredNews.length === 0) {
      return `## 📰 过滤后的新闻

*暂无符合过滤条件的新闻*`;
    }

    // 按数据源分组
    const groupedBySource = {};
    filteredNews.forEach(item => {
      const source = item.newsItem.source;
      if (!groupedBySource[source]) {
        groupedBySource[source] = [];
      }
      groupedBySource[source].push(item);
    });

    // 为每个数据源生成内容
    const sections = [];
    let globalIndex = 1;

    for (const [source, items] of Object.entries(groupedBySource)) {
      // 数据源标题
      sections.push(`### 📡 ${source} (${items.length} 条)`);
      sections.push('');

      // 该数据源的新闻列表
      const newsItems = items
        .map(item => this.buildNewsItem(item, globalIndex++))
        .join('\n\n---\n\n');

      sections.push(newsItems);
      sections.push('');
    }

    return `## 📰 过滤后的新闻 (按评分排序，按数据源分组)

${sections.join('\n')}`;
  }

  /**
   * 构建单条新闻
   * @param {Object} item
   * @param {number} index
   * @returns {string}
   */
  buildNewsItem(item, index) {
    const newsItem = item.newsItem;
    const scoreEmoji = this.getScoreEmoji(item.score);

    // 格式化发布时间
    const publishTime = newsItem.createdAt.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    // 如果有元数据(知识星球),显示互动数据
    let metadataSection = '';
    if (newsItem.metadata && Object.keys(newsItem.metadata).length > 0) {
      const meta = newsItem.metadata;
      const metaParts = [];

      if (meta.author) {
        metaParts.push(`**作者**: ${meta.author}`);
      }
      if (meta.likes !== undefined) {
        metaParts.push(`👍 ${meta.likes}`);
      }
      if (meta.comments !== undefined) {
        metaParts.push(`💬 ${meta.comments}`);
      }
      if (meta.views !== undefined) {
        metaParts.push(`👀 ${meta.views}`);
      }

      if (metaParts.length > 0) {
        metadataSection = `\n**互动数据**: ${metaParts.join(' | ')}  `;
      }
    }

    return `#### ${index}. ${newsItem.title}

**评分**: ${scoreEmoji} **${item.score.toFixed(1)}** / 10.0
**发布时间**: ${publishTime}  ${metadataSection}
**链接**: [查看原文](${newsItem.url})

**摘要**:
${newsItem.summary}

**评分理由**:
${item.reason}`;
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
   * 构建文档尾部
   * @returns {string}
   */
  buildFooter() {
    return `---

*本报告由 AI 新闻采集器自动生成*  
*使用 DeepSeek API 进行智能评分和过滤*`;
  }

  /**
   * 估算 API 成本
   * @param {Object} stats
   * @returns {number} 成本(美元)
   */
  estimateCost(stats) {
    // DeepSeek API 定价 (2025年示例价格)
    // Input: $0.27 / 1M tokens
    // Output: $1.10 / 1M tokens
    // Cache Hit: $0.027 / 1M tokens (10% of input)

    const inputTokens = stats.totalTokens - stats.cacheHitTokens;
    const outputTokens = stats.totalTokens * 0.1; // 粗略估算输出占比
    const cacheHitTokens = stats.cacheHitTokens;

    const inputCost = (inputTokens / 1000000) * 0.27;
    const outputCost = (outputTokens / 1000000) * 1.10;
    const cacheCost = (cacheHitTokens / 1000000) * 0.027;

    return inputCost + outputCost + cacheCost;
  }
}
