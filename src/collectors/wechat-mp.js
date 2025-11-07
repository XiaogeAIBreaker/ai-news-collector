import axios from 'axios';
import * as cheerio from 'cheerio';
import { BaseCollector } from './base.js';
import { NewsItem } from '../models/news-item.js';
import WeChatLoginService from '../services/wechat-login.js';
import TokenStore from '../storage/token-store.js';
import { delay, getRandomDelay } from '../utils/helpers.js';
import { getRecentDays } from '../config/collection-window.js';
import { partitionByGlobalRecency } from '../utils/recency.js';

/**
 * 微信公众号 MP 采集器
 * 通过微信公众号后台接口采集文章列表
 */
export class WeChatMPCollector extends BaseCollector {
  constructor(config) {
    super(config);

    this.loginService = new WeChatLoginService();
    this.tokenStore = new TokenStore();

    this.accounts = config.config?.accounts || [];
    this.baseUrl = 'https://mp.weixin.qq.com';
    this.apiUrl = config.config?.apiUrl || `${this.baseUrl}/cgi-bin/appmsgpublish`;
    this.recentDays = getRecentDays();

    this.rateLimit = config.config?.rateLimit || {
      minDelay: 3000,
      maxDelay: 5000
    };

    this.articleFetchDelay = config.config?.articleFetchDelay || {
      minDelay: 250,
      maxDelay: 600
    };

    this.currentToken = null;
    this.currentCookie = null;
  }

