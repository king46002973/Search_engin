// server/middlewares/rateLimit.js
const { logger } = require('../utils/logger')

class RateLimiter {
  constructor() {
    // 使用Map存储请求记录
    this.requests = new Map()
    // 默认配置
    this.defaultConfig = {
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 100, // 每个IP最多100次请求
      message: '请求过于频繁，请稍后再试',
      statusCode: 429,
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    }
  }

  /**
   * 创建限流中间件
   * @param {Object} config - 限流配置
   */
  createLimiter(config = {}) {
    const options = { ...this.defaultConfig, ...config }
    
    return (req, res, next) => {
      try {
        // 获取客户端标识（优先使用IP，可扩展为API Key等）
        const clientId = this.getClientIdentifier(req)
        
        // 跳过特定请求
        if (this.shouldSkip(req, options)) {
          return next()
        }

        // 初始化或获取该客户端的记录
        const currentTime = Date.now()
        let clientRecord = this.requests.get(clientId) || {
          count: 0,
          startTime: currentTime
        }

        // 检查时间窗口是否过期
        if (currentTime - clientRecord.startTime > options.windowMs) {
          clientRecord = { count: 1, startTime: currentTime }
          this.requests.set(clientId, clientRecord)
          return next()
        }

        // 检查请求计数
        if (clientRecord.count >= options.max) {
          // 计算剩余时间（秒）
          const resetTime = Math.ceil(
            (clientRecord.startTime + options.windowMs - currentTime) / 1000
          )
          
          // 设置响应头
          res.setHeader('X-RateLimit-Limit', options.max)
          res.setHeader('X-RateLimit-Remaining', 0)
          res.setHeader('X-RateLimit-Reset', resetTime)
          
          logger.warn(`限流触发: ${clientId}`, {
            count: clientRecord.count,
            max: options.max,
            window: options.windowMs
          })
          
          return res.status(options.statusCode).json({ 
            error: options.message,
            retryAfter: resetTime
          })
        }

        // 增加计数并继续
        clientRecord.count++
        this.requests.set(clientId, clientRecord)
        
        // 设置响应头
        res.setHeader('X-RateLimit-Limit', options.max)
        res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - clientRecord.count))
        
        next()
      } catch (error) {
        logger.error('限流中间件错误:', error)
        next() // 限流失败时放行请求
      }
    }
  }

  /**
   * 获取客户端标识
   */
  getClientIdentifier(req) {
    // 优先使用IP地址
    return req.ip || 
           req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           'unknown'
  }

  /**
   * 判断是否跳过限流
   */
  shouldSkip(req, options) {
    // 跳过成功的GET请求（如果配置）
    if (options.skipSuccessfulRequests && 
        req.method === 'GET' && 
        res.statusCode < 400) {
      return true
    }
    
    // 跳过失败的请求（如果配置）
    if (options.skipFailedRequests && 
        res.statusCode >= 400) {
      return true
    }
    
    // 可扩展其他跳过逻辑（如白名单等）
    return false
  }

  /**
   * 定期清理过期的记录
   */
  startCleanup(intervalMs = 60 * 1000) {
    setInterval(() => {
      const now = Date.now()
      for (const [key, record] of this.requests) {
        if (now - record.startTime > this.defaultConfig.windowMs) {
          this.requests.delete(key)
        }
      }
    }, intervalMs)
  }
}

// 创建单例实例并启动清理任务
const rateLimiter = new RateLimiter()
rateLimiter.startCleanup()

// 导出工厂函数
module.exports = (config) => rateLimiter.createLimiter(config)

// 导出预设限流规则（可根据路由定制）
module.exports.strict = rateLimiter.createLimiter({ 
  max: 10, 
  windowMs: 60 * 1000 
})

module.exports.api = rateLimiter.createLimiter({ 
  max: 1000, 
  windowMs: 60 * 60 * 1000 
})

module.exports.auth = rateLimiter.createLimiter({ 
  max: 5, 
  windowMs: 15 * 60 * 1000,
  message: '登录尝试过于频繁，请15分钟后再试'
})