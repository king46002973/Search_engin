// server/models/Enterprise.js
const mongoose = require('mongoose')
const { logger } = require('../utils/logger')

// 企业状态枚举
const ENTERPRISE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended'
}

// 行业类型枚举
const INDUSTRY_TYPES = [
  'IT', '金融', '制造', '医疗', '教育', 
  '零售', '餐饮', '建筑', '物流', '其他'
]

const enterpriseSchema = new mongoose.Schema({
  // 基础信息
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  logo: {
    type: String,
    default: ''
  },

  // 联系信息
  contact: {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '邮箱格式不正确']
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[0-9\-\+]{6,20}$/, '电话号码格式不正确']
    },
    address: {
      type: String,
      trim: true,
      maxlength: 200
    }
  },

  // 业务信息
  industry: {
    type: String,
    required: true,
    enum: INDUSTRY_TYPES,
    index: true
  },
  website: {
    type: String,
    trim: true,
    match: [/^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/, '网站格式不正确']
  },
  foundedYear: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear()
  },
  employeeCount: {
    type: Number,
    min: 1
  },

  // 审核信息
  status: {
    type: String,
    required: true,
    enum: Object.values(ENTERPRISE_STATUS),
    default: ENTERPRISE_STATUS.PENDING
  },
  reviewReason: {
    type: String,
    trim: true,
    maxlength: 500
  },
  reviewedAt: Date,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

// 添加文本索引支持全文搜索
enterpriseSchema.index({
  name: 'text',
  description: 'text',
  'contact.address': 'text'
})

// 添加复合索引提高查询性能
enterpriseSchema.index({ status: 1, industry: 1 })
enterpriseSchema.index({ createdAt: -1 })

// 虚拟字段
enterpriseSchema.virtual('id').get(function() {
  return this._id.toHexString()
})

// 静态方法
enterpriseSchema.statics = {
  // 根据状态获取企业数量
  async countByStatus() {
    return this.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  },

  // 行业分布统计
  async industryDistribution() {
    return this.aggregate([
      { $group: { _id: '$industry', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
  }
}

// 实例方法
enterpriseSchema.methods = {
  // 审核通过
  async approve(adminUserId, reason) {
    this.status = ENTERPRISE_STATUS.APPROVED
    this.reviewedBy = adminUserId
    this.reviewReason = reason || ''
    this.reviewedAt = new Date()
    return this.save()
  },

  // 审核拒绝
  async reject(adminUserId, reason) {
    if (!reason) throw new Error('必须提供拒绝原因')
    this.status = ENTERPRISE_STATUS.REJECTED
    this.reviewedBy = adminUserId
    this.reviewReason = reason
    this.reviewedAt = new Date()
    return this.save()
  },

  // 获取简化信息
  toSimpleJSON() {
    return {
      id: this.id,
      name: this.name,
      industry: this.industry,
      logo: this.logo,
      website: this.website
    }
  }
}

// 中间件
enterpriseSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

enterpriseSchema.post('save', function(doc) {
  logger.info(`企业记录已保存: ${doc.name} (${doc._id})`)
})

enterpriseSchema.post('remove', function(doc) {
  logger.warn(`企业记录已删除: ${doc.name} (${doc._id})`)
})

// 创建模型
const Enterprise = mongoose.model('Enterprise', enterpriseSchema)

// 导出枚举常量
module.exports = {
  Enterprise,
  ENTERPRISE_STATUS,
  INDUSTRY_TYPES
}