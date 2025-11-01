import axios from 'axios';
import * as cheerio from 'cheerio';
import { BaseCollector } from './base.js';
import { NewsItem } from '../models/news-item.js';
import { ZSXQ_CONFIG } from '../config/datasources.js';

// 常量定义
const CONTENT_LIMITS = {
  TITLE_LENGTH: 100,
  SUMMARY_LENGTH: 500,
  MIN_SUMMARY_LENGTH: 10
};

const DEFAULT_VALUES = {
  TITLE: '无标题',
  AUTHOR: '未知'
};

const HTTP_STATUS = {
  OK: 200,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403
};

/**
 * 知识星球采集器
 * 从知识星球平台采集指定星球的内容
 */
export class ZSXQCollector extends BaseCollector {
  constructor(config = ZSXQ_CONFIG) {
    super(config);
    this.cookieString = process.env.ZSXQ_COOKIE;
    this.cookies = this.parseCookies(this.cookieString); // 解析为对象
    this.seenTopicIds = new Set(); // 用于跨标签去重
  }

  /**
   * 解析 Cookie 字符串为对象
   * @param {string} cookieString - Cookie 字符串 (如: "key1=value1; key2=value2")
   * @returns {Object} Cookie 对象
   */
  parseCookies(cookieString) {
    if (!cookieString) return {};

    const cookies = {};
    cookieString.split(';').forEach(cookie => {
      const parts = cookie.trim().split('=');
      if (parts.length === 2) {
        cookies[parts[0]] = parts[1];
      }
    });

    this.logger.debug(`解析到的 Cookie 键: ${Object.keys(cookies).join(', ')}`);
    return cookies;
  }

