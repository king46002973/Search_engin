// server/config/jwt.js
const jwt = require('jsonwebtoken')
const { logger } = require('../utils/logger')
const crypto = require('crypto')

class JWTService {
  constructor() {
    this.secretKey = this._generateSecureKey()
    this.accessTokenExpiry = '15m' // 15分钟
    this.refreshTokenExpiry = '7d'  // 7天
    this.issuer = 'king-platform'
    this.audience = 'king-client'
  }

  /**
   * 生成安全的随机密钥
   */
  _generateSecureKey() {
    return crypto.randomBytes(64).toString('hex')
  }

  /**
   * 生成访问令牌
   * @param {object} payload - 负载数据
   * @param {string} [expiry] - 过期时间
   */
  generateAccessToken(payload, expiry = this.accessTokenExpiry) {
    const options = {
      expiresIn: expiry,
      issuer: this.issuer,
      audience: this.audience
    }

    return new Promise((resolve, reject) => {
      jwt.sign(
        payload,
        this.secretKey,
        options,
        (err, token) => {
          if (err) {
            logger.error('生成访问令牌失败:', err)
            return reject(err)
          }
          resolve(token)
        }
      )
    })
  }

  /**
   * 生成刷新令牌
   */
  generateRefreshToken(payload) {
    return this.generateAccessToken(payload, this.refreshTokenExpiry)
  }

  /**
   * 验证令牌
   * @param {string} token - JWT令牌
   */
  verifyToken(token) {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        this.secretKey,
        {
          issuer: this.issuer,
          audience: this.audience
        },
        (err, decoded) => {
          if (err) {
            logger.error('令牌验证失败:', err)
            return reject(this._handleJWTError(err))
          }
          resolve(decoded)
        }
      )
    })
  }

  /**
   * 处理JWT错误
   * @param {Error} err - JWT错误对象
   */
  _handleJWTError(err) {
    const errorMap = {
      'TokenExpiredError': {
        code: 401,
        message: '令牌已过期'
      },
      'JsonWebTokenError': {
        code: 403,
        message: '无效的令牌'
      },
      'NotBeforeError': {
        code: 403,
        message: '令牌尚未生效'
      }
    }

    const errorType = err.name
    return errorMap[errorType] || {
      code: 500,
      message: '令牌验证失败'
    }
  }

  /**
   * 解码令牌(不验证)
   */
  decodeToken(token) {
    return jwt.decode(token)
  }

  /**
   * 刷新令牌
   * @param {string} refreshToken - 刷新令牌
   */
  async refreshToken(refreshToken) {
    try {
      const decoded = await this.verifyToken(refreshToken)
      
      // 移除旧的iat和exp声明
      const { iat, exp, ...payload } = decoded
      
      // 生成新的访问令牌
      const newAccessToken = await this.generateAccessToken(payload)
      
      return {
        accessToken: newAccessToken,
        refreshToken: refreshToken // 可以在这里生成新的refreshToken
      }
    } catch (error) {
      logger.error('刷新令牌失败:', error)
      throw error
    }
  }
}

// 创建单例实例
const jwtInstance = new JWTService()

// 导出配置
module.exports = {
  /**
   * 初始化JWT配置
   * @param {object} config - JWT配置
   */
  initJWT(config) {
    if (config.secretKey) {
      jwtInstance.secretKey = config.secretKey
    }
    if (config.accessTokenExpiry) {
      jwtInstance.accessTokenExpiry = config.accessTokenExpiry
    }
    if (config.refreshTokenExpiry) {
      jwtInstance.refreshTokenExpiry = config.refreshTokenExpiry
    }
    return jwtInstance
  },

  /**
   * 生成访问令牌
   */
  generateAccessToken(payload, expiry) {
    return jwtInstance.generateAccessToken(payload, expiry)
  },

  /**
   * 生成刷新令牌
   */
  generateRefreshToken(payload) {
    return jwtInstance.generateRefreshToken(payload)
  },

  /**
   * 验证令牌
   */
  verifyToken(token) {
    return jwtInstance.verifyToken(token)
  },

  /**
   * 解码令牌
   */
  decodeToken(token) {
    return jwtInstance.decodeToken(token)
  },

  /**
   * 刷新令牌
   */
  refreshToken(refreshToken) {
    return jwtInstance.refreshToken(refreshToken)
  }
}