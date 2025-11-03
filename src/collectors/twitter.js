import { Composio } from '@composio/core';
import { BaseCollector } from './base.js';
import { NewsItem } from '../models/news-item.js';
import { TWITTER_CONFIG } from '../config/datasources.js';

/**
 * 常量定义
 */
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const MIN_RESULTS_PER_PAGE = 10;
const MAX_RESULTS_PER_PAGE = 100;
const DEFAULT_SINCE_HOURS = 168;
const DEFAULT_QUERY_SUFFIX = '-is:retweet';
const DEFAULT_FALLBACK_QUERIES = ['AI', 'Artificial Intelligence', '大模型', 'AIGC'];
const DEFAULT_TWEET_FIELDS = [
  'created_at',
  'lang',
  'source',
  'public_metrics',
  'referenced_tweets',
  'entities'
];
const DEFAULT_USER_FIELDS = [
  'username',
  'name',
  'profile_image_url',
  'verified',
  'description',
  'location'
];
const DEFAULT_EXPANSIONS = ['author_id'];

/**
 * 去除 Emoji 与多余空白,保证摘要可读性
 */
function sanitizeTweetText(text = '') {
  const withoutEmoji = text.replace(/\p{Extended_Pictographic}+/gu, '');
  return withoutEmoji.replace(/\s+/g, ' ').trim();
}

/**
 * 根据用户名与推文 ID 生成 URL
 */
function buildTweetUrl(username, tweetId) {
  if (!tweetId) return '';
  const handle = username || 'unknown';
  return `https://twitter.com/${handle}/status/${tweetId}`;
}

/**
 * 将数值限制在指定区间
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Twitter 数据源采集器
 */
export class TwitterCollector extends BaseCollector {
  constructor(config = TWITTER_CONFIG) {
    super(config);
    this.seenTweetIds = new Set();
  }

  /**
   * 采集 Twitter 新闻入口
   * @returns {Promise<NewsItem[]>}
   */
  async collect() {
    const apiKey = process.env.COMPOSIO_API_KEY;
    const connectionId = process.env.COMPOSIO_CONNECTION_ID;
    const userId = process.env.COMPOSIO_USER_ID;

    if (!apiKey || !connectionId || !userId) {
      this.logger.warn('缺少 Composio 环境变量(COMPOSIO_API_KEY/COMPOSIO_CONNECTION_ID/COMPOSIO_USER_ID),跳过 Twitter 采集');
      return [];
    }

    const settings = this.config.config.settings || {};
    const { accounts = [], config = {}, keywords = [] } = settings;
    const enabledAccounts = accounts.filter(account => account?.enabled !== false);
    if (enabledAccounts.length === 0) {
      if (keywords.length === 0) {
        this.logger.info('Twitter 未配置推主,将使用默认关键词');
      } else {
        this.logger.info('Twitter 未配置推主,改用关键词搜索');
      }
    }

    const defaultSuffix = typeof config.defaultQuerySuffix === 'string'
      ? config.defaultQuerySuffix.trim()
      : DEFAULT_QUERY_SUFFIX;

    const defaultLanguages = Array.isArray(config.defaultLanguages)
      ? config.defaultLanguages.filter(Boolean)
      : [];

    const sinceHours = clamp(
      typeof config.sinceHours === 'number' ? config.sinceHours : DEFAULT_SINCE_HOURS,
      1,
      DEFAULT_SINCE_HOURS
    );

    const maxResultsPerPage = clamp(
      typeof config.maxResultsPerPage === 'number' ? config.maxResultsPerPage : MAX_RESULTS_PER_PAGE,
      MIN_RESULTS_PER_PAGE,
      MAX_RESULTS_PER_PAGE
    );

    const fallbackQueries = Array.isArray(keywords) && keywords.length > 0
      ? keywords
      : DEFAULT_FALLBACK_QUERIES;

    const searchPlans = this.createSearchPlans(enabledAccounts, {
      defaultSuffix,
      defaultLanguages,
      fallbackQueries
    });

    if (searchPlans.length === 0) {
      this.logger.warn('Twitter 推主均被禁用且没有有效关键词,跳过采集');
      return [];
    }

    const collector = new Composio({ apiKey });
    const startTime = new Date(Date.now() - sinceHours * MILLISECONDS_PER_HOUR).toISOString();
    const collectedItems = [];
    this.seenTweetIds.clear();

    for (const plan of searchPlans) {
      if (collectedItems.length >= this.config.maxItems) {
        break;
      }

      try {
        const remaining = this.config.maxItems - collectedItems.length;
        const items = await this.fetchTweetsForPlan({
          plan,
          collector,
          connectionId,
          userId,
          startTime,
          maxResultsPerPage,
          remaining
        });

        collectedItems.push(...items);
      } catch (error) {
        this.logger.error(`查询 "${plan.label}" 失败: ${error.message}`);
      }
    }

    const validation = this.validateNewsItems(collectedItems);
    if (validation.invalid.length > 0) {
      this.logger.warn(`Twitter 返回 ${validation.invalid.length} 条无效数据,已自动过滤`);
    }

    this.logger.success(`Twitter 采集完成,获取 ${validation.valid.length} 条内容 (去重后)`);
    return validation.valid;
  }

