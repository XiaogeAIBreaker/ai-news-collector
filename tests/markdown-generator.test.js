import { describe, it, expect } from 'vitest';
import { MarkdownGenerator } from '../src/output/markdown.js';

describe('MarkdownGenerator', () => {
  it('能够按数据源生成包含表格的新闻段落', () => {
    const generator = new MarkdownGenerator();
    const filteredNews = [
      {
        newsItem: {
          source: 'Twitter',
          title: 'Anthropic 发布新模型',
          summary: '模型亮点:\n- 上下文更长\n- 成本更低',
          url: 'https://example.com/a',
          createdAt: new Date('2025-11-02T10:00:00Z'),
          metadata: { author: 'Anthropic', likes: 12, comments: 3 }
        },
        score: 8.6,
        reason: '覆盖关键创新'
      },
      {
        newsItem: {
          source: 'Twitter',
          title: 'DeepSeek 发布新版工具',
          summary: '体验更顺滑',
          url: 'https://example.com/b',
          createdAt: new Date('2025-11-02T12:00:00Z'),
          metadata: {}
        },
        score: 7.2,
        reason: '持续迭代'
      }
    ];

    const section = generator.buildNewsSection(filteredNews);

    expect(section).toContain('### 📡 Twitter (2 条)');
    expect(section).toContain('| 序号 | 标题 | 评分 | 发布时间 | 摘要 | 评分理由 | 互动数据 |');
    expect(section).toMatch(/\| 1 \| \[Anthropic 发布新模型\]\(https:\/\/example\.com\/a\)/);
    expect(section).toContain('模型亮点:<br/>- 上下文更长<br/>- 成本更低');
    expect(section).toContain('作者: Anthropic<br/>👍 12<br/>💬 3');
    expect(section).toMatch(/\| 2 \| \[DeepSeek 发布新版工具\]\(https:\/\/example\.com\/b\)/);
  });
});
