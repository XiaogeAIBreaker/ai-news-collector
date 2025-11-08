#!/usr/bin/env node

/**
 * 测试 buildKeywordQuery() 函数的 OR 查询合并功能
 */

// 复制 buildKeywordQuery 函数定义
function buildKeywordQuery(keywords, options = {}) {
  const { queryPrefix = '-is:live' } = options;

  if (!keywords || keywords.length === 0) {
    return queryPrefix.trim();
  }

  // 组合关键词 (带空格的关键词用引号包裹)
  const terms = keywords
    .map(k => k.includes(' ') ? `"${k}"` : k)
    .join(' OR ');

  // 如果只有一个关键词,不需要括号
  const query = keywords.length === 1 ? terms : `(${terms})`;

  return queryPrefix ? `${query} ${queryPrefix}`.trim() : query;
}

console.log('测试 buildKeywordQuery() 函数\n');

// 测试用例 1: 多个简单关键词
const test1 = buildKeywordQuery(['AI', 'Machine Learning', '大模型'], { queryPrefix: '-is:live' });
console.log('测试 1 - 多个关键词:');
console.log('  输入: ["AI", "Machine Learning", "大模型"]');
console.log(`  输出: ${test1}`);
console.log(`  期望: (AI OR "Machine Learning" OR 大模型) -is:live`);
console.log(`  通过: ${test1 === '(AI OR "Machine Learning" OR 大模型) -is:live' ? '✅' : '❌'}\n`);

// 测试用例 2: 单个关键词
const test2 = buildKeywordQuery(['AI'], { queryPrefix: '-is:live' });
console.log('测试 2 - 单个关键词:');
console.log('  输入: ["AI"]');
console.log(`  输出: ${test2}`);
console.log(`  期望: AI -is:live`);
console.log(`  通过: ${test2 === 'AI -is:live' ? '✅' : '❌'}\n`);

// 测试用例 3: 无 queryPrefix
const test3 = buildKeywordQuery(['GPT', 'ChatGPT'], { queryPrefix: '' });
console.log('测试 3 - 无查询前缀:');
console.log('  输入: ["GPT", "ChatGPT"], queryPrefix=""');
console.log(`  输出: ${test3}`);
console.log(`  期望: (GPT OR ChatGPT)`);
console.log(`  通过: ${test3 === '(GPT OR ChatGPT)' ? '✅' : '❌'}\n`);

console.log('所有测试完成!');