  /**
   * 构造搜索计划
   * @param {Array} accounts 推主列表
   * @param {Object} defaults 默认配置
   * @returns {Array<Object>} 搜索计划数组
   */
  createSearchPlans(accounts, defaults) {
    const plans = [];

    accounts.forEach(account => {
      const handle = (account.handle || '').replace(/^@/, '').trim();
      if (!handle) return;

      const baseQuery = (account.query && account.query.trim().length > 0)
        ? account.query.trim()
        : `from:${handle}${defaults.defaultSuffix ? ` ${defaults.defaultSuffix}` : ''}`.trim();

      const languages = Array.isArray(account.languages) && account.languages.length > 0
        ? account.languages.filter(Boolean)
        : defaults.defaultLanguages;

      const languageList = languages.length > 0 ? languages : [null];

      languageList.forEach(language => {
        plans.push({
          type: 'account',
          label: account.displayName || handle,
          handle,
          language,
          tags: Array.isArray(account.tags) ? account.tags : [],
          query: appendLanguage(baseQuery, language)
        });
      });
    });

    if (plans.length === 0 && defaults.fallbackQueries.length > 0) {
      const combined = defaults.fallbackQueries
        .map(keyword => keyword.includes(' ') ? `"${keyword}"` : keyword)
        .join(' OR ');

      const fallbackLanguages = defaults.defaultLanguages.length > 0
        ? defaults.defaultLanguages
        : [null];

      fallbackLanguages.forEach(language => {
        plans.push({
          type: 'keyword',
          label: 'Fallback Keywords',
          handle: '',
          language,
          tags: [],
          query: appendLanguage(`(${combined}) ${defaults.defaultSuffix}`.trim(), language)
        });
      });
    }

    return plans;
  }

  /**
   * 执行单个搜索计划
   * @param {Object} options 参数集合
   * @returns {Promise<NewsItem[]>}
   */
  async fetchTweetsForPlan({
    plan,
    collector,
    connectionId,
    userId,
    startTime,
    maxResultsPerPage,
    remaining
  }) {
    const items = [];
    let nextToken;

    this.logger.info(`执行 Twitter 查询: ${plan.query}`);

    while (items.length < remaining) {
      const searchParams = {
        query: plan.query,
        max_results: clamp(maxResultsPerPage, MIN_RESULTS_PER_PAGE, MAX_RESULTS_PER_PAGE),
        start_time: startTime,
        tweet_fields: DEFAULT_TWEET_FIELDS,
        user_fields: DEFAULT_USER_FIELDS,
        expansions: DEFAULT_EXPANSIONS
      };

      if (nextToken) {
        searchParams.next_token = nextToken;
      }

      const response = await this.retryWithBackoff(() =>
        this.executeSearch(collector, {
          connectedAccountId: connectionId,
          userId,
          arguments: searchParams,
          dangerouslySkipVersionCheck: true
        })
      );

      const tweets = Array.isArray(response.data) ? response.data : [];
      if (tweets.length === 0) {
        this.logger.debug(`查询 "${plan.label}" 已无更多结果`);
        break;
      }

      const userMap = buildUserMap(response.includes?.users || []);
      tweets.forEach(tweet => {
        if (items.length >= remaining) {
          return;
        }

        if (this.seenTweetIds.has(tweet.id)) {
          return;
        }

        const newsItem = this.buildNewsItem(tweet, {
          user: userMap.get(tweet.author_id),
          plan
        });

        if (newsItem) {
          this.seenTweetIds.add(tweet.id);
          items.push(newsItem);
        }
      });

      const meta = response.meta || {};
      if (!meta.next_token) {
        break;
      }

      nextToken = meta.next_token;
      this.logger.debug(`查询 "${plan.label}" 获取下一页, next_token=${nextToken}`);
    }

    this.logger.success(`查询 "${plan.label}" 获取 ${items.length} 条推文`);
    return items;
  }

  /**
   * 调用 Composio 执行 Twitter 搜索
   * @param {Composio} collector
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async executeSearch(collector, payload) {
    const result = await collector.tools.execute('TWITTER_RECENT_SEARCH', payload);

    if (!result.successful) {
      const message = result.error || 'Twitter 工具执行失败';
      throw new Error(message);
    }

    return result.data || {};
  }

  /**
   * 构造 NewsItem
   * @param {Object} tweet
   * @param {Object} context
   * @returns {NewsItem|null}
   */
  buildNewsItem(tweet, { user, plan }) {
    const rawText = tweet?.text || '';
    const summary = sanitizeTweetText(rawText).slice(0, 400).trim();

    if (!summary || summary.length < 10) {
      return null;
    }

    const title = summary.length > 120 ? `${summary.slice(0, 117)}...` : summary;
    const username = user?.username || tweet?.author_id;
    const url = buildTweetUrl(username, tweet?.id);
    const metrics = tweet?.public_metrics || {};

    const metadata = {
      accountHandle: plan.handle || username,
      accountName: user?.name || plan.label,
      author: user?.name || plan.label,
      language: tweet?.lang,
      query: plan.query,
      tags: plan.tags,
      type: plan.type,
      metrics,
      likes: metrics.like_count,
      comments: metrics.reply_count,
      retweets: metrics.retweet_count,
      quotes: metrics.quote_count
    };

    return new NewsItem({
      id: tweet?.id,
      title,
      summary,
      url,
      source: this.config.name,
      createdAt: tweet?.created_at || new Date().toISOString(),
      metadata
    });
  }
}

/**
 * 根据语言拼接查询
 * @param {string} query
 * @param {string|null} language
 * @returns {string}
 */
function appendLanguage(query, language) {
  if (!language) {
    return query.trim();
  }

  if (query.includes(`lang:${language}`)) {
    return query.trim();
  }

  return `${query.trim()} lang:${language}`.trim();
}

/**
 * 构建 author_id 到用户详情的映射
 * @param {Array} users
 * @returns {Map<string, Object>}
 */
function buildUserMap(users) {
  const map = new Map();
  users.forEach(user => {
    if (user?.id) {
      map.set(user.id, user);
    }
  });
  return map;
}

export const __TESTING__ = {
  sanitizeTweetText,
  appendLanguage,
  clamp
};
