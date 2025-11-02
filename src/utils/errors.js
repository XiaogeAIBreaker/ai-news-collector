/**
 * 业务异常类型体系
 * 提供类型化的异常处理,提高错误信息可读性
 */

/**
 * 基础业务异常类
 */
export class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp.toISOString()
    };
  }
}

/**
 * 配置错误 - 配置文件相关问题
 */
export class ConfigError extends AppError {
  constructor(message, details = {}) {
    super(message, 'CONFIG_ERROR');
    this.details = details;
  }
}

/**
 * 配置文件不存在
 */
export class ConfigFileNotFoundError extends ConfigError {
  constructor(filePath) {
    super(`配置文件不存在: ${filePath}`, {
      filePath,
      code: 'CONFIG_FILE_NOT_FOUND'
    });
  }
}

/**
 * 配置格式错误
 */
export class ConfigValidationError extends ConfigError {
  constructor(errors, configType) {
    const message = `${configType} 配置验证失败:\n  - ${errors.join('\n  - ')}`;
    super(message, {
      errors,
      configType,
      code: 'CONFIG_VALIDATION_ERROR'
    });
    this.errors = errors;
  }
}

/**
 * 网络请求错误
 */
export class NetworkError extends AppError {
  constructor(message, url, statusCode = null) {
    super(message, 'NETWORK_ERROR');
    this.url = url;
    this.statusCode = statusCode;
  }
}

/**
 * 数据验证错误
 */
export class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

/**
 * Token 过期错误
 */
export class TokenExpiredError extends AppError {
  constructor(message = 'Token 已过期') {
    super(message, 'TOKEN_EXPIRED');
  }
}

/**
 * 判断错误是否可重试
 * @param {Error} error - 错误对象
 * @returns {boolean}
 */
export function isRetryableError(error) {
  // 网络错误可重试
  if (error instanceof NetworkError) {
    const retryableStatus = [408, 429, 500, 502, 503, 504];
    return !error.statusCode || retryableStatus.includes(error.statusCode);
  }

  // Token 过期可重试(重新登录)
  if (error instanceof TokenExpiredError) {
    return true;
  }

  // 配置错误不可重试
  if (error instanceof ConfigError) {
    return false;
  }

  // 验证错误不可重试
  if (error instanceof ValidationError) {
    return false;
  }

  // 默认根据错误信息判断
  const retryableMessages = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'timeout',
    'network'
  ];

  return retryableMessages.some(msg =>
    error.message.toLowerCase().includes(msg.toLowerCase())
  );
}
