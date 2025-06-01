// server/controllers/authController.js
const { logger } = require('../utils/logger')
const { User } = require('../models/User')
const {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  refreshToken
} = require('../config/jwt')
const { comparePassword, hashPassword } = require('../utils/auth')

class AuthController {
  /**
   * 用户注册
   */
  async register(req, res) {
    try {
      const { email, password, name } = req.body

      // 验证输入
      if (!email || !password || !name) {
        return res.status(400).json({ error: '缺少必要字段' })
      }

      // 检查用户是否存在
      const existingUser = await User.findOne({ email })
      if (existingUser) {
        return res.status(409).json({ error: '邮箱已被注册' })
      }

      // 密码哈希处理
      const hashedPassword = await hashPassword(password)

      // 创建用户
      const user = new User({
        email,
        password: hashedPassword,
        name,
        role: 'user' // 默认角色
      })
      await user.save()

      // 生成令牌
      const accessToken = await generateAccessToken({
        userId: user._id,
        role: user.role
      })
      const refreshToken = await generateRefreshToken({
        userId: user._id
      })

      // 返回响应（敏感信息过滤）
      const userResponse = {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt
      }

      res.status(201).json({
        user: userResponse,
        accessToken,
        refreshToken
      })

    } catch (error) {
      logger.error('注册失败:', error)
      res.status(500).json({ error: '注册失败' })
    }
  }

  /**
   * 用户登录
   */
  async login(req, res) {
    try {
      const { email, password } = req.body

      // 验证输入
      if (!email || !password) {
        return res.status(400).json({ error: '邮箱和密码不能为空' })
      }

      // 查找用户
      const user = await User.findOne({ email })
      if (!user) {
        return res.status(401).json({ error: '无效的邮箱或密码' })
      }

      // 验证密码
      const isValidPassword = await comparePassword(password, user.password)
      if (!isValidPassword) {
        return res.status(401).json({ error: '无效的邮箱或密码' })
      }

      // 生成令牌
      const accessToken = await generateAccessToken({
        userId: user._id,
        role: user.role
      })
      const refreshToken = await generateRefreshToken({
        userId: user._id
      })

      // 更新最后登录时间
      user.lastLoginAt = new Date()
      await user.save()

      // 返回响应（敏感信息过滤）
      const userResponse = {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        lastLoginAt: user.lastLoginAt
      }

      res.json({
        user: userResponse,
        accessToken,
        refreshToken
      })

    } catch (error) {
      logger.error('登录失败:', error)
      res.status(500).json({ error: '登录失败' })
    }
  }

  /**
   * 令牌刷新
   */
  async refresh(req, res) {
    try {
      const { refreshToken } = req.body

      if (!refreshToken) {
        return res.status(400).json({ error: '缺少刷新令牌' })
      }

      // 验证并刷新令牌
      const tokens = await refreshToken(refreshToken)

      res.json(tokens)

    } catch (error) {
      logger.error('令牌刷新失败:', error)
      res.status(401).json({ error: '无效的刷新令牌' })
    }
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(req, res) {
    try {
      // 从认证中间件获取用户ID
      const userId = req.user.userId

      const user = await User.findById(userId).select('-password -__v')
      if (!user) {
        return res.status(404).json({ error: '用户不存在' })
      }

      res.json(user)

    } catch (error) {
      logger.error('获取用户信息失败:', error)
      res.status(500).json({ error: '获取用户信息失败' })
    }
  }

  /**
   * 修改密码
   */
  async changePassword(req, res) {
    try {
      const userId = req.user.userId
      const { currentPassword, newPassword } = req.body

      // 验证输入
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: '当前密码和新密码不能为空' })
      }

      // 获取用户
      const user = await User.findById(userId)
      if (!user) {
        return res.status(404).json({ error: '用户不存在' })
      }

      // 验证当前密码
      const isValid = await comparePassword(currentPassword, user.password)
      if (!isValid) {
        return res.status(401).json({ error: '当前密码不正确' })
      }

      // 更新密码
      user.password = await hashPassword(newPassword)
      await user.save()

      res.json({ message: '密码修改成功' })

    } catch (error) {
      logger.error('修改密码失败:', error)
      res.status(500).json({ error: '修改密码失败' })
    }
  }

  /**
   * 登出
   */
  async logout(req, res) {
    try {
      // 实际JWT是无状态的，这里可以添加令牌黑名单逻辑
      // 或者在前端删除存储的令牌
      res.json({ message: '登出成功' })

    } catch (error) {
      logger.error('登出失败:', error)
      res.status(500).json({ error: '登出失败' })
    }
  }
}

module.exports = new AuthController()