  /**
   * 主流程入口
   * @returns {Promise<NewsItem[]>}
   */
  async collect() {
    this.logger.info('开始采集微信公众号文章...');
    const startTime = Date.now();
    this.recentDays = getRecentDays();

    try {
      await this.ensureAuthenticated();

      if (!this.hasAccounts()) {
        this.logger.warn('未配置任何公众号,跳过采集');
        return [];
      }

      const allNewsItems = [];

      for (let index = 0; index < this.accounts.length; index += 1) {
        const account = this.accounts[index];
        const label = this.buildAccountLabel(index);

        try {
          this.logger.info(`${label} 开始采集: ${account.nickname}`);
          const newsItems = await this.collectAccount(account);
          allNewsItems.push(...newsItems);
          this.logger.success(`✅ ${account.nickname}: 获取 ${newsItems.length} 条文章`);
        } catch (error) {
          this.logger.error(`❌ ${account.nickname} 采集失败: ${error.message}`);
        }

        await this.applyRateLimit(index);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.success(`采集完成,共获取 ${allNewsItems.length} 条文章 (耗时: ${duration}s)`);

      return allNewsItems;
    } catch (error) {
      this.logger.error('采集流程异常:', error.message);
      return [];
    }
  }

  /**
   * 确保已登录,优先复用本地缓存的 token
   * @returns {Promise<void>}
   */
  async ensureAuthenticated() {
    const savedToken = this.tokenStore.load();
    if (this.isTokenValid(savedToken)) {
      this.currentToken = savedToken.token;
      this.currentCookie = savedToken.cookie;
      this.logger.info('使用已保存的登录信息');
      return;
    }

    this.logger.info('需要登录微信公众号后台');
    await this.performLogin();
  }

  /**
   * 执行登录,并缓存最新的 token 信息
   * @returns {Promise<void>}
   */
  async performLogin() {
    try {
      const loginInfo = await this.loginService.login();

      this.tokenStore.save({
        token: loginInfo.token,
        cookie: loginInfo.cookie,
        nickname: loginInfo.nickname
      });

      this.currentToken = loginInfo.token;
      this.currentCookie = loginInfo.cookie;
      this.logger.success('登录成功并已保存凭证');
    } catch (error) {
      throw new Error(`登录失败: ${error.message}`);
    }
  }

  /**
   * 采集单个公众号文章
   * @param {Object} account
   * @returns {Promise<NewsItem[]>}
   */
  async collectAccount(account) {
    const MAX_RETRY = 2;

    for (let attempt = 1; attempt <= MAX_RETRY; attempt += 1) {
      try {
        const response = await this.fetchArticleList(account);

        if (this.isTokenExpired(response)) {
          await this.handleTokenExpiry(account, attempt, MAX_RETRY);
          continue;
        }

        this.assertSuccess(response);

        const articles = this.parseResponse(response);
        let newsItems = this.convertToNewsItems(articles, account.nickname);
        newsItems = await this.enrichWithArticleBodies(newsItems);
        const { recentNews, outdatedNews } = this.filterRecentNewsItems(newsItems);

        if (outdatedNews.length > 0) {
          this.logger.info(
            `${account.nickname}: 跳过 ${outdatedNews.length} 条超过 ${this.recentDays} 天的文章`
          );
        }

        if (recentNews.length === 0) {
          this.logger.warn(`${account.nickname}: 最近 ${this.recentDays} 天内没有文章,跳过`);
          return [];
        }

        const { valid, invalid } = this.validateNewsItems(recentNews);

        if (invalid.length > 0) {
          this.logger.warn(`${account.nickname}: 过滤掉 ${invalid.length} 条无效文章`);
        }

        return valid;
      } catch (error) {
        if (attempt === MAX_RETRY) {
          throw new Error(`${account.nickname} 采集失败: ${error.message}`);
        }

        this.logger.warn(
          `${account.nickname} 采集异常,准备重试 (${attempt}/${MAX_RETRY - 1}): ${error.message}`
        );
        await delay(1000);
      }
    }

    return [];
  }

  /**
   * 请求文章列表接口
   * @param {Object} account
   * @param {number} begin
   * @returns {Promise<Object>}
   */
  async fetchArticleList(account, begin = 0) {
    const requestConfig = {
      params: this.buildRequestParams(account, begin),
      headers: this.buildRequestHeaders(),
      timeout: this.config.timeout || 30000
    };

    const fetchFn = async () => {
      const response = await axios.get(this.apiUrl, requestConfig);
      return response.data;
    };

    return this.retryWithBackoff(fetchFn);
  }

  /**
   * 解析多层嵌套的 JSON 响应
   * @param {Object} response
   * @returns {Array}
   */
  parseResponse(response) {
    try {
      if (!response.publish_page) {
        this.logger.warn('响应中缺少 publish_page 字段');
        return [];
      }

      const publishPage = JSON.parse(response.publish_page);
      const publishList = publishPage.publish_list || [];

      if (publishList.length === 0) {
        this.logger.debug('publish_list 为空,没有文章');
        return [];
      }

      const articles = [];

      publishList.forEach(item => {
        if (!item.publish_info) return;

        try {
          const publishInfo = JSON.parse(item.publish_info);
          const appmsgex = publishInfo.appmsgex || [];
          if (Array.isArray(appmsgex)) {
            articles.push(...appmsgex);
          }
        } catch (error) {
          this.logger.warn(`第二层 JSON 解析失败,跳过该项: ${error.message}`);
        }
      });

      return articles;
    } catch (error) {
      this.logger.error('JSON 解析失败:', error.message);
      throw error;
    }
  }

  /**
   * 将原始文章转换为 NewsItem
   * @param {Array} articles
   * @param {string} accountName
   * @returns {NewsItem[]}
   */
  convertToNewsItems(articles, accountName) {
    return articles.map(article => this.buildNewsItem(article, accountName));
  }

  /**
   * 补充正文内容,供后续评分使用
   * @param {NewsItem[]} newsItems
   * @returns {Promise<NewsItem[]>}
   */
  async enrichWithArticleBodies(newsItems) {
    if (!Array.isArray(newsItems) || newsItems.length === 0) {
      return newsItems;
    }

    const enriched = [];

    for (const item of newsItems) {
      if (!item?.url) {
        enriched.push(item);
        continue;
      }

      const { content, snippet } = await this.fetchArticleContent(item.url);

      if (content) {
        item.content = content;
        item.metadata = {
          ...item.metadata,
          contentLength: content.length
        };
      }

      if (snippet) {
        item.summary = this.normalizeSummary(snippet, item.summary);
      }

      enriched.push(item);

      const { minDelay = 200, maxDelay = 400 } = this.articleFetchDelay || {};
      if (maxDelay > 0) {
        await delay(getRandomDelay(minDelay, maxDelay));
      }
    }

    return enriched;
  }

  /**
   * 抓取公众号文章正文
   * @param {string} url
   * @returns {Promise<{content: string, snippet: string}>}
   */
  async fetchArticleContent(url) {
    if (!url) {
      return { content: '', snippet: '' };
    }

    try {
      const response = await axios.get(url, {
        headers: this.buildArticleRequestHeaders(),
        timeout: this.config.timeout || 30000
      });

      const content = extractWeChatArticleText(response.data);
      const snippet = buildWeChatContentSnippet(content);

      return { content, snippet };
    } catch (error) {
      this.logger.debug(`获取正文失败: ${error.message}`);
      return { content: '', snippet: '' };
    }
  }

  /**
   * 构建单条 NewsItem,并处理原始数据的缺陷
   * @param {Object} article
   * @param {string} accountName
   * @returns {NewsItem}
   */
  buildNewsItem(article, accountName) {
    const title = article.title || '';
    const summary = this.normalizeSummary(article.digest, title);
    const url = this.resolveArticleUrl(article.link);
    const createdAt = this.resolvePublishTime(article);
    const metadata = this.extractMetadata(article, accountName);

    return new NewsItem({
      title,
      summary,
      url,
      source: 'WeChat-MP',
      createdAt,
      metadata
    });
  }

  /**
   * 计算随机延迟,避免触发限流
   * @param {number} index
   * @returns {Promise<void>}
   */
  async applyRateLimit(index) {
    const isLastAccount = index >= this.accounts.length - 1;
    if (isLastAccount) return;

    const delayMs = getRandomDelay(this.rateLimit.minDelay, this.rateLimit.maxDelay);
    await delay(delayMs);
  }

  /**
   * 判断 token 是否有效
   * @param {Object|null} tokenData
   * @returns {boolean}
   */
  isTokenValid(tokenData) {
    return Boolean(tokenData?.token && tokenData?.cookie);
  }

  /**
   * 判断接口返回是否表示 token 过期
   * @param {Object} response
   * @returns {boolean}
   */
  isTokenExpired(response) {
    return response?.base_resp?.ret === 200003;
  }

  /**
   * 处理 token 过期,重新登录后继续请求
   * @param {Object} account
   * @param {number} attempt
   * @param {number} maxRetry
   */
  async handleTokenExpiry(account, attempt, maxRetry) {
    this.logger.warn(
      `${account.nickname}: Token 已过期,准备重新登录 (${attempt}/${maxRetry})`
    );
    await this.performLogin();
  }

  /**
   * 当 ret 不为 0 时抛出错误
   * @param {Object} response
   */
  assertSuccess(response) {
    const retCode = response?.base_resp?.ret;
    if (retCode === undefined || retCode === 0) {
      return;
    }

    throw new Error(`接口返回错误: ret=${retCode}`);
  }

  /**
   * 构建请求参数
   * @param {Object} account
   * @param {number} begin
   * @returns {Object}
   */
  buildRequestParams(account, begin) {
    return {
      sub: 'list',
      search_field: 'null',
      begin,
      count: this.config.maxItems || 10,
      query: '',
      fakeid: account.fakeid,
      type: '101_1',
      free_publish_type: 1,
      sub_action: 'list_ex',
      token: this.currentToken,
      lang: 'zh_CN',
      f: 'json',
      ajax: 1
    };
  }

  /**
   * 构建请求头
   * @returns {Object}
   */
  buildRequestHeaders() {
    return {
      Cookie: this.currentCookie,
      Referer: 'https://mp.weixin.qq.com/',
      Origin: 'https://mp.weixin.qq.com',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    };
  }

  /**
   * 构建正文抓取请求头
   * @returns {Object}
   */
  buildArticleRequestHeaders() {
    return {
      Referer: 'https://mp.weixin.qq.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    };
  }

  /**
   * 标准化摘要,保证长度符合要求
   * @param {string} digest
  * @param {string} fallback
   * @returns {string}
   */
  normalizeSummary(digest, fallback) {
    let summary = digest || fallback || '';
    if (summary.length < 10) {
      summary = summary.padEnd(10, '.');
    } else if (summary.length > 2000) {
      summary = summary.slice(0, 2000);
    }
    return summary;
  }

  /**
   * 过滤出近 N 天的文章
   * @param {NewsItem[]} newsItems
   * @returns {{ recentNews: NewsItem[], outdatedNews: NewsItem[] }}
   */
  filterRecentNewsItems(newsItems) {
    const { recent, outdated, recentDays } = partitionByGlobalRecency(newsItems);
    this.recentDays = recentDays;
    return {
      recentNews: recent,
      outdatedNews: outdated
    };
  }

  /**
   * 解析文章链接,补全协议
   * @param {string} rawLink
   * @returns {string}
   */
  resolveArticleUrl(rawLink) {
    if (!rawLink) return '';
    if (rawLink.startsWith('http')) return rawLink;
    const normalized = rawLink.startsWith('/') ? rawLink : `/${rawLink}`;
    return `https://mp.weixin.qq.com${normalized}`;
  }

  /**
   * 解析发布时间
   * @param {Object} article
   * @returns {Date}
   */
  resolvePublishTime(article) {
    if (article.update_time) {
      return new Date(article.update_time * 1000);
    }
    if (article.create_time) {
      return new Date(article.create_time * 1000);
    }
    return new Date();
  }

  /**
   * 提取文章 metadata
   * @param {Object} article
   * @returns {Object}
   */
  extractMetadata(article, accountName) {
    return {
      aid: article.aid,
      appmsgid: article.appmsgid,
      author: article.author_name,
      copyright_stat: article.copyright_stat,
      cover: article.cover || article.cover_img,
      itemidx: article.itemidx,
      album_id: article.album_id,
      item_show_type: article.item_show_type,
      likes: article.like_count,
      comments: article.comment_count,
      views: article.read_num,
      accountName,
      sourceType: 'WeChat-MP'
    };
  }

  /**
   * 构建账号的日志标签
   * @param {number} index
   * @returns {string}
   */
  buildAccountLabel(index) {
    return `[${index + 1}/${this.accounts.length}]`;
  }

  /**
   * 判断是否存在可采集的账号
   * @returns {boolean}
   */
  hasAccounts() {
    return Array.isArray(this.accounts) && this.accounts.length > 0;
  }
}

/**
 * 从公众号文章 HTML 中提取正文文本
 * @param {string} html
 * @returns {string}
 */
export function extractWeChatArticleText(html) {
  if (!html) return '';

  try {
    const $ = cheerio.load(html);
    const container = $('#js_content').length ? $('#js_content') : $('.rich_media_content');

    if (container.length === 0) {
      return $('body').text().replace(/\s+/g, ' ').trim();
    }

    container.find('script, style').remove();
    return container.text().replace(/\s+/g, ' ').trim();
  } catch (error) {
    return '';
  }
}

/**
 * 根据正文构建摘要片段
 * @param {string} content
 * @param {number} maxLength
 * @returns {string}
 */
export function buildWeChatContentSnippet(content, maxLength = 600) {
  if (!content) return '';
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.slice(0, maxLength);
}
