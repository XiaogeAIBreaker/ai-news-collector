/**
 * 全局常量配置
 * 避免在代码中使用魔法数字
 */

// 采集器配置
export const COLLECTOR_CONSTANTS = {
  // AIBase 采集器
  AIBASE: {
    MAX_ITEMS: 50,           // 最大采集数量
    TIMEOUT: 30000,          // 请求超时时间(毫秒)
    PAGE_LOAD_WAIT: 3000,    // 页面加载等待时间(毫秒)
    SELECTOR_WAIT: 10000     // 选择器等待超时(毫秒)
  }
};

// LLM 配置
export const LLM_CONSTANTS = {
  DEFAULT_MODEL: 'deepseek-chat',
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_MAX_TOKENS: 500,
  BATCH_SIZE: 10,              // 批量评分的批次大小

  // API 定价 (美元/百万 tokens)
  PRICING: {
    INPUT_PER_MILLION: 0.27,
    OUTPUT_PER_MILLION: 1.10,
    CACHE_HIT_PER_MILLION: 0.027
  }
};
