/**
 * 通用辅助函数
 * 提供常用工具函数,避免代码重复
 */

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 获取随机延迟
 * @param {number} min - 最小延迟(毫秒)
 * @param {number} max - 最大延迟(毫秒)
 * @returns {number} 随机延迟毫秒数
 */
export function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
