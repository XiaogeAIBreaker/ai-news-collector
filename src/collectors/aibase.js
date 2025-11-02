import axios from 'axios';
import * as cheerio from 'cheerio';
import { BaseCollector } from './base.js';
import { NewsItem } from '../models/news-item.js';
import { AIBASE_CONFIG } from '../config/datasources.js';
import { AIBASE_SELECTORS, SelectorUtils } from './selectors.js';
import { COLLECTOR_CONSTANTS } from '../config/constants.js';

/**
 * AIBase 采集器
 * 从 https://www.aibase.com/zh/news 采集 AI 新闻
 */
export class AIBaseCollector extends BaseCollector {
  constructor(config = AIBASE_CONFIG) {
    super(config);
  }

  /**
   * 采集新闻 - 主入口
   * @returns {Promise<NewsItem[]>}
   */
  async collect() {
    this.logger.info('开始采集新闻...');
    const startTime = Date.now();

    try {
      // 优先使用 Cheerio 方式抓取
      try {
        this.logger.debug('尝试使用 Cheerio 方式抓取...');
        const newsItems = await this.scrapeWithCheerio();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        this.logger.success(`采集完成,获取 ${newsItems.length} 条新闻 (耗时: ${duration}s)`);
        return newsItems;
      } catch (cheerioError) {
        this.logger.warn('Cheerio 方式失败,尝试使用 Puppeteer 降级方案...');
        this.logger.debug('Cheerio 错误详情:', cheerioError.message);

        // 降级到 Puppeteer
        try {
          const newsItems = await this.scrapeWithPuppeteer();
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);
          this.logger.success(`采集完成(Puppeteer),获取 ${newsItems.length} 条新闻 (耗时: ${duration}s)`);
          return newsItems;
        } catch (puppeteerError) {
          this.logger.error('Puppeteer 方式也失败:', puppeteerError.message);
          return [];
        }
      }
    } catch (error) {
      this.logger.error('采集失败:', error.message);
      return [];
    }
  }

  /**
   * 使用 Cheerio 抓取网页
   * @returns {Promise<NewsItem[]>}
   */
  async scrapeWithCheerio() {
    const url = this.config.config.url;
    const headers = this.config.config.headers;
    const timeout = this.config.timeout;

    // 带重试和超时的 HTTP 请求
    const fetchHTML = async () => {
      const response = await axios.get(url, {
        headers,
        timeout,
        validateStatus: (status) => status === 200
      });
      return response.data;
    };

    // 执行请求(带重试)
    const html = await this.retryWithBackoff(fetchHTML);

    // 解析 HTML
    const $ = cheerio.load(html);
    const newsItems = [];

    // 实际的 AIBase 网站结构需要调整选择器
    // 这里提供一个通用的抓取逻辑
    try {
      // 方案1: 尝试查找新闻列表容器
      const items = $('.news-item, .article-item, .list-item, .item').toArray();
      
      if (items.length === 0) {
        this.logger.warn('未找到新闻列表,尝试备用选择器...');
        // 方案2: 备用选择器
        const fallbackItems = $('article, .post, .entry').toArray();
        if (fallbackItems.length > 0) {
          return this.parseNewsItems($, fallbackItems);
        }
        throw new Error('无法找到新闻列表元素');
      }

      return this.parseNewsItems($, items);
    } catch (error) {
      this.logger.error('HTML 解析失败:', error.message);
      throw error;
    }
  }

  /**
   * 解析新闻条目
   * @param {cheerio.Root} $ - Cheerio 实例
   * @param {cheerio.Element[]} elements - 新闻元素数组
   * @returns {NewsItem[]}
   */
  parseNewsItems($, elements) {
    const newsItems = [];
    const maxItems = this.config.maxItems;

    for (let i = 0; i < Math.min(elements.length, maxItems); i++) {
      const elem = elements[i];
      const $elem = $(elem);

      try {
        // 提取标题
        const title = this.extractTitle($elem);
        if (!title) {
          this.logger.debug(`第 ${i + 1} 条新闻缺少标题,跳过`);
          continue;
        }

        // 提取摘要
        const summary = this.extractSummary($elem);
        if (!summary || summary.length < 10) {
          this.logger.debug(`第 ${i + 1} 条新闻摘要不足,跳过`);
          continue;
        }

        // 提取 URL
        const url = this.extractURL($elem);
        if (!url) {
          this.logger.debug(`第 ${i + 1} 条新闻缺少链接,跳过`);
          continue;
        }

        // 提取发布时间
        const createdAt = this.extractPublishTime($elem);

        // 创建 NewsItem
        const newsItem = new NewsItem({
          title: title.trim(),
          summary: summary.trim(),
          url,
          source: this.config.name,
          createdAt: createdAt || new Date(),
          fetchedAt: new Date()
        });

        // 验证
        const validation = newsItem.validate();
        if (validation.valid) {
          newsItems.push(newsItem);
        } else {
          this.logger.debug(`第 ${i + 1} 条新闻验证失败:`, validation.errors);
        }
      } catch (error) {
        this.logger.debug(`解析第 ${i + 1} 条新闻失败:`, error.message);
        continue;
      }
    }

    return newsItems;
  }

  /**
   * 提取标题
   */
  extractTitle($elem) {
    return SelectorUtils.trySelectors(
      $elem,
      AIBASE_SELECTORS.title,
      ($el, selector) => SelectorUtils.extractText($el, selector, 1)
    );
  }

  /**
   * 提取摘要
   */
  extractSummary($elem) {
    const summary = SelectorUtils.trySelectors(
      $elem,
      AIBASE_SELECTORS.summary,
      ($el, selector) => SelectorUtils.extractText($el, selector, 10)
    );

    // 如果没有摘要,使用标题作为摘要
    return summary || this.extractTitle($elem) || '';
  }

  /**
   * 提取 URL
   */
  extractURL($elem) {
    const link = SelectorUtils.extractAttr($elem, AIBASE_SELECTORS.link, 'href');
    return SelectorUtils.normalizeUrl(link, 'https://www.aibase.com');
  }

  /**
   * 提取发布时间
   */
  extractPublishTime($elem) {
    const datetime = SelectorUtils.trySelectors(
      $elem,
      AIBASE_SELECTORS.time,
      ($el, selector) => {
        const timeElem = $el.find(selector).first();
        return timeElem.attr('datetime') || timeElem.text() || null;
      }
    );

    return SelectorUtils.parseDateTime(datetime);
  }

  /**
   * 使用 Puppeteer 抓取(用于 SSR 网站)
   * @returns {Promise<NewsItem[]>}
   */
  async scrapeWithPuppeteer() {
    const puppeteer = await import('puppeteer');
    const { PAGE_LOAD_WAIT, MAX_ITEMS } = COLLECTOR_CONSTANTS.AIBASE;
    const targetMaxItems = Math.min(this.config.maxItems, MAX_ITEMS);

    this.logger.info('启动浏览器...');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();

      // 设置 User-Agent
      await page.setUserAgent(this.config.config.headers['User-Agent']);

      // 访问页面
      this.logger.info('访问页面并等待内容加载...');
      await page.goto(this.config.config.url, {
        waitUntil: 'networkidle0',
        timeout: this.config.timeout
      });

      // 等待更长时间让 React/Next.js 渲染完成
      await new Promise(resolve => setTimeout(resolve, PAGE_LOAD_WAIT));

      // 尝试滚动页面加载更多新闻
      await this.autoLoadMore(page, targetMaxItems);

      this.logger.debug('等待新闻列表加载...');

      // 提取新闻数据
      const newsData = await page.evaluate((maxItems) => {
        const items = [];

        // 尝试多种选择器策略
        let links = document.querySelectorAll('a[href*="/news/"]');

        // 如果没找到,尝试更通用的选择器
        if (links.length === 0) {
          links = document.querySelectorAll('a[aria-label]');
        }

        console.log(`找到 ${links.length} 个链接`);

        for (let i = 0; i < links.length && items.length < maxItems; i += 1) {
          const link = links[i];

          // 提取 URL
          const href = link.getAttribute('href');
          if (!href || !href.includes('/news/')) continue;

          // 提取标题 (优先使用 aria-label,这通常包含完整标题)
          let title = link.getAttribute('aria-label');

          // 如果 aria-label 没有,尝试从子元素提取
          if (!title) {
            const headingElem = link.querySelector('h1, h2, h3, h4');
            title = headingElem?.textContent?.trim() || '';
          }

          // 如果还是没有,使用链接的文本内容
          if (!title) {
            title = link.textContent?.trim() || '';
          }

          // 提取摘要
          let summary = '';
          const parentDiv = link.closest('.group, .item, article');
          if (parentDiv) {
            const paragraphs = parentDiv.querySelectorAll('p');
            for (const p of paragraphs) {
              const text = p.textContent?.trim();
              if (text && text.length > 20) {
                summary = text;
                break;
              }
            }
          }

          // 如果没有摘要,使用标题
          if (!summary || summary.length < 10) {
            summary = title;
          }

          // 提取时间
          const timeElem = link.querySelector('time, .time, .date') ||
                          link.closest('.group, .item, article')?.querySelector('time, .time, .date');
          const timeStr = timeElem?.getAttribute('datetime') ||
                         timeElem?.textContent ||
                         new Date().toISOString();

          if (title && href && title.length > 5) {
            items.push({
              title: title.substring(0, 500), // 限制长度
              summary: summary.substring(0, 2000),
              url: href.startsWith('http') ? href : `https://www.aibase.com${href}`,
              time: timeStr
            });
          }
        }

        console.log(`提取到 ${items.length} 条新闻`);
        return items;
      }, targetMaxItems);

      this.logger.success(`提取到 ${newsData.length} 条新闻数据`);

      // 转换为 NewsItem 对象
      const newsItems = newsData.map(data => {
        const createdAt = new Date(data.time);
        return new NewsItem({
          title: data.title,
          summary: data.summary,
          url: data.url,
          source: this.config.name,
          createdAt: isNaN(createdAt.getTime()) ? new Date() : createdAt,
          fetchedAt: new Date()
        });
      });

      // 验证并过滤
      return newsItems.filter(item => {
        const validation = item.validate();
        if (!validation.valid) {
          this.logger.debug('新闻验证失败:', validation.errors);
          return false;
        }
        return true;
      });

    } finally {
      await browser.close();
      this.logger.info('浏览器已关闭');
    }
  }

  async autoLoadMore(page, targetMaxItems) {
    const MAX_ATTEMPTS = 10;
    let lastCount = 0;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const currentCount = await page.evaluate(() => document.querySelectorAll('a[href*="/news/"]').length);
      if (currentCount >= targetMaxItems) {
        break;
      }

      if (currentCount === lastCount) {
        const clicked = await page.evaluate(() => {
          const candidates = Array.from(document.querySelectorAll('button, a'));
          const loadMore = candidates.find(el => /加载更多|Load\s*more|查看更多|More/i.test((el.textContent || '').trim()));
          if (loadMore) {
            loadMore.click();
            return true;
          }
          return false;
        });

        if (!clicked) {
          await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        }
      } else {
        lastCount = currentCount;
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
}
