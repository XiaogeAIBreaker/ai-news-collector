/**
 * 微信公众号 Token 管理服务
 * 从环境变量加载和管理 token
 */
class WeChatLoginService {
  constructor() {
    this.token = null;
    this.cookie = null;
  }

  /**
   * 加载已保存的 token (从环境变量)
   * @returns {Promise<{token: string, cookie: string}>}
   */
  async loadToken() {
    try {
      // 从环境变量读取
      this.token = process.env.WECHAT_TOKEN;
      this.cookie = process.env.WECHAT_COOKIE;

      // 验证必需字段
      if (!this.token || !this.cookie) {
        throw new Error('未配置微信 Token 或 Cookie\n请在 .env 文件中添加:\nWECHAT_TOKEN=你的token\nWECHAT_COOKIE=你的cookie');
      }

      console.log('✅ 加载微信 Token 和 Cookie 成功');

      return {
        token: this.token,
        cookie: this.cookie,
      };
    } catch (error) {
      console.error('❌ 加载 Token 失败:', error.message);
      console.log('\n请按照以下步骤配置:');
      console.log('1. 查看文档: docs/how-to-get-wechat-token.md');
      console.log('2. 在 .env 文件中添加 WECHAT_TOKEN 和 WECHAT_COOKIE\n');
      throw error;
    }
  }

  /**
   * 获取 token
   * @returns {string}
   */
  getToken() {
    return this.token;
  }

  /**
   * 获取 cookie
   * @returns {string}
   */
  getCookie() {
    return this.cookie;
  }

  /**
   * 主登录流程 - 简化为加载 token
   * @returns {Promise<{token: string, cookie: string, nickname: string}>}
   */
  async login() {
    try {
      console.log('\n🔑 正在加载微信公众号 Token...\n');

      const credentials = await this.loadToken();

      console.log('✅ Token 加载成功!\n');

      return credentials;
    } catch (error) {
      console.error('\n❌ Token 加载失败:', error.message);
      throw error;
    }
  }
}

export default WeChatLoginService;
