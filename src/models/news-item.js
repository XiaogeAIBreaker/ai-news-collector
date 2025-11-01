import { randomUUID } from 'crypto';

/**
 * NewsItem 类 - 表示从数据源采集的单条新闻内容
 */
export class NewsItem {
  constructor({
    id = randomUUID(),
    title,
    summary,
    url,
    source,
    createdAt,
    fetchedAt = new Date(),
    content = '',
    metadata = {}
  }) {
    this.id = id;
    this.title = title;
    this.summary = summary;
    this.url = url;
    this.source = source;
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
    this.fetchedAt = fetchedAt instanceof Date ? fetchedAt : new Date(fetchedAt);
    this.content = content;
    this.metadata = metadata;
  }

  /**
   * 验证必填字段
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validate() {
    const errors = [];

    // 标题验证
    if (!this.title || typeof this.title !== 'string') {
      errors.push('标题是必填字段');
    } else if (this.title.length < 1 || this.title.length > 500) {
      errors.push('标题长度必须在 1-500 字符之间');
    }

    // 摘要验证
    if (!this.summary || typeof this.summary !== 'string') {
      errors.push('摘要是必填字段');
    } else if (this.summary.length < 10 || this.summary.length > 2000) {
      errors.push('摘要长度必须在 10-2000 字符之间');
    }

    // URL验证
    if (!this.url || typeof this.url !== 'string') {
      errors.push('URL 是必填字段');
    } else {
      try {
        new URL(this.url);
      } catch {
        errors.push('URL 格式无效');
      }
    }

    // 数据源验证
    if (!this.source || typeof this.source !== 'string') {
      errors.push('数据源是必填字段');
    }

    // 发布时间验证
    if (!this.createdAt || !(this.createdAt instanceof Date) || isNaN(this.createdAt)) {
      errors.push('发布时间是必填字段且必须是有效的日期');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 转换为 JSON 对象
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      summary: this.summary,
      url: this.url,
      source: this.source,
      createdAt: this.createdAt.toISOString(),
      fetchedAt: this.fetchedAt.toISOString(),
      content: this.content,
      metadata: this.metadata
    };
  }

  /**
   * 从 JSON 对象创建 NewsItem 实例
   */
  static fromJSON(json) {
    return new NewsItem(json);
  }
}

/**
 * 验证新闻数组
 * @param {NewsItem[]} newsItems
 * @returns {{ valid: NewsItem[], invalid: Array<{item: NewsItem, errors: string[]}> }}
 */
export function validateNewsItems(newsItems) {
  const valid = [];
  const invalid = [];

  for (const item of newsItems) {
    const validation = item.validate();
    if (validation.valid) {
      valid.push(item);
    } else {
      invalid.push({ item, errors: validation.errors });
    }
  }

  return { valid, invalid };
}
