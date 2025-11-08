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

/**
 * 验证 Twitter 推主配置
 * @param {Object} config - Twitter 配置对象
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTwitterAccounts(config) {
  const errors = [];

  if (typeof config !== 'object' || config === null) {
    return { valid: false, errors: ['配置必须是对象'] };
  }

  const accounts = config.accounts;
  const globalConfig = config.config;

  if (accounts !== undefined && !Array.isArray(accounts)) {
    errors.push('accounts 必须是数组');
  } else if (Array.isArray(accounts)) {
    accounts.forEach((account, index) => {
      const prefix = `推主[${index}]`;

      if (typeof account !== 'object' || account === null) {
        errors.push(`${prefix}: 必须是对象`);
        return;
      }

      if (!account.handle || typeof account.handle !== 'string' || account.handle.trim() === '') {
        errors.push(`${prefix}: handle 是必填字段并且必须是非空字符串`);
      } else if (account.handle.includes(' ')) {
        errors.push(`${prefix}: handle 不能包含空格`);
      } else if (account.handle.startsWith('@')) {
        errors.push(`${prefix}: handle 不需要包含 @ 前缀`);
      }

      if (!account.displayName || typeof account.displayName !== 'string') {
        errors.push(`${prefix}: displayName 是必填字段并且必须是字符串`);
      }

      if (account.description && typeof account.description !== 'string') {
        errors.push(`${prefix}: description 必须是字符串`);
      }

      if (account.query && typeof account.query !== 'string') {
        errors.push(`${prefix}: query 必须是字符串`);
      }

      if (account.languages && !Array.isArray(account.languages)) {
        errors.push(`${prefix}: languages 必须是字符串数组`);
      } else if (Array.isArray(account.languages)) {
        account.languages.forEach((lang, langIndex) => {
          if (typeof lang !== 'string' || lang.trim() === '') {
            errors.push(`${prefix}.languages[${langIndex}]: 必须是非空字符串`);
          }
        });
      }

      if (account.tags && !Array.isArray(account.tags)) {
        errors.push(`${prefix}: tags 必须是字符串数组`);
      } else if (Array.isArray(account.tags)) {
        account.tags.forEach((tag, tagIndex) => {
          if (typeof tag !== 'string' || tag.trim() === '') {
            errors.push(`${prefix}.tags[${tagIndex}]: 必须是非空字符串`);
          }
        });
      }

      if (account.enabled !== undefined && typeof account.enabled !== 'boolean') {
        errors.push(`${prefix}: enabled 必须是布尔值`);
      }
    });
  }

  if (globalConfig !== undefined) {
    if (typeof globalConfig !== 'object' || globalConfig === null) {
      errors.push('config 必须是对象');
    } else {
      if (globalConfig.sinceHours !== undefined) {
        if (typeof globalConfig.sinceHours !== 'number' ||
            globalConfig.sinceHours <= 0 ||
            globalConfig.sinceHours > 168) {
          errors.push('config.sinceHours 必须是 1-168 之间的数字');
        }
      }

      if (globalConfig.maxResultsPerPage !== undefined) {
        if (typeof globalConfig.maxResultsPerPage !== 'number' ||
            globalConfig.maxResultsPerPage < 10 ||
            globalConfig.maxResultsPerPage > 100) {
          errors.push('config.maxResultsPerPage 必须是 10-100 之间的数字');
        }
      }

      if (globalConfig.defaultLanguages !== undefined) {
        if (!Array.isArray(globalConfig.defaultLanguages)) {
          errors.push('config.defaultLanguages 必须是字符串数组');
        } else {
          globalConfig.defaultLanguages.forEach((lang, index) => {
            if (typeof lang !== 'string' || lang.trim() === '') {
              errors.push(`config.defaultLanguages[${index}]: 必须是非空字符串`);
            }
          });
        }
      }

      if (globalConfig.defaultQuerySuffix !== undefined &&
          typeof globalConfig.defaultQuerySuffix !== 'string') {
        errors.push('config.defaultQuerySuffix 必须是字符串');
      }

      if (globalConfig.maxItemsPerAccount !== undefined) {
        if (typeof globalConfig.maxItemsPerAccount !== 'number' ||
            globalConfig.maxItemsPerAccount < 1 ||
            globalConfig.maxItemsPerAccount > 200) {
          errors.push('config.maxItemsPerAccount 必须是 1-200 之间的数字');
        }
      }

      if (globalConfig.maxItemsPerKeyword !== undefined) {
        if (typeof globalConfig.maxItemsPerKeyword !== 'number' ||
            globalConfig.maxItemsPerKeyword < 1 ||
            globalConfig.maxItemsPerKeyword > 200) {
          errors.push('config.maxItemsPerKeyword 必须是 1-200 之间的数字');
        }
      }
    }
  }

  if (config.keywords !== undefined) {
    if (!Array.isArray(config.keywords)) {
      errors.push('keywords 必须是字符串数组');
    } else {
      config.keywords.forEach((keyword, index) => {
        if (typeof keyword !== 'string' || keyword.trim() === '') {
          errors.push(`keywords[${index}]: 必须是非空字符串`);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 验证全局采集时间窗口配置
 * @param {Object} config
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCollectionWindow(config) {
  const errors = [];

  if (typeof config !== 'object' || config === null) {
    errors.push('配置必须是对象');
    return { valid: false, errors };
  }

  const { recentDays } = config;
  if (recentDays === undefined) {
    errors.push('recentDays 是必填字段');
  } else if (typeof recentDays !== 'number' || Number.isNaN(recentDays)) {
    errors.push('recentDays 必须是数字');
  } else if (!Number.isInteger(recentDays)) {
    errors.push('recentDays 必须是整数');
  } else if (recentDays <= 0) {
    errors.push('recentDays 必须大于 0');
  } else if (recentDays > 30) {
    errors.push('recentDays 不能超过 30');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 验证 YouTube 频道配置
 * @param {Object} config - YouTube 配置对象
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateYouTubeChannels(config) {
  const errors = [];

  if (typeof config !== 'object' || config === null) {
    return { valid: false, errors: ['配置必须是对象'] };
  }

  // 验证频道列表
  const channels = config.channels;
  if (channels !== undefined && !Array.isArray(channels)) {
    errors.push('channels 必须是数组');
  } else if (Array.isArray(channels)) {
    channels.forEach((channel, index) => {
      const prefix = `频道[${index}]`;

      if (typeof channel !== 'object' || channel === null) {
        errors.push(`${prefix}: 必须是对象`);
        return;
      }

      // channelId 必填,按照 data-model.md:65 规范验证
      if (!channel.channelId || typeof channel.channelId !== 'string' || channel.channelId.trim() === '') {
        errors.push(`${prefix}: channelId 是必填字段并且必须是非空字符串`);
      } else if (!/^UC[a-zA-Z0-9_-]{22}$/.test(channel.channelId)) {
        errors.push(`${prefix}: channelId 必须匹配格式 ^UC[a-zA-Z0-9_-]{22}$`);
      }

      // displayName 可选,按照 data-model.md:22,66 规范验证
      if (channel.displayName !== undefined) {
        if (typeof channel.displayName !== 'string') {
          errors.push(`${prefix}: displayName 必须是字符串`);
        } else if (channel.displayName.length < 1 || channel.displayName.length > 100) {
          errors.push(`${prefix}: displayName 长度必须在 1-100 字符之间`);
        }
      }

      // handle 可选,按照 data-model.md:23,67 规范验证
      if (channel.handle !== undefined) {
        if (typeof channel.handle !== 'string') {
          errors.push(`${prefix}: handle 必须是字符串`);
        } else if (!channel.handle.startsWith('@') || channel.handle.length < 2 || channel.handle.length > 30) {
          errors.push(`${prefix}: handle 必须以 @ 开头,长度 2-30 字符`);
        }
      }

      // enabled 可选,但必须是布尔值
      if (channel.enabled !== undefined && typeof channel.enabled !== 'boolean') {
        errors.push(`${prefix}: enabled 必须是布尔值`);
      }

      // keywords 可选 (频道级关键词过滤),按照 data-model.md:25,68 规范验证
      if (channel.keywords !== undefined) {
        if (!Array.isArray(channel.keywords)) {
          errors.push(`${prefix}: keywords 必须是数组`);
        } else {
          channel.keywords.forEach((keyword, kIndex) => {
            if (typeof keyword !== 'string' || keyword.length < 1 || keyword.length > 50) {
              errors.push(`${prefix}.keywords[${kIndex}]: 必须是 1-50 字符的字符串`);
            }
          });
        }
      }

      // languages 可选,按照 data-model.md:26,69 规范验证
      if (channel.languages !== undefined) {
        if (!Array.isArray(channel.languages)) {
          errors.push(`${prefix}: languages 必须是数组`);
        } else {
          channel.languages.forEach((lang, lIndex) => {
            // ISO 639-1 代码验证 (2 个字母)
            if (typeof lang !== 'string' || !/^[a-z]{2}$/.test(lang)) {
              errors.push(`${prefix}.languages[${lIndex}]: 必须是有效的 ISO 639-1 代码 (如 "zh", "en")`);
            }
          });
        }
      }

      // tags 可选,按照 data-model.md:27,70 规范验证
      if (channel.tags !== undefined) {
        if (!Array.isArray(channel.tags)) {
          errors.push(`${prefix}: tags 必须是数组`);
        } else if (channel.tags.length > 10) {
          errors.push(`${prefix}: tags 最多 10 个元素`);
        } else {
          channel.tags.forEach((tag, tIndex) => {
            if (typeof tag !== 'string' || tag.length < 1 || tag.length > 30) {
              errors.push(`${prefix}.tags[${tIndex}]: 必须是 1-30 字符的字符串`);
            }
          });
        }
      }

      // maxItemsPerChannel 可选,但必须是正整数
      if (channel.maxItemsPerChannel !== undefined) {
        if (typeof channel.maxItemsPerChannel !== 'number' ||
            channel.maxItemsPerChannel < 1 ||
            channel.maxItemsPerChannel > 100) {
          errors.push(`${prefix}: maxItemsPerChannel 必须是 1-100 之间的数字`);
        }
      }
    });
  }

  // 验证关键词列表 (字符串数组格式,符合 data-model.md 规范)
  if (config.keywords !== undefined) {
    if (!Array.isArray(config.keywords)) {
      errors.push('keywords 必须是数组');
    } else {
      config.keywords.forEach((keyword, index) => {
        const prefix = `关键词[${index}]`;

        // 支持字符串数组格式 (per data-model.md)
        if (typeof keyword !== 'string' || keyword.trim() === '') {
          errors.push(`${prefix}: 必须是非空字符串`);
        }
      });
    }
  }

  // 验证全局配置
  const globalConfig = config.config;
  if (globalConfig !== undefined) {
    if (typeof globalConfig !== 'object' || globalConfig === null) {
      errors.push('config 必须是对象');
    } else {
      // recentDays 可选,但必须是正整数
      if (globalConfig.recentDays !== undefined) {
        if (typeof globalConfig.recentDays !== 'number' ||
            globalConfig.recentDays < 1 ||
            globalConfig.recentDays > 30) {
          errors.push('config.recentDays 必须是 1-30 之间的数字');
        }
      }

      // defaultMaxItemsPerChannel 可选
      if (globalConfig.defaultMaxItemsPerChannel !== undefined) {
        if (typeof globalConfig.defaultMaxItemsPerChannel !== 'number' ||
            globalConfig.defaultMaxItemsPerChannel < 1 ||
            globalConfig.defaultMaxItemsPerChannel > 100) {
          errors.push('config.defaultMaxItemsPerChannel 必须是 1-100 之间的数字');
        }
      }

      // defaultMaxResultsPerKeyword 可选
      if (globalConfig.defaultMaxResultsPerKeyword !== undefined) {
        if (typeof globalConfig.defaultMaxResultsPerKeyword !== 'number' ||
            globalConfig.defaultMaxResultsPerKeyword < 1 ||
            globalConfig.defaultMaxResultsPerKeyword > 50) {
          errors.push('config.defaultMaxResultsPerKeyword 必须是 1-50 之间的数字');
        }
      }

      // defaultLanguage 可选 (单个语言)
      if (globalConfig.defaultLanguage && typeof globalConfig.defaultLanguage !== 'string') {
        errors.push('config.defaultLanguage 必须是字符串');
      }

      // defaultLanguages 可选 (多个语言数组,符合 T042 规范)
      if (globalConfig.defaultLanguages !== undefined) {
        if (!Array.isArray(globalConfig.defaultLanguages)) {
          errors.push('config.defaultLanguages 必须是数组');
        } else {
          globalConfig.defaultLanguages.forEach((lang, index) => {
            if (typeof lang !== 'string' || lang.trim() === '') {
              errors.push(`config.defaultLanguages[${index}] 必须是非空字符串`);
            }
          });
        }
      }

      // enableKeywordSearch 可选
      if (globalConfig.enableKeywordSearch !== undefined &&
          typeof globalConfig.enableKeywordSearch !== 'boolean') {
        errors.push('config.enableKeywordSearch 必须是布尔值');
      }

      // batchSize 可选
      if (globalConfig.batchSize !== undefined) {
        if (typeof globalConfig.batchSize !== 'number' ||
            globalConfig.batchSize < 1 ||
            globalConfig.batchSize > 50) {
          errors.push('config.batchSize 必须是 1-50 之间的数字');
        }
      }

      // enableStatistics 可选
      if (globalConfig.enableStatistics !== undefined &&
          typeof globalConfig.enableStatistics !== 'boolean') {
        errors.push('config.enableStatistics 必须是布尔值');
      }

      // maxResultsPerPage 可选 (FR-010)
      if (globalConfig.maxResultsPerPage !== undefined) {
        if (typeof globalConfig.maxResultsPerPage !== 'number' ||
            globalConfig.maxResultsPerPage < 1 ||
            globalConfig.maxResultsPerPage > 50) {
          errors.push('config.maxResultsPerPage 必须是 1-50 之间的数字');
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
