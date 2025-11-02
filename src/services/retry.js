/**
 * 重试机制
 * 使用指数退避策略进行重试
 */

import { isRetryableError } from '../utils/errors.js';
import { delay } from '../utils/helpers.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Retry');

/**
 * 指数退避重试机制
 * @param {Function} fn - 要执行的异步函数
 * @param {Object} options - 重试选项
 * @param {number} options.maxRetries - 最大重试次数 (默认: 3)
 * @param {number} options.initialDelay - 初始延迟毫秒数 (默认: 1000)
 * @param {number} options.maxDelay - 最大延迟毫秒数 (默认: 30000)
 * @param {Function} options.shouldRetry - 判断是否应该重试的函数
 * @param {Function} options.onRetry - 重试回调函数
 * @returns {Promise<any>} 函数执行结果
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    shouldRetry = isRetryableError,
    onRetry = null
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 如果是最后一次尝试,直接抛出错误
      if (attempt === maxRetries) {
        throw error;
      }

      // 检查是否应该重试
      if (!shouldRetry(error)) {
        throw error;
      }

      // 触发重试回调
      if (onRetry) {
        onRetry(error, attempt + 1);
      }

      // 计算延迟时间 (指数退避)
      const delayMs = Math.min(
        initialDelay * Math.pow(2, attempt),
        maxDelay
      );

      logger.debug(`第 ${attempt + 1}/${maxRetries} 次重试,等待 ${delayMs}ms...`);

      // 等待后重试
      await delay(delayMs);
    }
  }

  throw lastError;
}

/**
 * 判断错误是否应该重试 (向后兼容)
 * @deprecated 使用 isRetryableError 替代
 * @param {Error} error
 * @returns {boolean}
 */
export function shouldRetryError(error) {
  return isRetryableError(error);
}
