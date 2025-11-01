/**
 * AIBase 数据源配置
 */
export const AIBASE_CONFIG = {
  name: 'AIBase',
  type: 'web',
  enabled: true,
  maxItems: 10,
  timeout: 30000, // 30秒
  config: {
    url: 'https://www.aibase.com/zh/news',
    selectors: {
      // 注意: 这些选择器需要根据实际网站HTML结构调整
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
  maxItems: 20, // 每个标签最多采集 20 条
  timeout: 30000, // 30秒
  config: {
    // 星球配置列表 - 每个星球可以配置多个标签
    groups: [
      {
        groupId: '15552545485212', // 星球 ID (从 URL 中提取)
        groupName: 'AI风向标', // 星球名称
        tags: ['中标', 'AI风向标'] // 要采集的标签列表
      }
      // 可以添加更多星球配置
      // {
      //   groupId: 'another_group_id',
      //   groupName: '另一个星球',
      //   tags: ['标签1', '标签2']
      // }
    ],
    // API 基础配置
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
 * 获取所有启用的数据源配置
 */
export function getEnabledDataSources() {
  const allSources = [
    AIBASE_CONFIG,
    ZSXQ_CONFIG
    // 未来可以在这里添加其他数据源
    // TWITTER_CONFIG,
    // FEISHU_CONFIG,
    // WECHAT_CONFIG
  ];

  return allSources.filter(source => source.enabled);
}

/**
 * 根据名称获取数据源配置
 */
export function getDataSourceByName(name) {
  const sources = {
    'AIBase': AIBASE_CONFIG,
    '知识星球': ZSXQ_CONFIG
  };

  return sources[name] || null;
}
