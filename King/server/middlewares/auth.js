// server/middlewares/auth.js
const { verifyToken } = require('../config/jwt')
const { logger } = require('../utils/logger')
const { User } = require('../models')

/**
 * 认证中间件 - 验证JWT令牌
 */
const authenticate = async (req, res, next) => {
  try {
    // 1. 获取令牌
    const token = extractToken(req)
    if (!token) {
      return res.status(401).json({ error: '未提供认证令牌' })
    }

    // 2. 验证令牌
    const decoded = await verifyToken(token)
    if (!decoded) {
      return res.status(401).json({ error: '无效的认证令牌' })
    }

    // 3. 获取用户信息
    const user = await User.findById(decoded.userId).select('-password')
    if (!user) {
      return res.status(401).json({ error: '用户不存在' })
    }

    // 4. 检查用户状态
    if (user.status !== 'active') {
      return res.status(403).json({ error: '账户已被禁用' })
    }

    // 5. 附加用户信息到请求对象
    req.user = {
      userId: user._id,
      role: user.role,
      email: user.email
    }

    next()
  } catch (error) {
    logger.error('认证失败:', error)
    
    // 根据错误类型返回不同的状态码
    const status = error.code === 'invalid_token' ? 401 : 500
    res.status(status).json({ 
      error: error.message || '认证失败' 
    })
  }
}

/**
 * 管理员权限检查中间件
 */
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: '无权访问该资源' })
  }
  next()
}

/**
 * 角色权限检查中间件
 * @param {string[]} allowedRoles - 允许的角色数组
 */
const roleCheck = (allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: '权限不足' })
    }
    next()
  }
}

/**
 * 从请求中提取令牌
 */
function extractToken(req) {
  // 1. 检查Authorization头
  if (req.headers.authorization && 
      req.headers.authorization.split(' ')[0] === 'Bearer') {
    return req.headers.authorization.split(' ')[1]
  }

  // 2. 检查查询参数
  if (req.query.token) {
    return req.query.token
  }

  // 3. 检查cookies
  if (req.cookies?.token) {
    return req.cookies.token
  }

  return null
}

/**
 * 请求限流中间件
 */
const rateLimiter = (maxRequests, windowMinutes) => {
  const requests = new Map()

  return (req, res, next) => {
    const ip = req.ip
    const now = Date.now()
    const windowMs = windowMinutes * 60 * 1000

    // 初始化记录
    if (!requests.has(ip)) {
      requests.set(ip, {
        count: 1,
        startTime: now
      })
      return next()
    }

    const record = requests.get(ip)

    // 重置时间窗口
    if (now - record.startTime > windowMs) {
      record.count = 1
      record.startTime = now
      return next()
    }

    // 检查请求次数
    if (record.count >= maxRequests) {
      const waitTime = Math.ceil((record.startTime + windowMs - now) / 1000)
      res.set('Retry-After', waitTime)
      return res.status(429).json({ 
        error: `请求过于频繁，请 ${waitTime} 秒后再试` 
      })
    }

    // 增加计数
    record.count++
    next()
  }
}

module.exports = {
  authenticate,
  adminOnly,
  roleCheck,
  rateLimiter
}