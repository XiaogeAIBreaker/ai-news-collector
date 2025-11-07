import { describe, it, expect } from 'vitest';
import {
  extractWeChatArticleText,
  buildWeChatContentSnippet
} from '../src/collectors/wechat-mp.js';

describe('WeChat content extraction helpers', () => {
  it('extracts clean text from #js_content and strips scripts/styles', () => {
    const html = `
      <div id="js_content">
        <style>.hide{display:none;}</style>
        <p>第一段</p>
        <script>console.log('noop')</script>
        <p>第二段</p>
      </div>
    `;

    const text = extractWeChatArticleText(html);
    expect(text).toBe('第一段 第二段');
  });

  it('falls back to body text when container missing', () => {
    const html = '<body><p>纯文本</p></body>';
    expect(extractWeChatArticleText(html)).toBe('纯文本');
  });

  it('builds snippet with default max length', () => {
    const content = 'A'.repeat(700);
    const snippet = buildWeChatContentSnippet(content);
    expect(snippet.length).toBe(600);
  });
});
