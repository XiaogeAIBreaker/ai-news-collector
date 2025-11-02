import axios from 'axios';
import { BaseCollector } from './base.js';
import { NewsItem } from '../models/news-item.js';
import WeChatLoginService from '../services/wechat-login.js';
import TokenStore from '../storage/token-store.js';
import { delay, getRandomDelay } from '../utils/helpers.js';

/**
 * 微信公众号 MP 采集器
 * 使用公众号后台接口采集文章,通过二维码扫码登录实现零配置
 *
 * 技术方案:
 * 1. 自动二维码登录获取 token
 * 2. 调用 /cgi-bin/appmsgpublish 接口获取文章列表
 * 3. 解析多层嵌套的 JSON 响应 (publish_page → publish_info → appmsgex)
 * 4. Token 自动管理和过期重新登录
 *
 * ⚠️  仅供学习研究使用,请勿用于商业用途
 */
export class WeChatMPCollector extends BaseCollector {
  constructor(config) {
    super(config);

    // 初始化登录服务和 Token 存储
    this.loginService = new WeChatLoginService();
    this.tokenStore = new TokenStore();

    // 从配置中读取公众号列表
    this.accounts = config.config?.accounts || [];

    // API 配置
    this.baseUrl = 'https://mp.weixin.qq.com';
    this.apiUrl = config.config?.apiUrl || `${this.baseUrl}/cgi-bin/appmsgpublish`;

    // 频率控制配置
    this.rateLimit = config.config?.rateLimit || {
      minDelay: 3000,
      maxDelay: 5000,
    };

    // 当前的 token 和 cookie
    this.currentToken = null;
    this.currentCookie = null;
  }

