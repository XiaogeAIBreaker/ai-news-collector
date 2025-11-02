/**
 * 配置验证器
 * 提供各类配置的验证逻辑
 */

/**
 * 验证过滤规则配置
 * @param {Object} config - 过滤配置对象
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFilterConfig(config) {
  const errors = [];

  // 验证正面样例
  if (!config.positiveExamples || !Array.isArray(config.positiveExamples)) {
    errors.push('positiveExamples 必须是数组');
  } else if (config.positiveExamples.length === 0) {
    errors.push('至少需要 1 个正面样例');
  } else {
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

  // 验证关键词(可选)
  if (config.keywords && !Array.isArray(config.keywords)) {
    errors.push('keywords 必须是数组');
  }

  // 验证阈值配置(可选)
  if (config.thresholdConfig) {
    const thresholdErrors = validateThresholdConfig(config.thresholdConfig);
    errors.push(...thresholdErrors);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 验证单个样例
 * @param {Object} example - 样例对象
 * @param {string} prefix - 错误信息前缀
 * @returns {string[]} 错误列表
 */
function validateExample(example, prefix) {
  const errors = [];

  // 标题验证
  if (!example.title || typeof example.title !== 'string') {
    errors.push(`${prefix}: 标题是必填字段`);
  } else if (example.title.length < 1 || example.title.length > 200) {
    errors.push(`${prefix}: 标题长度必须在 1-200 字符之间`);
  }

  // 摘要验证
  if (!example.summary || typeof example.summary !== 'string') {
    errors.push(`${prefix}: 摘要是必填字段`);
  } else if (example.summary.length < 10 || example.summary.length > 500) {
    errors.push(
      `${prefix}: 摘要长度必须在 10-500 字符之间 (当前: ${example.summary.length})`
    );
  }

  // 理由(可选)
  if (example.reason && typeof example.reason !== 'string') {
    errors.push(`${prefix}: 理由必须是字符串`);
  }

  return errors;
}

/**
 * 验证阈值配置
 * @param {Object} config - 阈值配置对象
 * @returns {string[]} 错误列表
 */
function validateThresholdConfig(config) {
  const errors = [];

  if (config.minPercentage !== undefined) {
    if (typeof config.minPercentage !== 'number' ||
        config.minPercentage < 0 ||
        config.minPercentage > 100) {
      errors.push('minPercentage 必须是 0-100 之间的数字');
    }
  }

  if (config.maxPercentage !== undefined) {
    if (typeof config.maxPercentage !== 'number' ||
        config.maxPercentage < 0 ||
        config.maxPercentage > 100) {
      errors.push('maxPercentage 必须是 0-100 之间的数字');
    }
  }

  if (config.preferredCount !== undefined) {
    if (typeof config.preferredCount !== 'number' || config.preferredCount < 1) {
      errors.push('preferredCount 必须是正整数');
    }
  }

  // 检查 min 和 max 的关系
  if (config.minPercentage !== undefined &&
      config.maxPercentage !== undefined &&
      config.minPercentage > config.maxPercentage) {
    errors.push('minPercentage 不能大于 maxPercentage');
  }

  return errors;
}

/**
 * 验证微信公众号配置
 * @param {Array} accounts - 公众号配置数组
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateWeChatAccounts(accounts) {
  const errors = [];

  if (!Array.isArray(accounts)) {
    errors.push('配置必须是数组');
    return { valid: false, errors };
  }

  accounts.forEach((account, index) => {
    const prefix = `公众号[${index}]`;

    if (!account.fakeid || typeof account.fakeid !== 'string') {
      errors.push(`${prefix}: fakeid 是必填字段`);
    }

    if (!account.nickname || typeof account.nickname !== 'string') {
      errors.push(`${prefix}: nickname 是必填字段`);
    }

    if (account.description && typeof account.description !== 'string') {
      errors.push(`${prefix}: description 必须是字符串`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 验证知识星球分组配置
 * @param {Array} groups - 知识星球分组数组
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateZSXQGroups(groups) {
  const errors = [];

  if (!Array.isArray(groups)) {
    errors.push('配置必须是数组');
    return { valid: false, errors };
  }

  groups.forEach((group, index) => {
    const prefix = `知识星球[${index}]`;

    if (!group.groupId || typeof group.groupId !== 'string') {
      errors.push(`${prefix}: groupId 是必填字段`);
    }

    if (!group.groupName || typeof group.groupName !== 'string') {
      errors.push(`${prefix}: groupName 是必填字段`);
    }

    if (!Array.isArray(group.hashtags) || group.hashtags.length === 0) {
      errors.push(`${prefix}: hashtags 必须是包含至少一个话题的数组`);
      return;
    }

    group.hashtags.forEach((hashtag, tagIndex) => {
      const tagPrefix = `${prefix}.hashtags[${tagIndex}]`;

      if (typeof hashtag === 'string') {
        if (hashtag.trim() === '') {
          errors.push(`${tagPrefix}: 话题 ID 不能为空字符串`);
        }
        return;
      }

      if (typeof hashtag !== 'object' || hashtag === null) {
        errors.push(`${tagPrefix}: 必须是包含 id/name 的对象或直接使用字符串 ID`);
        return;
      }

      if (!hashtag.id || typeof hashtag.id !== 'string' || hashtag.id.trim() === '') {
        errors.push(`${tagPrefix}: id 是必填字段且必须是非空字符串`);
      }

      if (hashtag.name !== undefined && typeof hashtag.name !== 'string') {
        errors.push(`${tagPrefix}: name 必须是字符串`);
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors
  };
}
