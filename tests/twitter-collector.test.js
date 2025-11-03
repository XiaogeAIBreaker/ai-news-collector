import { describe, expect, it } from 'vitest';
import { TwitterCollector, __TESTING__ } from '../src/collectors/twitter.js';

describe('TwitterCollector helpers', () => {
  it('sanitizeTweetText 移除 emoji 并压缩空白', () => {
    const input = '🚀 AI 发布   新模型 🎉 ';
    const result = __TESTING__.sanitizeTweetText(input);
    expect(result).toBe('AI 发布 新模型');
  });

  it('appendLanguage 正确追加语言条件', () => {
    const { appendLanguage } = __TESTING__;
    expect(appendLanguage('from:openai -is:retweet', 'en')).toBe('from:openai -is:retweet lang:en');
    expect(appendLanguage('from:openai lang:en', 'en')).toBe('from:openai lang:en');
    expect(appendLanguage('from:openai -is:retweet', null)).toBe('from:openai -is:retweet');
  });

  it('createSearchPlans 默认添加 from 查询与语言拆分', () => {
    const collector = new TwitterCollector({
      name: 'Twitter',
      type: 'api',
      enabled: true,
      maxItems: 50,
      timeout: 30000,
      config: {}
    });

    const plans = collector.createSearchPlans(
      [
        {
          handle: 'AnthropicAI',
          displayName: 'Anthropic'
        }
      ],
      {
        defaultSuffix: '-is:retweet',
        defaultLanguages: ['en', 'zh'],
        fallbackQueries: []
      }
    );

    expect(plans).toHaveLength(2);
    expect(plans[0].query).toContain('from:AnthropicAI -is:retweet');
    expect(plans[0].query).toContain('lang:en');
    expect(plans[1].query).toContain('lang:zh');
  });

  it('createSearchPlans 在没有推主时使用关键词回退', () => {
    const collector = new TwitterCollector({
      name: 'Twitter',
      type: 'api',
      enabled: true,
      maxItems: 50,
      timeout: 30000,
      config: {}
    });

    const plans = collector.createSearchPlans([], {
      defaultSuffix: '-is:retweet',
      defaultLanguages: [],
      fallbackQueries: ['AI', '人工智能']
    });

    expect(plans).toHaveLength(1);
    expect(plans[0].query).toContain('AI');
    expect(plans[0].query).toContain('人工智能');
  });
});
