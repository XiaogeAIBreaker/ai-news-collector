import { Composio } from '@composio/core';
import { BaseCollector } from './base.js';
import { NewsItem } from '../models/news-item.js';
import { YOUTUBE_CONFIG } from '../config/datasources.js';
import { getRecentCutoff, getRecentDays } from '../config/collection-window.js';
import { partitionByGlobalRecency } from '../utils/recency.js';

/**
 * 常量定义
 */
const DEFAULT_MAX_ITEMS_PER_CHANNEL = 20;
const DEFAULT_MAX_RESULTS_PER_KEYWORD = 15;
const DEFAULT_MAX_RESULTS_PER_PAGE = 50; // 单次 API 请求的默认最大结果数
const DEFAULT_LANGUAGE = 'zh';
const DEFAULT_BATCH_SIZE = 50; // YouTube API 支持单次批量获取最多 50 个视频详情
const MAX_TITLE_LENGTH = 120;
const MAX_SUMMARY_LENGTH = 400;

/**
 * 去除 Emoji、URL、时间戳、HTML 实体,保证文本可读性
 * @param {string} text - 需要清洗的文本
 * @returns {string} 清洗后的文本
 */
function sanitizeVideoText(text = '') {
  // 移除 Emoji
  let cleaned = text.replace(/\p{Extended_Pictographic}+/gu, '');

  // 移除 URL (http/https 链接)
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, '');

  // 移除时间戳格式 (HH:MM:SS 或 MM:SS)
  cleaned = cleaned.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, '');

  // 移除 HTML 实体
  cleaned = cleaned
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // 合并多个空白为单个空格
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * 根据视频 ID 生成 YouTube 视频 URL
 * @param {string} videoId - YouTube 视频 ID
 * @returns {string} 视频 URL
 */
