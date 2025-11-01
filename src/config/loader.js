import { readFileSync } from 'fs';
import { join } from 'path';

// 数据源名称到配置文件名的映射
const SOURCE_FILE_MAP = {
  'AIBase': 'aibase',
  '知识星球': 'zsxq'
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
 */
export function loadFilterConfigForSource(sourceName) {
  const fileName = getConfigFileName(sourceName);
  const configPath = `config/filter-rules-${fileName}.json`;

  const absolutePath = join(process.cwd(), configPath);

  try {
    const config = loadAndParseConfig(absolutePath, sourceName);
    validateAndLogConfig(config, sourceName);
    return config;
  } catch (error) {
    handleConfigError(error, configPath, sourceName);
  }
}

/**
 * 加载并解析配置文件
 * @param {string} absolutePath - 配置文件绝对路径
 * @param {string} sourceName - 数据源名称
 * @returns {Object} 配置对象
 */
function loadAndParseConfig(absolutePath, sourceName) {
  const fileContent = readFileSync(absolutePath, 'utf-8');

  try {
    return JSON.parse(fileContent);
  } catch (parseError) {
    console.error(`[配置加载] ${sourceName} 配置 JSON 格式错误`);
    console.error('错误详情:', parseError.message);
    console.error('请检查配置文件格式是否正确');
    process.exit(1);
  }
}

/**
 * 验证配置并输出日志
 * @param {Object} config - 配置对象
 * @param {string} sourceName - 数据源名称
 */
function validateAndLogConfig(config, sourceName) {
  const validation = validateFilterConfig(config);

  if (!validation.valid) {
    console.error(`[配置加载] ${sourceName} 配置验证失败`);
    validation.errors.forEach(err => console.error('  - ' + err));
    process.exit(1);
  }

  console.log(`[配置加载] ${sourceName} 配置加载成功`);
  console.log(`  正面样例: ${config.positiveExamples.length} 个`);
  console.log(`  反面样例: ${config.negativeExamples.length} 个`);
}

/**
 * 处理配置加载错误
 * @param {Error} error - 错误对象
 * @param {string} configPath - 配置文件路径
 * @param {string} sourceName - 数据源名称
 */
function handleConfigError(error, configPath, sourceName) {
  if (error.code === 'ENOENT') {
    console.error(`[配置加载] ${sourceName} 配置文件不存在: ${configPath}`);
    console.error(`请创建配置文件,可参考 config/filter-rules-zsxq.json 示例`);
  } else {
    console.error(`[配置加载] 加载 ${sourceName} 配置失败:`, error.message);
  }
  process.exit(1);
}

/**
 * 验证过滤配置
 * @param {Object} config
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateFilterConfig(config) {
  const errors = [];

  // 验证正面样例
  if (!config.positiveExamples || !Array.isArray(config.positiveExamples)) {
    errors.push('positiveExamples 必须是数组');
  } else if (config.positiveExamples.length === 0) {
    errors.push('至少需要 1 个正面样例');
  } else {
    // 验证每个样例的格式
    config.positiveExamples.forEach((example, index) => {
      const exampleErrors = validateExample(example, `正面样例[${index}]`);
      errors.push(...exampleErrors);
    });
  }

  // 验证反面样例
  if (!config.negativeExamples || !Array.isArray(config.negativeExamples)) {
    errors.push('negativeExamples 必须是数组');
  } else if (config.negativeExamples.length === 0) {
    errors.push('至少需要 1 个反面样例');
  } else {
    config.negativeExamples.forEach((example, index) => {
      const exampleErrors = validateExample(example, `反面样例[${index}]`);
      errors.push(...exampleErrors);
    });
  }

  // 验证关键词 (可选)
  if (config.keywords && !Array.isArray(config.keywords)) {
    errors.push('keywords 必须是数组');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 验证单个样例
 * @param {Object} example
 * @param {string} prefix - 错误信息前缀
 * @returns {string[]} 错误列表
 */
function validateExample(example, prefix) {
  const errors = [];

  if (!example.title || typeof example.title !== 'string') {
    errors.push(`${prefix}: 标题是必填字段`);
  }

  if (!example.summary || typeof example.summary !== 'string') {
    errors.push(`${prefix}: 摘要是必填字段`);
  } else if (example.summary.length < 100 || example.summary.length > 200) {
    errors.push(`${prefix}: 摘要长度必须在 100-200 字符之间 (当前: ${example.summary.length})`);
  }

  return errors;
}
