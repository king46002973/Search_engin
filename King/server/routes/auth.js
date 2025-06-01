// server/utils/auth.js
const crypto = require('crypto')
const { promisify } = require('util')
const { logger } = require('./logger')
const { User } = require('../models')

// 将回调函数转换为Promise
const pbkdf2 = promisify(crypto.pbkdf2)

class AuthUtils {
  /**
   * 生成密码哈希
   * @param {string} password - 明文密码
   * @param {string} [salt] - 可选盐值
   */
  static async hashPassword(password, salt) {
    try {
      const usedSalt = salt || crypto.randomBytes(16).toString('hex')
      const iterations = 10000
      const keylen = 64
      const digest = 'sha512'
      
      const derivedKey = await pbkdf2(
        password,
        usedSalt,
        iterations,
        keylen,
        digest
      )
      
      return {
        salt: usedSalt,
        hash: derivedKey.toString('hex'),
        iterations,
        keylen,
        digest
      }
    } catch (error) {
      logger.error('密码哈希生成失败:', error)
      throw new Error('密码处理失败')
    }
  }

  /**
   * 验证密码
   * @param {string} password - 明文密码
   * @param {string} hash - 存储的哈希值
   * @param {string} salt - 存储的盐值
   * @param {Object} options - 哈希参数
   */
  static async verifyPassword(password, hash, salt, options = {}) {
    try {
      const { iterations = 10000, keylen = 64, digest = 'sha512' } = options
      const derivedKey = await pbkdf2(
        password,
        salt,
        iterations,
        keylen,
        digest
      )
      return hash === derivedKey.toString('hex')
    } catch (error) {
      logger.error('密码验证失败:', error)
      return false
    }
  }

  /**
   * 生成随机令牌
   * @param {number} length - 令牌长度
   */
  static generateToken(length = 32) {
    return crypto.randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length)
  }

  /**
   * 验证用户凭证
   * @param {string} email - 用户邮箱
   * @param {string} password - 明文密码
   */
  static async validateCredentials(email, password) {
    try {
      const user = await User.findOne({ email }).select('+password +salt')
      if (!user) {
        logger.warn(`登录尝试: 用户不存在 - ${email}`)
        return null
      }

      const isValid = await this.verifyPassword(
        password,
        user.password,
        user.salt,
        {
          iterations: user.passwordIterations,
          keylen: user.passwordKeylen,
          digest: user.passwordDigest
        }
      )

      if (!isValid) {
        logger.warn(`登录尝试: 密码错误 - ${email}`)
        return null
      }

      return user
    } catch (error) {
      logger.error('凭证验证失败:', error)
      throw new Error('认证服务不可用')
    }
  }

  /**
   * 生成密码重置令牌
   * @param {Object} user - 用户对象
   */
  static async generatePasswordResetToken(user) {
    const token = this.generateToken(40)
    const expiresAt = new Date(Date.now() + 3600000) // 1小时后过期

    user.resetPasswordToken = token
    user.resetPasswordExpires = expiresAt
    await user.save()

    return token
  }

  /**
   * 验证密码重置令牌
   * @param {string} token - 重置令牌
   */
  static async verifyPasswordResetToken(token) {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    })

    if (!user) {
      logger.warn(`密码重置尝试: 无效令牌 - ${token}`)
      return null
    }

    return user
  }
}

// 导出工具方法
module.exports = {
  hashPassword: AuthUtils.hashPassword,
  verifyPassword: AuthUtils.verifyPassword,
  generateToken: AuthUtils.generateToken,
  validateCredentials: AuthUtils.validateCredentials,
  generatePasswordResetToken: AuthUtils.generatePasswordResetToken,
  verifyPasswordResetToken: AuthUtils.verifyPasswordResetToken
}