  /**
   * 采集新闻 - 主入口
   * @returns {Promise<NewsItem[]>}
   */
  async collect() {
    // 检查 Cookie 是否配置
    if (!this.cookieString) {
      this.logger.warn('未配置 ZSXQ_COOKIE 环境变量,跳过知识星球采集');
      return [];
    }

    // 检查是否有必需的 Cookie 字段
    if (!this.cookies.zsxq_access_token) {
      this.logger.error('Cookie 中缺少必需的 zsxq_access_token 字段');
      return [];
    }

    this.logger.info('开始采集知识星球内容...');
    const startTime = Date.now();
    const allNewsItems = [];

    try {
      const groups = this.config.config.groups;

      // 循环处理所有配置的星球
      for (const group of groups) {
        const { groupId, groupName, tags } = group;
        this.logger.info(`正在采集星球: ${groupName} (${groupId})`);

        // 循环处理该星球的所有标签
        for (const tag of tags) {
          this.logger.info(`  采集标签: ${tag}`);

          try {
            const topics = await this.fetchGroupTopics(groupId, tag);
            this.logger.success(`    获取到 ${topics.length} 条帖子`);

            // 转换为 NewsItem
            const newsItems = this.parseTopics(topics, groupName);
            allNewsItems.push(...newsItems);
          } catch (error) {
            this.logger.error(`    采集标签 ${tag} 失败: ${error.message}`);
            // 继续处理其他标签
          }
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.success(`知识星球采集完成,获取 ${allNewsItems.length} 条内容 (去重后) (耗时: ${duration}s)`);
      return allNewsItems;

    } catch (error) {
      this.logger.error('知识星球采集失败:', error.message);
      return [];
    }
  }

  /**
   * 从指定星球获取帖子列表
   * @param {string} groupId - 星球 ID
   * @param {string} tag - 标签名称
   * @returns {Promise<Array>}
   */
  async fetchGroupTopics(groupId, tag) {
    const url = this.buildApiUrl(groupId);
    const headers = this.buildRequestHeaders();

    // 带重试的请求
    const topics = await this.retryWithBackoff(() =>
      this.fetchTopicsWithRetry(url, headers)
    );

    // 按标签过滤
    return this.filterTopicsByTag(topics, tag);
  }

  /**
   * 构建 API 请求 URL
   * @param {string} groupId - 星球 ID
   * @returns {string}
   */
  buildApiUrl(groupId) {
    const apiBase = this.config.config.apiBase;
    return `${apiBase}/groups/${groupId}/topics`;
  }

  /**
   * 构建请求头(包含 Cookie)
   * @returns {Object}
   */
  buildRequestHeaders() {
    const cookieHeader = Object.entries(this.cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');

    return {
      ...this.config.config.headers,
      'Cookie': cookieHeader
    };
  }

  /**
   * 执行 HTTP 请求获取帖子(带错误处理)
   * @param {string} url - API URL
   * @param {Object} headers - 请求头
   * @returns {Promise<Array>}
   */
  async fetchTopicsWithRetry(url, headers) {
    try {
      this.logger.debug(`请求 URL: ${url}`);
      this.logger.debug(`Cookie 键: ${Object.keys(this.cookies).join(', ')}`);

      const response = await axios.get(url, {
        headers,
        params: {
          scope: 'all',
          count: this.config.maxItems
        },
        timeout: this.config.timeout,
        validateStatus: (status) => status >= 200 && status < 600
      });

      this.logger.debug(`响应状态码: ${response.status}`);

      // 检查 HTTP 状态码
      this.validateHttpStatus(response);

      // 提取并验证响应数据
      return this.extractTopicsFromResponse(response.data);

    } catch (error) {
      this.handleFetchError(error);
      throw error;
    }
  }

  /**
   * 验证 HTTP 状态码
   * @param {Object} response - Axios 响应对象
   */
  validateHttpStatus(response) {
    const { status, data } = response;

    if (status === HTTP_STATUS.UNAUTHORIZED) {
      this.logger.debug(`401 响应内容: ${JSON.stringify(data)}`);
      throw new Error('Cookie 已过期或无效,请重新获取');
    }

    if (status === HTTP_STATUS.FORBIDDEN) {
      this.logger.debug(`403 响应内容: ${JSON.stringify(data)}`);
      throw new Error('没有访问该星球的权限,请检查账号是否已加入该星球');
    }

    if (status !== HTTP_STATUS.OK) {
      this.logger.error(`意外的状态码 ${status}: ${JSON.stringify(data)}`);
      throw new Error(`API 返回状态码 ${status}`);
    }
  }

  /**
   * 从响应数据中提取 topics 数组
   * @param {Object} data - 响应数据
   * @returns {Array}
   */
  extractTopicsFromResponse(data) {
    this.logger.debug(`响应数据结构: ${JSON.stringify(Object.keys(data))}`);

    if (!data.resp_data || !data.resp_data.topics) {
      this.logger.warn(`API 返回格式不符合预期: ${JSON.stringify(data)}`);
      return [];
    }

    const topics = data.resp_data.topics || [];
    this.logger.debug(`获取到 ${topics.length} 个主题`);
    return topics;
  }

  /**
   * 处理请求错误
   * @param {Error} error - 错误对象
   */
  handleFetchError(error) {
    if (error.response) {
      const status = error.response.status;
      this.logger.error(`HTTP 错误 ${status}: ${JSON.stringify(error.response.data)}`);

      if (status === HTTP_STATUS.UNAUTHORIZED) {
        throw new Error('Cookie 已过期或无效,请重新获取');
      } else if (status === HTTP_STATUS.FORBIDDEN) {
        throw new Error('没有访问该星球的权限');
      }
    } else if (error.request) {
      this.logger.error('网络请求失败,无响应');
    } else {
      this.logger.error(`请求配置错误: ${error.message}`);
    }
  }

  /**
   * 按标签过滤帖子
   * @param {Array} topics - 帖子数组
   * @param {string} tag - 标签名称
   * @returns {Array}
   */
  filterTopicsByTag(topics, tag) {
    return topics.filter(topic => {
      if (topic.tags && Array.isArray(topic.tags)) {
        return topic.tags.some(t => t.name === tag || t.title === tag);
      }
      return true;
    });
  }

  /**
   * 解析帖子数据,转换为 NewsItem
   * @param {Array} topics - 帖子数据数组
   * @param {string} groupName - 星球名称
   * @returns {NewsItem[]}
   */
  parseTopics(topics, groupName) {
    const newsItems = [];

    for (const topic of topics) {
      try {
        // 跳过已处理的帖子(去重)
        if (this.isDuplicateTopic(topic.topic_id)) {
          continue;
        }

        // 转换为 NewsItem
        const newsItem = this.topicToNewsItem(topic, groupName);

        // 验证并添加
        if (this.validateAndLogNewsItem(newsItem, topic.topic_id)) {
          newsItems.push(newsItem);
        }

      } catch (error) {
        this.logger.debug(`解析帖子失败 (${topic.topic_id || 'unknown'}):`, error.message);
      }
    }

    return newsItems;
  }

  /**
   * 检查是否是重复帖子
   * @param {string} topicId - 帖子 ID
   * @returns {boolean}
   */
  isDuplicateTopic(topicId) {
    if (this.seenTopicIds.has(topicId)) {
      return true;
    }
    this.seenTopicIds.add(topicId);
    return false;
  }

  /**
   * 将 topic 对象转换为 NewsItem
   * @param {Object} topic - 帖子对象
   * @param {string} groupName - 星球名称
   * @returns {NewsItem}
   */
  topicToNewsItem(topic, groupName) {
    const { title, summary } = this.extractTitleAndSummary(topic);
    const url = this.buildTopicUrl(topic.group.group_id, topic.topic_id);
    const createdAt = new Date(topic.create_time);
    const metadata = this.extractMetadata(topic);

    return new NewsItem({
      title: title.trim(),
      summary: summary.trim(),
      url,
      source: `知识星球-${groupName}`,
      createdAt,
      fetchedAt: new Date(),
      content: this.extractFullContent(topic),
      metadata
    });
  }

  /**
   * 提取帖子元数据
   * @param {Object} topic - 帖子对象
   * @returns {Object}
   */
  extractMetadata(topic) {
    return {
      author: topic.owner?.name || DEFAULT_VALUES.AUTHOR,
      authorAvatar: topic.owner?.avatar_url || '',
      likes: topic.likes?.count || 0,
      comments: topic.comments?.count || 0,
      views: topic.reads_count || 0,
      topicId: topic.topic_id
    };
  }

  /**
   * 验证 NewsItem 并记录日志
   * @param {NewsItem} newsItem - 新闻项
   * @param {string} topicId - 帖子 ID
   * @returns {boolean} 是否验证通过
   */
  validateAndLogNewsItem(newsItem, topicId) {
    const validation = newsItem.validate();
    if (!validation.valid) {
      this.logger.debug(`帖子验证失败 (${topicId}):`, validation.errors);
      return false;
    }
    return true;
  }

  /**
   * 提取标题和摘要
   * @param {Object} topic - 帖子对象
   * @returns {{ title: string, summary: string }}
   */
  extractTitleAndSummary(topic) {
    const fullContent = this.extractRawContent(topic);

    // 生成标题(前 N 字符)
    const title = this.truncateText(
      fullContent,
      CONTENT_LIMITS.TITLE_LENGTH,
      DEFAULT_VALUES.TITLE
    );

    // 生成摘要(前 M 字符)
    let summary = this.truncateText(
      fullContent,
      CONTENT_LIMITS.SUMMARY_LENGTH,
      title
    );

    // 确保摘要有足够长度
    if (summary.length < CONTENT_LIMITS.MIN_SUMMARY_LENGTH) {
      summary = title;
    }

    return { title, summary };
  }

  /**
   * 提取完整内容
   * @param {Object} topic - 帖子对象
   * @returns {string}
   */
  extractFullContent(topic) {
    return this.extractRawContent(topic);
  }

  /**
   * 从帖子对象中提取原始文本内容(去除 HTML)
   * @param {Object} topic - 帖子对象
   * @returns {string}
   */
  extractRawContent(topic) {
    // 知识星球帖子结构优先级:
    // 1. topic.talk.text - 主要文本内容
    // 2. topic.question.text - 问题内容
    // 3. topic.solution.text - 解决方案内容
    let rawContent = '';

    if (topic.talk?.text) {
      rawContent = topic.talk.text;
    } else if (topic.question?.text) {
      rawContent = topic.question.text;
    } else if (topic.solution?.text) {
      rawContent = topic.solution.text;
    }

    return this.stripHtml(rawContent);
  }

  /**
   * 截断文本到指定长度(带省略号)
   * @param {string} text - 原始文本
   * @param {number} maxLength - 最大长度
   * @param {string} defaultValue - 默认值(当文本为空时)
   * @returns {string}
   */
  truncateText(text, maxLength, defaultValue = '') {
    if (!text) return defaultValue;

    if (text.length <= maxLength) {
      return text;
    }

    return text.substring(0, maxLength) + '...';
  }

  /**
   * 去除 HTML 标签,保留纯文本
   * @param {string} html - HTML 字符串
   * @returns {string}
   */
  stripHtml(html) {
    if (!html) return '';

    // 使用 cheerio 去除 HTML 标签
    const $ = cheerio.load(html);
    let text = $.text();

    // 清理多余的空白字符
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * 构建帖子 URL
   * @param {string} groupId - 星球 ID
   * @param {string} topicId - 帖子 ID
   * @returns {string}
   */
  buildTopicUrl(groupId, topicId) {
    const webBase = this.config.config.webBase;
    return `${webBase}/group/${groupId}/topic/${topicId}`;
  }
}