function buildVideoUrl(videoId) {
  if (!videoId) return '';
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * 将数值限制在指定区间
 * @param {number} value - 原始值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 限制后的值
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * T031: 构建关键词查询字符串 (组合多个关键词为 OR 查询)
 * @param {string[]} keywords - 关键词数组
 * @param {Object} options - 配置选项
 * @param {string} options.queryPrefix - 查询前缀 (如 -is:live 排除直播)
 * @returns {string} 组合后的查询字符串
 * @example
 * buildKeywordQuery(['AI', 'Machine Learning', '大模型'], { queryPrefix: '-is:live' })
 * // => '(AI OR "Machine Learning" OR 大模型) -is:live'
 */
function buildKeywordQuery(keywords, options = {}) {
  const { queryPrefix = '-is:live' } = options;

  if (!keywords || keywords.length === 0) {
    return queryPrefix.trim();
  }

  // 组合关键词 (带空格的关键词用引号包裹)
  const terms = keywords
    .map(k => k.includes(' ') ? `"${k}"` : k)
    .join(' OR ');

  // 如果只有一个关键词,不需要括号
  const query = keywords.length === 1 ? terms : `(${terms})`;

  return queryPrefix ? `${query} ${queryPrefix}`.trim() : query;
}

/**
 * YouTube 数据源采集器
 * 通过 Composio 平台调用 YouTube Data API v3 获取视频数据
 */
export class YouTubeCollector extends BaseCollector {
  constructor(config = YOUTUBE_CONFIG) {
    super(config);
    this.seenVideoIds = new Set(); // 用于去重
  }

  /**
   * 采集 YouTube 视频数据入口
   * @returns {Promise<NewsItem[]>} 符合 NewsItem 结构的视频列表
   */
  async collect() {
    // T012: 读取和验证环境变量
    const apiKey = process.env.COMPOSIO_API_KEY;
    const connectionId = process.env.COMPOSIO_CONNECTION_ID_YOUTUBE;
    const userId = process.env.COMPOSIO_USER_ID_YOUTUBE;

    // T013: 优雅降级 - 环境变量缺失时返回空数组
    if (!apiKey || !connectionId || !userId) {
      this.logger.warn(
        '缺少 Composio 环境变量 (COMPOSIO_API_KEY/COMPOSIO_CONNECTION_ID_YOUTUBE/COMPOSIO_USER_ID_YOUTUBE), 跳过 YouTube 采集'
      );
      return [];
    }

    // 加载配置
    const settings = this.config.config.settings || {};
    const { channels = [], keywords = [], config = {} } = settings;

    // 过滤出启用的频道
    const enabledChannels = channels.filter(channel => channel?.enabled !== false);

    if (enabledChannels.length === 0 && keywords.length === 0) {
      this.logger.warn('未配置任何 YouTube 频道或关键词, 跳过采集');
      return [];
    }

    this.logger.info(`开始采集 YouTube: ${enabledChannels.length} 个频道, ${keywords.length} 个关键词`);

    // T016: 初始化 Composio SDK
    const composio = new Composio({ apiKey });

    // 获取全局时间窗口配置
    const recentDays = getRecentDays();
    const cutoffDate = getRecentCutoff();

    this.logger.info(`时间窗口: 最近 ${recentDays} 天 (截止 ${cutoffDate.toISOString()})`);

    // T014: 创建搜索计划 (包括频道和关键词)
    // 传递 config 对象和默认值 (从顶层配置读取)
    const defaults = {
      defaultMaxItemsPerChannel: DEFAULT_MAX_ITEMS_PER_CHANNEL,
      defaultMaxResultsPerKeyword: DEFAULT_MAX_RESULTS_PER_KEYWORD,
      defaultLanguage: DEFAULT_LANGUAGE,
      maxResultsPerPage: DEFAULT_MAX_RESULTS_PER_PAGE
    };

    const searchPlans = this.createSearchPlans(enabledChannels, keywords, config, defaults);
    this.logger.info(`生成了 ${searchPlans.length} 个搜索计划`);

    // 执行所有搜索计划
    const allNewsItems = [];

    for (const plan of searchPlans) {
      try {
        // 根据计划类型生成日志名称
        const planName = plan.type === 'keyword'
          ? `关键词:${plan.description || plan.query}`
          : plan.displayName || plan.channelId;

        const planIdentifier = plan.type === 'keyword'
          ? `关键词 "${plan.query}"`
          : `频道 ${plan.channelId}`;

        this.logger.info(`[${planName}] 开始采集${planIdentifier}`);

        // T017-T018: 获取视频 ID 列表
        const videoIds = await this.fetchVideosForPlan(plan, composio, connectionId, userId);

        if (videoIds.length === 0) {
          this.logger.info(`[${planName}] 未找到视频`);
          continue;
        }

        // T025: 去重逻辑 - 过滤掉已采集的视频
        const newVideoIds = videoIds.filter(id => !this.seenVideoIds.has(id));

        if (newVideoIds.length === 0) {
          this.logger.info(`[${planName}] 所有视频已采集过,跳过`);
          continue;
        }

        this.logger.info(`[${planName}] 找到 ${videoIds.length} 个视频, 去重后 ${newVideoIds.length} 个`);

        // T019-T020: 批量获取视频详情
        const videos = await this.batchGetVideoDetails(newVideoIds, composio, connectionId, userId);

        if (videos.length === 0) {
          this.logger.warn(`[${planName}] 批量获取视频详情失败`);
          continue;
        }

        // T021-T024: 转换为 NewsItem
        const contextName = plan.type === 'keyword' ? `搜索:${plan.query}` : plan.displayName || plan.channelId;
        const newsItems = videos
          .map(video => this.buildNewsItem(video, {
            channelName: contextName,
            plan // 传入完整的 plan 对象,以便获取 handle, tags 等信息
          }))
          .filter(item => item !== null); // 过滤无效的 NewsItem

        // 记录已采集的视频 ID
        newVideoIds.forEach(id => this.seenVideoIds.add(id));

        this.logger.info(`[${planName}] 成功转换 ${newsItems.length} 条 NewsItem`);

        allNewsItems.push(...newsItems);
      } catch (error) {
        const planName = plan.type === 'keyword'
          ? `关键词:${plan.description || plan.query}`
          : plan.displayName || plan.channelId;
        this.logger.error(`[${planName}] 采集失败: ${error.message}`);
      }
    }

    if (allNewsItems.length === 0) {
      this.logger.warn('未采集到任何 YouTube 视频');
      return [];
    }

    // T026: 时间窗口过滤
    const { recent: recentItems, outdated: outdatedItems } = partitionByGlobalRecency(allNewsItems);

    if (outdatedItems.length > 0) {
      this.logger.info(`过滤掉 ${outdatedItems.length} 条超过时间窗口的视频`);
    }

    // T027: 数据验证
    const { valid: validatedItems, invalid: invalidItems } = this.validateNewsItems(recentItems);

    if (invalidItems.length > 0) {
      this.logger.warn(`过滤掉 ${invalidItems.length} 条无效的 NewsItem`);
    }

    this.logger.info(`YouTube 采集完成: 共 ${validatedItems.length} 条有效新闻`);

    return validatedItems;
  }

  /**
   * T014: 构造搜索计划
   * @param {Array} channels - 频道配置列表
   * @param {Array<string>} keywords - 关键词字符串数组 (per data-model.md)
   * @param {Object} config - 全局配置对象
   * @param {Object} defaults - 默认参数
   * @returns {Array<SearchPlan>} 搜索计划数组
   */
  createSearchPlans(channels, keywords, config, defaults) {
    const plans = [];

    // 读取全局配置的 maxResultsPerPage (FR-010)
    const maxResultsPerPage = config.maxResultsPerPage || defaults.maxResultsPerPage || DEFAULT_MAX_RESULTS_PER_PAGE;

    // T039-T043: 按照 User Story 5 要求,记录配置参数的使用情况
    this.logger.info(`配置参数: maxResultsPerPage=${maxResultsPerPage}` +
      (config.maxResultsPerPage ? ' (来自配置)' : ' (使用默认值)'));

    // 为每个启用的频道创建搜索计划
    channels.forEach(channel => {
      // T015: 频道 ID 到播放列表 ID 的转换 (UC -> UU)
      const playlistId = this.convertChannelIdToPlaylistId(channel.channelId);

      // 按照 User Story 1: 跳过无效的频道 ID,继续处理其他频道
      if (!playlistId) {
        this.logger.warn(`跳过无效频道: ${channel.displayName || channel.channelId}`);
        return; // forEach 的 return 相当于 continue
      }

      // T039: 优先读取 config.maxItemsPerChannel, 然后是频道级别配置, 最后是默认值
      const maxItems = config.maxItemsPerChannel ||
                       channel.maxItemsPerChannel ||
                       defaults.defaultMaxItemsPerChannel ||
                       DEFAULT_MAX_ITEMS_PER_CHANNEL;

      // T039-T043: 记录频道级配置参数来源
      const maxItemsSource = config.maxItemsPerChannel ? '全局配置' :
                             channel.maxItemsPerChannel ? '频道配置' : '默认值';
      this.logger.debug(`[${channel.displayName || channel.channelId}] maxItems=${maxItems} (来自${maxItemsSource})`);

      // 按照 data-model.md:133-175 规范,SearchPlan 包含频道的完整配置信息
      plans.push({
        type: 'channel',
        channelId: channel.channelId,
        displayName: channel.displayName,
        handle: channel.handle,
        tags: channel.tags || [],
        languages: channel.languages,
        keywords: channel.keywords || [], // 频道级关键词过滤
        playlistId,
        maxItems,
        maxResultsPerPage
      });
    });

    // T031-T034: 关键词搜索 - 按照 tasks.md:163 要求,合并为单次 OR 查询
    if (keywords && keywords.length > 0) {
      // T042: 支持 defaultLanguages (复数) 或 defaultLanguage (单数)
      const languages = config.defaultLanguages ||
                        (config.defaultLanguage ? [config.defaultLanguage] : null) ||
                        (defaults.defaultLanguage ? [defaults.defaultLanguage] : null) ||
                        [DEFAULT_LANGUAGE];

      const primaryLanguage = languages[0]; // 使用第一个语言作为主语言

      // 读取关键词搜索的最大结果数
      const maxResults = config.maxResultsPerKeyword ||
                         defaults.defaultMaxResultsPerKeyword ||
                         DEFAULT_MAX_RESULTS_PER_KEYWORD;

      const queryPrefix = config.queryPrefix || '-is:live'; // 默认排除直播

      // T039-T043: 记录关键词搜索配置参数
      this.logger.info(`关键词搜索配置: maxResults=${maxResults}` +
        (config.maxResultsPerKeyword ? ' (来自配置)' : ' (使用默认值)') +
        `, language=${primaryLanguage}, queryPrefix="${queryPrefix}"`);

      // T031: 使用 buildKeywordQuery() 合并多个关键词为 OR 查询
      const mergedQuery = buildKeywordQuery(keywords, { queryPrefix });

      this.logger.info(`T031: 合并 ${keywords.length} 个关键词为单次查询: ${mergedQuery}`);

      // T032: 创建单个关键词搜索计划 (合并后的 OR 查询)
      plans.push({
        type: 'keyword',
        query: mergedQuery,
        keywords: keywords, // 保留原始关键词列表用于日志
        language: primaryLanguage,
        maxItems: maxResults,
        maxResultsPerPage,
        description: `合并关键词: ${keywords.join(', ')}`
      });
    }

    return plans;
  }

  /**
   * T015: 将频道 ID 转换为上传播放列表 ID
   * YouTube 频道的上传播放列表 ID 规则: UCxxxxxx -> UUxxxxxx
   * @param {string} channelId - YouTube 频道 ID
   * @returns {string|null} 播放列表 ID,无效时返回 null
   */
  convertChannelIdToPlaylistId(channelId) {
    // 按照 User Story 1 要求:遇到无效频道 ID 时记录错误并继续处理其他频道
    if (!channelId || typeof channelId !== 'string' || !channelId.startsWith('UC')) {
      this.logger.warn(`无效的频道 ID: ${channelId}, 频道 ID 必须以 "UC" 开头,跳过该频道`);
      return null;
    }
    return 'UU' + channelId.slice(2); // 将 UC 替换为 UU
  }

  /**
   * T017-T018: 执行单个搜索计划,获取视频 ID 列表
   * @param {SearchPlan} plan - 搜索计划
   * @param {Composio} composio - Composio SDK 实例
   * @param {string} connectionId - 连接 ID
   * @param {string} userId - 用户 ID (entityId)
   * @returns {Promise<string[]>} 视频 ID 列表
   */
  async fetchVideosForPlan(plan, composio, connectionId, userId) {
    // 根据计划类型选择不同的获取方法
    if (plan.type === 'keyword') {
      return await this.fetchVideosForKeyword(plan, composio, connectionId, userId);
    }

    // 默认:频道播放列表方法
    const videoIds = [];
    let pageToken = null;
    let remainingItems = plan.maxItems;
    // 读取配置的单次请求最大结果数 (FR-010)
    const maxResultsPerPage = plan.maxResultsPerPage || DEFAULT_MAX_RESULTS_PER_PAGE;

    try {
      // T018: 分页逻辑 - 持续获取直到达到限额或无更多结果
      do {
        const params = {
          playlistId: plan.playlistId,
          part: 'snippet,contentDetails',
          maxResults: Math.min(maxResultsPerPage, remainingItems), // 尊重配置的分页大小
          ...(pageToken && { pageToken }) // 分页 token
        };

        // T017: 调用 playlistItems.list API
        const response = await this.retryWithBackoff(async () => {
          return await composio.tools.execute('YOUTUBE_LIST_PLAYLIST_ITEMS', {
            connectedAccountId: connectionId,
            userId,
            arguments: params,
            dangerouslySkipVersionCheck: true
          });
        });

        if (!response || !response.data) {
          this.logger.warn(`[${plan.displayName || plan.channelId}] API 响应为空`);
          break;
        }

        const items = response.data.items || [];

        // 提取视频 ID
        for (const item of items) {
          const videoId = item?.contentDetails?.videoId || item?.snippet?.resourceId?.videoId;
          if (videoId) {
            videoIds.push(videoId);
          }
        }

        // 更新分页 token 和剩余数量
        pageToken = response.data.nextPageToken;
        remainingItems -= items.length;

        // 如果达到限额或无更多结果,停止分页
        if (remainingItems <= 0 || !pageToken) {
          break;
        }
      } while (true);

      return videoIds;
    } catch (error) {
      this.logger.error(`[${plan.displayName || plan.channelId}] 获取视频列表失败: ${error.message}`);
      return videoIds; // 返回已获取的部分结果
    }
  }

  /**
   * 通过关键词搜索获取视频 ID 列表 (US3)
   * @param {SearchPlan} plan - 关键词搜索计划
   * @param {Composio} composio - Composio SDK 实例
   * @param {string} connectionId - 连接 ID
   * @param {string} userId - 用户 ID (entityId)
   * @returns {Promise<string[]>} 视频 ID 列表
   */
  async fetchVideosForKeyword(plan, composio, connectionId, userId) {
    const videoIds = [];
    let pageToken = null;
    let remainingItems = plan.maxItems;
    const planName = plan.description || plan.query;
    // 读取配置的单次请求最大结果数 (FR-010)
    const maxResultsPerPage = plan.maxResultsPerPage || DEFAULT_MAX_RESULTS_PER_PAGE;

    try {
      do {
        const params = {
          q: plan.query,
          part: 'id',
          type: 'video',
          maxResults: Math.min(maxResultsPerPage, remainingItems), // 尊重配置的分页大小
          order: 'date', // 按发布日期排序
          ...(plan.language && { relevanceLanguage: plan.language }),
          ...(pageToken && { pageToken })
        };

        const response = await this.retryWithBackoff(async () => {
          return await composio.tools.execute('YOUTUBE_SEARCH_VIDEOS', {
            connectedAccountId: connectionId,
            userId,
            arguments: params,
            dangerouslySkipVersionCheck: true
          });
        });

        if (!response || !response.data) {
          this.logger.warn(`[关键词:${planName}] API 响应为空`);
          break;
        }

        const items = response.data.items || [];

        // 提取视频 ID
        for (const item of items) {
          const videoId = item?.id?.videoId;
          if (videoId) {
            videoIds.push(videoId);
          }
        }

        // 更新分页
        pageToken = response.data.nextPageToken;
        remainingItems -= items.length;

        if (remainingItems <= 0 || !pageToken) {
          break;
        }
      } while (true);

      return videoIds;
    } catch (error) {
      this.logger.error(`[关键词:${planName}] 搜索视频失败: ${error.message}`);
      return videoIds;
    }
  }

  /**
   * T019-T020: 批量获取视频详情
   * @param {string[]} videoIds - 视频 ID 列表
   * @param {Composio} composio - Composio SDK 实例
   * @param {string} connectionId - 连接 ID
   * @param {string} userId - 用户 ID
   * @returns {Promise<Object[]>} 视频详情列表
   */
  async batchGetVideoDetails(videoIds, composio, connectionId, userId) {
    if (!videoIds || videoIds.length === 0) {
      return [];
    }

    const allVideos = [];

    try {
      // T020: 实现分组逻辑 - 每组 50 个
      const batchSize = DEFAULT_BATCH_SIZE;
      const batches = [];

      for (let i = 0; i < videoIds.length; i += batchSize) {
        batches.push(videoIds.slice(i, i + batchSize));
      }

      this.logger.info(`批量获取视频详情: ${videoIds.length} 个视频, 分为 ${batches.length} 组`);

      // 逐批获取视频详情
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];

        // T019: 调用 videos.list API 批量获取详情
        this.logger.debug(`批次 ${batchIndex + 1}: 请求 ${batch.length} 个视频详情, IDs=${batch.slice(0, 3).join(',') + (batch.length > 3 ? '...' : '')}`);

        const response = await this.retryWithBackoff(async () => {
          return await composio.tools.execute('YOUTUBE_VIDEO_DETAILS', {
            connectedAccountId: connectionId,
            userId,
            arguments: {
              id: batch.join(','), // videos.list 使用逗号分隔的 ID 字符串
              part: 'snippet,statistics,contentDetails'
            },
            dangerouslySkipVersionCheck: true
          });
        });

        if (!response || !response.data || !response.data.response_data) {
          this.logger.warn(`批次 ${batchIndex + 1}/${batches.length} API 响应为空`);
          continue;
        }

        // Composio 返回结构: response.data.response_data.items
        const items = response.data.response_data.items || [];

        allVideos.push(...items);

        this.logger.info(`批次 ${batchIndex + 1}/${batches.length} 获取到 ${items.length} 个视频详情`);
      }

      return allVideos;
    } catch (error) {
      this.logger.error(`批量获取视频详情失败: ${error.message}`);
      return allVideos; // 返回已获取的部分结果
    }
  }

  /**
   * T021-T024: 将 YouTube 视频转换为 NewsItem
   * @param {Object} video - YouTube API 视频对象
   * @param {Object} context - 上下文信息(频道名称、搜索类型)
   * @returns {NewsItem|null} 转换后的 NewsItem, 无效则返回 null
   */
  buildNewsItem(video, context = {}) {
    try {
      // Composio 返回蛇形命名,需要兼容两种格式
      const snippet = video?.snippet || video?.snippet_data;
      const statistics = video?.statistics || video?.statistics_data;
      const contentDetails = video?.contentDetails || video?.content_details;

      // T024: 必填字段验证 - id, title, publishedAt
      const rawTitle = snippet?.title;
      const publishedAt = snippet?.publishedAt || snippet?.published_at;

      if (!video?.id || !rawTitle || !publishedAt) {
        this.logger.warn(`视频缺少必填字段: ${JSON.stringify({ id: video?.id, title: rawTitle, publishedAt })}`);
        return null;
      }

      const videoId = video.id;
      const rawDescription = snippet.description || '';
      const channelId = snippet.channelId || snippet.channel_id;
      const channelTitle = snippet.channelTitle || snippet.channel_title || context.channelName || 'Unknown Channel';

      // T022: 字段映射 - 标题和摘要清洗
      const sanitizedTitle = sanitizeVideoText(rawTitle);
      const title = sanitizedTitle.length > MAX_TITLE_LENGTH
        ? sanitizedTitle.slice(0, MAX_TITLE_LENGTH) + '...'
        : sanitizedTitle;

      const sanitizedSummary = sanitizeVideoText(rawDescription);
      const summary = sanitizedSummary.length > MAX_SUMMARY_LENGTH
        ? sanitizedSummary.slice(0, MAX_SUMMARY_LENGTH) + '...'
        : sanitizedSummary;

      // 构建视频 URL
      const url = buildVideoUrl(videoId);

      // 解析发布时间并验证有效性
      const createdAt = new Date(publishedAt);
      if (isNaN(createdAt.getTime())) {
        this.logger.warn(`视频 ${videoId} 的发布时间无效: ${publishedAt}`);
        return null;
      }

      // T023: metadata 填充 - 保存原始数据和统计信息 (兼容蛇形命名)
      const viewCount = statistics?.viewCount || statistics?.view_count;
      const likeCount = statistics?.likeCount || statistics?.like_count;
      const commentCount = statistics?.commentCount || statistics?.comment_count;
      const categoryId = snippet?.categoryId || snippet?.category_id;
      const defaultLanguage = snippet?.defaultLanguage || snippet?.default_language;
      const liveBroadcastContent = snippet?.liveBroadcastContent || snippet?.live_broadcast_content;

      // 获取缩略图 URL (优先选择 medium 分辨率)
      const thumbnails = snippet.thumbnails || {};
      const thumbnailUrl = thumbnails.medium?.url || thumbnails.default?.url || thumbnails.high?.url || null;

      // 从 context.plan 获取频道级配置信息
      const plan = context.plan;
      const channelHandle = plan?.handle || null;
      const channelTags = plan?.tags || [];
      const searchType = plan?.type || 'unknown'; // 'channel' or 'keyword'

      const metadata = {
        videoId,
        channelId,
        channelTitle,
        channelName: context.channelName,
        channelHandle, // 频道 @ 句柄
        thumbnailUrl, // 视频缩略图 URL
        searchType, // 搜索类型: 'channel' 或 'keyword'
        tags: [...channelTags, ...(snippet.tags || [])], // 合并频道标签和视频标签
        duration: contentDetails?.duration || null,
        viewCount: viewCount ? parseInt(viewCount, 10) : 0,
        likeCount: likeCount ? parseInt(likeCount, 10) : 0,
        commentCount: commentCount ? parseInt(commentCount, 10) : 0,
        categoryId: categoryId || null,
        thumbnails: snippet.thumbnails || {},
        defaultLanguage: defaultLanguage || null,
        liveBroadcastContent: liveBroadcastContent || null
      };

      // 创建 NewsItem 实例
      return new NewsItem({
        id: videoId,
        title,
        summary,
        url,
        source: 'YouTube',
        sourceName: channelTitle,
        createdAt,
        metadata
      });
    } catch (error) {
      this.logger.error(`转换 NewsItem 失败: ${error.message}`);
      return null;
    }
  }
}
