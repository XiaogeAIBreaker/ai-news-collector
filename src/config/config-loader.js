/**
 * 配置加载器
 * 负责加载、解析和验证各类配置文件
 *
 * 职责:
 * - 加载 JSON 配置文件
 * - 验证配置格式
 * - 提供类型安全的配置访问
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ConfigFileNotFoundError, ConfigValidationError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ConfigLoader');

/**
 * 配置加载器类
 */
export class ConfigLoader {
  constructor(baseDir = process.cwd()) {
    this.baseDir = baseDir;
  }

  /**
   * 加载 JSON 配置文件
   * @param {string} relativePath - 相对于项目根目录的路径
   * @param {Object} options - 选项
   * @returns {Object} 配置对象
   * @throws {ConfigFileNotFoundError} 文件不存在
   * @throws {ConfigValidationError} JSON 格式错误
   */
  loadJson(relativePath, options = {}) {
    const { required = true, defaultValue = null } = options;
    const absolutePath = join(this.baseDir, relativePath);

    // 检查文件是否存在
    if (!existsSync(absolutePath)) {
      if (required) {
        throw new ConfigFileNotFoundError(relativePath);
      }
      logger.warn(`配置文件不存在,使用默认值: ${relativePath}`);
      return defaultValue;
    }

    try {
      // 读取文件
      const content = readFileSync(absolutePath, 'utf-8');

      // 解析 JSON
      return JSON.parse(content);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ConfigValidationError(
          [`JSON 格式错误: ${error.message}`],
          relativePath
        );
      }
      throw error;
    }
  }

  /**
   * 加载并验证配置
   * @param {string} relativePath - 配置文件路径
   * @param {Function} validator - 验证函数 (config) => {valid, errors}
   * @param {Object} options - 选项
   * @returns {Object} 验证后的配置对象
   */
  loadAndValidate(relativePath, validator, options = {}) {
    const config = this.loadJson(relativePath, options);

    if (!config) {
      return null;
    }

    const validation = validator(config);

    if (!validation.valid) {
      throw new ConfigValidationError(
        validation.errors,
        relativePath
      );
    }

    logger.info(`配置加载成功: ${relativePath}`);
    return config;
  }
}

/**
 * 默认配置加载器实例
 */
export const configLoader = new ConfigLoader();
