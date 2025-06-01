// server/models/User.js
const mongoose = require('mongoose')
const { logger } = require('../utils/logger')
const { hashPassword, comparePassword } = require('../utils/auth')

// 用户角色枚举
const USER_ROLES = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  USER: 'user',
  GUEST: 'guest'
}

// 用户状态枚举
const USER_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  BANNED: 'banned',
  PENDING: 'pending'
}

const userSchema = new mongoose.Schema({
  // 认证信息
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '邮箱格式不正确'],
    index: true
  },
  password: {
    type: String,
    required: true,
    select: false,
    minlength: 8,
    maxlength: 128
  },

  // 个人信息
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  avatar: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[0-9\-\+]{6,20}$/, '电话号码格式不正确']
  },

  // 权限控制
  role: {
    type: String,
    required: true,
    enum: Object.values(USER_ROLES),
    default: USER_ROLES.USER
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(USER_STATUS),
    default: USER_STATUS.PENDING
  },
  permissions: {
    type: [String],
    default: []
  },

  // 安全信息
  lastLoginAt: Date,
  lastLoginIp: String,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,

  // 系统信息
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date,
  deletedAt: Date
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret.__v
      delete ret.password
      delete ret.loginAttempts
      delete ret.lockUntil
      return ret
    }
  }
})

// 添加索引
userSchema.index({ email: 1, status: 1 })
userSchema.index({ name: 'text' })

// 虚拟字段
userSchema.virtual('id').get(function() {
  return this._id.toHexString()
})

// 静态方法
userSchema.statics = {
  USER_ROLES,
  USER_STATUS,

  // 通过邮箱查找用户
  async findByEmail(email) {
    return this.findOne({ email }).select('+password')
  },

  // 检查邮箱是否已注册
  async isEmailTaken(email, excludeUserId) {
    const user = await this.findOne({ 
      email, 
      _id: { $ne: excludeUserId } 
    })
    return !!user
  },

  // 获取用户统计
  async getUserStats() {
    return this.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ['$status', USER_STATUS.ACTIVE] }, 1, 0] }
          },
          admins: {
            $sum: { $cond: [{ $eq: ['$role', USER_ROLES.ADMIN] }, 1, 0] }
          }
        }
      }
    ])
  }
}

// 实例方法
userSchema.methods = {
  // 验证密码
  async isPasswordMatch(password) {
    return comparePassword(password, this.password)
  },

  // 生成简化的用户信息
  toProfileJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      avatar: this.avatar,
      role: this.role,
      status: this.status,
      createdAt: this.createdAt
    }
  },

  // 记录登录信息
  async recordLogin(ip) {
    this.lastLoginAt = new Date()
    this.lastLoginIp = ip
    this.loginAttempts = 0
    return this.save()
  },

  // 增加登录尝试次数
  async incrementLoginAttempts() {
    this.loginAttempts += 1
    if (this.loginAttempts >= 5) {
      this.lockUntil = new Date(Date.now() + 15 * 60 * 1000) // 锁定15分钟
    }
    return this.save()
  }
}

// 密码哈希中间件
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()

  try {
    this.password = await hashPassword(this.password)
    next()
  } catch (error) {
    next(error)
  }
})

// 更新日期中间件
userSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

// 日志记录钩子
userSchema.post('save', function(doc) {
  logger.info(`用户记录已保存: ${doc.email} (${doc._id})`)
})

userSchema.post('remove', function(doc) {
  logger.warn(`用户记录已删除: ${doc.email} (${doc._id})`)
})

// 软删除实现
userSchema.methods.softDelete = function() {
  this.deletedAt = new Date()
  return this.save()
}

// 创建模型
const User = mongoose.model('User', userSchema)

module.exports = User