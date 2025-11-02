/**
 * 数据源配置
 * 定义各个数据源的配置信息
 */

import { configLoader } from './config-loader.js';
import { validateWeChatAccounts, validateZSXQGroups } from './validators.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('DataSources');

/**
 * AIBase 数据源配置
 */
export const AIBASE_CONFIG = {
  name: 'AIBase',
  type: 'web',
  enabled: true,
  maxItems: 50,
  timeout: 30000,
  config: {
    url: 'https://www.aibase.com/zh/news',
    selectors: {
      newsContainer: '.news-list',
      newsItem: '.news-item',
      title: '.news-title',
      summary: '.news-summary',
      link: 'a',
      publishTime: '.publish-time'
    },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    }
  }
};

/**
 * 知识星球数据源配置
 */
export const ZSXQ_CONFIG = {
  name: '知识星球',
  type: 'web',
  enabled: true,
  // 知识星球话题接口单次最多返回 20 条,实际采集会按需降级并分页拉取
  maxItems: 50,
  timeout: 30000,
  config: {
    // 使用 getter 延迟加载星球配置
    get groups() {
      return loadZSXQGroups();
    },
    apiBase: 'https://api.zsxq.com/v2',
    webBase: 'https://wx.zsxq.com',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Origin': 'https://wx.zsxq.com',
      'Referer': 'https://wx.zsxq.com/'
    }
  }
};

/**
 * 从配置文件加载微信公众号列表
 * @returns {Array} 公众号配置数组
 */
function loadWeChatAccounts() {
  try {
    const accounts = configLoader.loadAndValidate(
      'config/wechat-accounts.json',
      validateWeChatAccounts,
      { required: false, defaultValue: [] }
    );

    if (accounts && accounts.length > 0) {
      logger.info(`加载了 ${accounts.length} 个公众号配置`);
    } else {
      logger.warn('未配置微信公众号');
    }

    return accounts || [];
  } catch (error) {
    logger.error(`加载微信公众号配置失败: ${error.message}`);
    return [];
  }
}

/**
 * 从配置文件加载知识星球分组
 * @returns {Array} 知识星球分组数组
 */
function loadZSXQGroups() {
  try {
    const groups = configLoader.loadAndValidate(
      'config/zsxq-groups.json',
      validateZSXQGroups,
      { required: false, defaultValue: [] }
    );

    if (groups && groups.length > 0) {
      logger.info(`加载了 ${groups.length} 个知识星球配置`);
    } else {
      logger.warn('未配置知识星球分组');
    }

    return groups || [];
  } catch (error) {
    logger.error(`加载知识星球配置失败: ${error.message}`);
    return [];
  }
}

/**
 * 微信公众号 MP 数据源配置
 */
export const WECHAT_MP_CONFIG = {
  name: 'WeChat-MP',
  type: 'api',
  enabled: true,
  maxItems: 10,
  timeout: 30000,
  config: {
    apiUrl: 'https://mp.weixin.qq.com/cgi-bin/appmsgpublish',
    // 使用 getter 延迟加载账号列表
    get accounts() {
      return loadWeChatAccounts();
    },
    // 仅保留近 7 天的文章
    recentDays: 7,
    rateLimit: {
      minDelay: 3000,
      maxDelay: 5000
    }
  }
};

/**
 * 获取所有启用的数据源配置
 * @returns {Array<Object>} 启用的数据源配置数组
 */
export function getEnabledDataSources() {
  const allSources = [
    AIBASE_CONFIG,
    // ZSXQ_CONFIG,
    // WECHAT_MP_CONFIG
  ];

  const enabled = allSources.filter(source => source.enabled);

  logger.info(`启用的数据源: ${enabled.map(s => s.name).join(', ')}`);

  return enabled;
}
