// server/controllers/adminController.js
const { logger } = require('../utils/logger')
const { User, Enterprise, Website } = require('../models')
const { validateAdminAction } = require('../utils/validator')

class AdminController {
  /**
   * 获取用户列表 (分页)
   */
  async getUsers(req, res) {
    try {
      const { page = 1, pageSize = 20, role, status } = req.query
      
      // 验证管理员权限
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: '无权访问' })
      }

      // 构建查询条件
      const query = {}
      if (role) query.role = role
      if (status) query.status = status

      const [users, total] = await Promise.all([
        User.find(query)
          .select('-password -__v')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean(),
        User.countDocuments(query)
      ])

      res.json({
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        data: users
      })

    } catch (error) {
      logger.error('获取用户列表失败:', error)
      res.status(500).json({ error: '获取用户列表失败' })
    }
  }

  /**
   * 更新用户状态
   */
  async updateUserStatus(req, res) {
    try {
      const { userId } = req.params
      const { status } = req.body

      // 验证输入
      const { error } = validateAdminAction({ status })
      if (error) {
        return res.status(400).json({ error: error.details[0].message })
      }

      // 禁止修改管理员账户
      const user = await User.findById(userId)
      if (user.role === 'admin') {
        return res.status(403).json({ error: '无权修改管理员账户' })
      }

      // 更新状态
      user.status = status
      await user.save()

      res.json({ message: '用户状态更新成功' })

    } catch (error) {
      logger.error('更新用户状态失败:', error)
      res.status(500).json({ error: '更新用户状态失败' })
    }
  }

  /**
   * 获取企业审核列表
   */
  async getPendingEnterprises(req, res) {
    try {
      const { page = 1, pageSize = 20 } = req.query

      const [enterprises, total] = await Promise.all([
        Enterprise.find({ status: 'pending' })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean(),
        Enterprise.countDocuments({ status: 'pending' })
      ])

      res.json({
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        data: enterprises
      })

    } catch (error) {
      logger.error('获取待审核企业失败:', error)
      res.status(500).json({ error: '获取待审核企业失败' })
    }
  }

  /**
   * 审核企业
   */
  async reviewEnterprise(req, res) {
    try {
      const { enterpriseId } = req.params
      const { action, reason } = req.body

      // 验证输入
      const { error } = validateAdminAction({ action })
      if (error) {
        return res.status(400).json({ error: error.details[0].message })
      }

      const enterprise = await Enterprise.findById(enterpriseId)
      if (!enterprise) {
        return res.status(404).json({ error: '企业不存在' })
      }

      // 更新企业状态
      enterprise.status = action === 'approve' ? 'approved' : 'rejected'
      enterprise.reviewReason = reason || ''
      enterprise.reviewedAt = new Date()
      enterprise.reviewedBy = req.user.userId

      await enterprise.save()

      // TODO: 发送审核通知邮件

      res.json({ message: '企业审核完成' })

    } catch (error) {
      logger.error('审核企业失败:', error)
      res.status(500).json({ error: '审核企业失败' })
    }
  }

  /**
   * 获取系统统计信息
   */
  async getSystemStats(req, res) {
    try {
      const [userCount, enterpriseCount, websiteCount] = await Promise.all([
        User.countDocuments(),
        Enterprise.countDocuments(),
        Website.countDocuments()
      ])

      res.json({
        users: userCount,
        enterprises: enterpriseCount,
        websites: websiteCount,
        lastUpdated: new Date()
      })

    } catch (error) {
      logger.error('获取系统统计失败:', error)
      res.status(500).json({ error: '获取系统统计失败' })
    }
  }

  /**
   * 管理操作日志
   */
  async getActionLogs(req, res) {
    try {
      const { page = 1, pageSize = 50 } = req.query

      // 实际项目中应从数据库获取日志
      const logs = [
        {
          action: 'user_status_update',
          target: 'user:123',
          by: 'admin:456',
          at: new Date()
        }
      ]

      res.json({
        page: Number(page),
        pageSize: Number(pageSize),
        data: logs
      })

    } catch (error) {
      logger.error('获取操作日志失败:', error)
      res.status(500).json({ error: '获取操作日志失败' })
    }
  }
}

module.exports = new AdminController()