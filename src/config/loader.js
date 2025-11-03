/**
 * 过滤配置加载器
 * 专门负责加载各数据源的过滤规则配置
 */

import { configLoader } from './config-loader.js';
import { validateFilterConfig } from './validators.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('FilterConfig');

// 数据源名称到配置文件名的映射
const SOURCE_FILE_MAP = {
  'AIBase': 'aibase',
  '知识星球': 'zsxq',
  'WeChat-MP': 'wechat-mp',
  'Twitter': 'twitter'
};

/**
 * 将数据源名称转换为配置文件名
 * @param {string} sourceName - 数据源名称
 * @returns {string} 文件名
 */
function getConfigFileName(sourceName) {
  return SOURCE_FILE_MAP[sourceName] || sourceName.toLowerCase();
}

/**
 * 加载指定数据源的过滤规则配置
 * @param {string} sourceName - 数据源名称 (如 'AIBase', '知识星球')
 * @returns {Object} 过滤配置对象
 * @throws {ConfigError} 配置加载或验证失败
 */
export function loadFilterConfigForSource(sourceName) {
  const fileName = getConfigFileName(sourceName);
  const configPath = `config/filter-rules-${fileName}.json`;

  logger.info(`加载过滤配置: ${sourceName}`);

  const config = configLoader.loadAndValidate(
    configPath,
    validateFilterConfig,
    { required: true }
  );

  logger.info(
    `  正面样例: ${config.positiveExamples.length} 个, ` +
    `反面样例: ${config.negativeExamples.length} 个`
  );

  return config;
}
