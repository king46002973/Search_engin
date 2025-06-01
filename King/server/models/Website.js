// server/models/Website.js
const mongoose = require('mongoose')
const { logger } = require('../utils/logger')

// 网站状态枚举
const WEBSITE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  BANNED: 'banned'
}

// 网站类型枚举
const WEBSITE_TYPES = {
  CORPORATE: 'corporate',
  ECOMMERCE: 'ecommerce',
  BLOG: 'blog',
  PORTAL: 'portal',
  OTHER: 'other'
}

const websiteSchema = new mongoose.Schema({
  // 基础信息
  domain: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: [
      /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
      '域名格式不正确'
    ],
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  keywords: {
    type: [String],
    default: []
  },

  // 技术信息
  ip: {
    type: String,
    required: true,
    match: [
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
      'IP地址格式不正确'
    ]
  },
  server: {
    type: String,
    enum: ['nginx', 'apache', 'iis', 'cloudflare', 'other'],
    required: true
  },
  ssl: {
    type: Boolean,
    default: false
  },
  technologies: {
    type: [String],
    default: []
  },

  // 业务信息
  type: {
    type: String,
    required: true,
    enum: Object.values(WEBSITE_TYPES),
    default: WEBSITE_TYPES.OTHER
  },
  enterprise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enterprise',
    index: true
  },
  category: {
    type: String,
    trim: true
  },

  // 状态信息
  status: {
    type: String,
    required: true,
    enum: Object.values(WEBSITE_STATUS),
    default: WEBSITE_STATUS.PENDING
  },
  lastCrawledAt: Date,
  lastCrawlStatus: {
    type: String,
    enum: ['success', 'failed', 'partial'],
    default: 'success'
  },

  // 系统信息
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret.__v
      delete ret._id
      return ret
    }
  }
})

// 添加索引
websiteSchema.index({ domain: 1, status: 1 })
websiteSchema.index({ ip: 1 })
websiteSchema.index({ title: 'text', description: 'text', keywords: 'text' })

// 虚拟字段
websiteSchema.virtual('id').get(function() {
  return this._id.toHexString()
})

// 静态方法
websiteSchema.statics = {
  WEBSITE_STATUS,
  WEBSITE_TYPES,

  // 按状态统计网站数量
  async countByStatus() {
    return this.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  },

  // 按类型统计网站分布
  async countByType() {
    return this.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
  },

  // 按企业统计网站
  async countByEnterprise() {
    return this.aggregate([
      { $match: { enterprise: { $exists: true } } },
      { $group: { _id: '$enterprise', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ])
  }
}

// 实例方法
websiteSchema.methods = {
  // 更新爬取状态
  async updateCrawlStatus(status, meta = {}) {
    this.lastCrawledAt = new Date()
    this.lastCrawlStatus = status
    
    if (meta.technologies) {
      this.technologies = [...new Set([...this.technologies, ...meta.technologies])]
    }
    
    return this.save()
  },

  // 获取简化信息
  toSimpleJSON() {
    return {
      id: this.id,
      domain: this.domain,
      title: this.title,
      type: this.type,
      status: this.status,
      enterprise: this.enterprise
    }
  }
}

// 中间件
websiteSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  
  // 规范化域名
  if (this.domain && !this.domain.startsWith('http')) {
    this.domain = `https://${this.domain}`
  }
  
  next()
})

websiteSchema.post('save', function(doc) {
  logger.info(`网站记录已保存: ${doc.domain} (${doc._id})`)
})

websiteSchema.post('remove', function(doc) {
  logger.warn(`网站记录已删除: ${doc.domain} (${doc._id})`)
})

// 创建模型
const Website = mongoose.model('Website', websiteSchema)

module.exports = Website