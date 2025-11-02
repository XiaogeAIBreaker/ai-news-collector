import fs from 'fs';
import path from 'path';

/**
 * Token 本地存储类
 * 负责微信公众号 token 的持久化保存和读取
 */
class TokenStore {
  constructor() {
    // Token 文件路径:项目根目录下的 .wechat-token.json
    this.tokenFilePath = path.join(process.cwd(), '.wechat-token.json');
  }

  /**
   * 保存 token 到本地文件
   * @param {Object} tokenData - Token 数据对象
   * @param {string} tokenData.token - 公众号后台 token
   * @param {string} tokenData.cookie - 完整 cookie 字符串
   * @param {string} [tokenData.nickname] - 登录的公众号名称(可选)
   * @returns {boolean} 是否保存成功
   */
  save(tokenData) {
    try {
      // 构建完整的 token 对象
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7天后过期

      const fullTokenData = {
        token: tokenData.token,
        cookie: tokenData.cookie,
        nickname: tokenData.nickname || '',
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString(),
      };

      // 保存为 JSON 格式
      fs.writeFileSync(
        this.tokenFilePath,
        JSON.stringify(fullTokenData, null, 2),
        'utf8'
      );

      // 设置文件权限为 600 (仅当前用户可读写)
      // Windows 不支持 chmod,需要判断平台
      if (process.platform !== 'win32') {
        fs.chmodSync(this.tokenFilePath, 0o600);
      }

      console.log('✅ Token 已保存到本地文件:', this.tokenFilePath);
      return true;
    } catch (error) {
      console.error('❌ Token 保存失败:', error.message);
      return false;
    }
  }

  /**
   * 从本地文件加载 token
   * @returns {Object|null} Token 数据对象,失败返回 null
   */
  load() {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(this.tokenFilePath)) {
        return null;
      }

      // 读取并解析 JSON
      const fileContent = fs.readFileSync(this.tokenFilePath, 'utf8');
      const tokenData = JSON.parse(fileContent);

      // 验证数据结构
      if (!tokenData.token || !tokenData.cookie) {
        console.warn('⚠️  Token 文件数据不完整,缺少必需字段');
        return null;
      }

      // 检查是否过期
      if (tokenData.expires_at) {
        const expiresAt = new Date(tokenData.expires_at);
        const now = new Date();

        if (now >= expiresAt) {
          console.log('⏰ Token 已过期,需要重新登录');
          return null;
        }

        // 计算剩余天数
        const remainingDays = Math.ceil(
          (expiresAt - now) / (24 * 60 * 60 * 1000)
        );
        console.log(
          `✅ 加载已保存的 Token (剩余有效期: ${remainingDays} 天)`
        );
      }

      return tokenData;
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error('❌ Token 文件格式错误,JSON 解析失败');
      } else {
        console.error('❌ Token 加载失败:', error.message);
      }
      return null;
    }
  }

  /**
   * 检查 token 文件是否存在
   * @returns {boolean} 文件是否存在
   */
  exists() {
    return fs.existsSync(this.tokenFilePath);
  }

  /**
   * 删除 token 文件
   * @returns {boolean} 是否删除成功
   */
  delete() {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        fs.unlinkSync(this.tokenFilePath);
        console.log('✅ Token 文件已删除');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Token 文件删除失败:', error.message);
      return false;
    }
  }

  /**
   * 获取 token 文件路径
   * @returns {string} 文件路径
   */
  getFilePath() {
    return this.tokenFilePath;
  }
}

export default TokenStore;