  /**
   * 采集新闻 - 主入口
   * @returns {Promise<NewsItem[]>}
   */
  async collect() {
    this.logger.info('开始采集微信公众号文章...');
    const startTime = Date.now();

    try {
      // 确保已登录
      await this.ensureAuthenticated();

      // 检查是否配置了公众号
      if (!this.accounts || this.accounts.length === 0) {
        this.logger.warn('未配置任何公众号,跳过采集');
        return [];
      }

      // 依次采集每个公众号
      const allNewsItems = [];

      for (let i = 0; i < this.accounts.length; i++) {
        const account = this.accounts[i];

        try {
          this.logger.info(`[${i + 1}/${this.accounts.length}] 采集公众号: ${account.nickname}`);

          // 采集该公众号的文章
          const newsItems = await this.collectAccount(account);
          allNewsItems.push(...newsItems);

          this.logger.success(`✅ ${account.nickname}: 获取 ${newsItems.length} 条文章`);
        } catch (error) {
          this.logger.error(`❌ ${account.nickname} 采集失败: ${error.message}`);
          // 继续采集下一个公众号
        }

        // 频率控制:在公众号之间添加延迟
        if (i < this.accounts.length - 1) {
          const delayMs = getRandomDelay(this.rateLimit.minDelay, this.rateLimit.maxDelay);
          await delay(delayMs);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.success(`采集完成,共获取 ${allNewsItems.length} 条文章 (耗时: ${duration}s)`);

      return allNewsItems;
    } catch (error) {
      this.logger.error('采集失败:', error.message);
      return [];
    }
  }

  /**
   * 确保已登录(自动处理登录和 token 管理)
   * @returns {Promise<void>}
   */
  async ensureAuthenticated() {
    // 尝试加载已保存的 token
    const savedToken = this.tokenStore.load();

    if (savedToken && savedToken.token && savedToken.cookie) {
      this.currentToken = savedToken.token;
      this.currentCookie = savedToken.cookie;
      this.logger.info('使用已保存的登录信息');
      return;
    }

    // Token 不存在或已过期,需要重新登录
    this.logger.info('需要登录微信公众号后台');
    await this.performLogin();
  }

  /**
   * 执行登录流程
   * @returns {Promise<void>}
   */
  async performLogin() {
    try {
      // 调用登录服务
      const loginInfo = await this.loginService.login();

      // 保存 token 到本地
      this.tokenStore.save({
        token: loginInfo.token,
        cookie: loginInfo.cookie,
        nickname: loginInfo.nickname,
      });

      // 更新当前 token
      this.currentToken = loginInfo.token;
      this.currentCookie = loginInfo.cookie;

      this.logger.success('登录成功并已保存凭证');
    } catch (error) {
      throw new Error(`登录失败: ${error.message}`);
    }
  }

  /**
   * 采集单个公众号的文章
   * @param {Object} account - 公众号配置
   * @returns {Promise<NewsItem[]>}
   */
  async collectAccount(account) {
    try {
      // 调用 appmsgpublish 接口
      const response = await this.fetchArticleList(account);

      // 检查响应状态
      if (response.base_resp && response.base_resp.ret !== 0) {
        // ret=200003 表示 token 过期
        if (response.base_resp.ret === 200003) {
          this.logger.warn('Token 已过期,尝试重新登录...');
          await this.performLogin();
          // 重试请求
          return await this.collectAccount(account);
        }

        throw new Error(`接口返回错误: ret=${response.base_resp.ret}`);
      }

      // 解析多层嵌套的 JSON
      const articles = this.parseResponse(response);

      // 转换为 NewsItem
      const newsItems = this.convertToNewsItems(articles, account.nickname);

      // 验证数据
      const { valid, invalid } = this.validateNewsItems(newsItems);

      if (invalid.length > 0) {
        this.logger.warn(`${account.nickname}: 过滤掉 ${invalid.length} 条无效文章`);
      }

      return valid;
    } catch (error) {
      throw new Error(`${account.nickname} 采集失败: ${error.message}`);
    }
  }

  /**
   * 调用 appmsgpublish 接口获取文章列表
   * @param {Object} account - 公众号配置
   * @param {number} begin - 分页起始位置
   * @returns {Promise<Object>} API 响应
   */
  async fetchArticleList(account, begin = 0) {
    const params = {
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
      ajax: 1,
    };

    const headers = {
      'Cookie': this.currentCookie,
      'Referer': 'https://mp.weixin.qq.com/',
      'Origin': 'https://mp.weixin.qq.com',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    };

    // 使用 retryWithBackoff 进行请求
    const fetchFn = async () => {
      const response = await axios.get(this.apiUrl, {
        params,
        headers,
        timeout: this.config.timeout || 30000,
      });
      return response.data;
    };

    return await this.retryWithBackoff(fetchFn);
  }

  /**
   * 解析多层嵌套的 JSON 响应
   * @param {Object} response - API 响应
   * @returns {Array} 文章数组
   */
  parseResponse(response) {
    try {
      // 第一层解析: publish_page 是 JSON 字符串
      if (!response.publish_page) {
        this.logger.warn('响应中缺少 publish_page 字段');
        return [];
      }

      let publishPage;
      try {
        publishPage = JSON.parse(response.publish_page);
      } catch (error) {
        throw new Error(`第一层 JSON 解析失败: ${error.message}`);
      }

      // 提取 publish_list 数组
      const publishList = publishPage.publish_list || [];

      if (publishList.length === 0) {
        this.logger.debug('publish_list 为空,没有文章');
        return [];
      }

      // 第二层解析: 每个 publish_info 也是 JSON 字符串
      const articles = [];

      for (const item of publishList) {
        // 过滤掉没有 publish_info 的项
        if (!item.publish_info) {
          continue;
        }

        let publishInfo;
        try {
          publishInfo = JSON.parse(item.publish_info);
        } catch (error) {
          this.logger.warn(`第二层 JSON 解析失败,跳过该项: ${error.message}`);
          continue;
        }

        // 第三层提取: appmsgex 数组包含实际的文章数据
        const appmsgex = publishInfo.appmsgex || [];

        if (Array.isArray(appmsgex)) {
          articles.push(...appmsgex);
        }
      }

      return articles;
    } catch (error) {
      this.logger.error('JSON 解析失败:', error.message);
      throw error;
    }
  }

  /**
   * 将文章数据转换为 NewsItem
   * @param {Array} articles - 文章数组
   * @param {string} accountName - 公众号名称
   * @returns {NewsItem[]}
   */
  convertToNewsItems(articles, accountName) {
    return articles.map((article) => {
      // 提取标题
      const title = article.title || '';

      // 提取摘要(如果为空则使用标题)
      let summary = article.digest || '';
      if (!summary || summary.length < 10) {
        summary = title;
      }

      // 确保摘要长度在 10-2000 范围内
      if (summary.length < 10) {
        summary = summary.padEnd(10, '.');
      } else if (summary.length > 2000) {
        summary = summary.substring(0, 2000);
      }

      // 提取 URL
      let url = article.link || '';
      // 补全协议
      if (url && !url.startsWith('http')) {
        url = `https://mp.weixin.qq.com${url.startsWith('/') ? '' : '/'}${url}`;
      }

      // 解析发布时间 (Unix 时间戳,秒级)
      let createdAt = new Date();
      if (article.update_time) {
        createdAt = new Date(article.update_time * 1000);
      } else if (article.create_time) {
        createdAt = new Date(article.create_time * 1000);
      }

      // 构建 metadata
      const metadata = {
        aid: article.aid,
        appmsgid: article.appmsgid,
        author_name: article.author_name,
        copyright_stat: article.copyright_stat,
        cover: article.cover || article.cover_img,
        itemidx: article.itemidx,
        album_id: article.album_id,
        item_show_type: article.item_show_type,
      };

      // 创建 NewsItem
      return new NewsItem({
        title,
        summary,
        url,
        source: accountName,
        createdAt,
        metadata,
      });
    });
  }

}
