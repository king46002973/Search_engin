// server/utils/validator.js
const { logger } = require('./logger')
const { Types } = require('mongoose')

class Validator {
  constructor() {
    // 常用正则表达式
    this.patterns = {
      email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      phone: /^\+?[1-9]\d{1,14}$/, // E.164格式
      password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      url: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
      ip: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    }

    // 错误消息模板
    this.messages = {
      required: '{field} 是必填字段',
      invalid: '{field} 格式无效',
      minLength: '{field} 长度不能少于 {min} 个字符',
      maxLength: '{field} 长度不能超过 {max} 个字符',
      notFound: '{field} 不存在',
      alreadyExists: '{field} 已存在',
      invalidType: '{field} 必须是 {type} 类型'
    }
  }

  /**
   * 验证请求体
   * @param {Object} data - 要验证的数据
   * @param {Object} rules - 验证规则
   */
  validate(data, rules) {
    const errors = {}

    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field]
      const fieldErrors = []

      // 检查必填字段
      if (rule.required && (value === undefined || value === null || value === '')) {
        fieldErrors.push(this.formatMessage('required', { field }))
      }

      // 类型检查
      if (value !== undefined && value !== null && rule.type) {
        if (!this.checkType(value, rule.type)) {
          fieldErrors.push(this.formatMessage('invalidType', { 
            field, 
            type: rule.type 
          }))
        }
      }

      // 长度检查
      if (typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          fieldErrors.push(this.formatMessage('minLength', { 
            field, 
            min: rule.minLength 
          }))
        }

        if (rule.maxLength && value.length > rule.maxLength) {
          fieldErrors.push(this.formatMessage('maxLength', { 
            field, 
            max: rule.maxLength 
          }))
        }
      }

      // 正则表达式检查
      if (rule.pattern && !this.patterns[rule.pattern].test(value)) {
        fieldErrors.push(this.formatMessage('invalid', { field }))
      }

      // 自定义验证
      if (rule.custom && typeof rule.custom === 'function') {
        const customError = rule.custom(value, data)
        if (customError) {
          fieldErrors.push(customError)
        }
      }

      // 如果有错误，添加到错误对象
      if (fieldErrors.length > 0) {
        errors[field] = fieldErrors
      }
    }

    return Object.keys(errors).length > 0 ? errors : null
  }

  /**
   * 检查数据类型
   */
  checkType(value, type) {
    switch (type) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number' && !isNaN(value)
      case 'boolean':
        return typeof value === 'boolean'
      case 'array':
        return Array.isArray(value)
      case 'object':
        return typeof value === 'object' && !Array.isArray(value) && value !== null
      case 'date':
        return value instanceof Date
      case 'objectId':
        return Types.ObjectId.isValid(value)
      case 'email':
        return this.patterns.email.test(value)
      case 'phone':
        return this.patterns.phone.test(value)
      case 'url':
        return this.patterns.url.test(value)
      case 'ip':
        return this.patterns.ip.test(value)
      default:
        return true
    }
  }

  /**
   * 格式化错误消息
   */
  formatMessage(message, params) {
    let msg = this.messages[message] || message
    
    for (const [key, value] of Object.entries(params)) {
      msg = msg.replace(new RegExp(`{${key}}`, 'g'), value)
    }

    return msg
  }

  /**
   * 验证中间件
   */
  middleware(rules) {
    return (req, res, next) => {
      const errors = this.validate(req.body, rules)
      
      if (errors) {
        logger.warn('验证失败', { 
          path: req.path, 
          errors 
        })
        
        return res.status(400).json({
          success: false,
          error: '参数验证失败',
          details: errors
        })
      }

      next()
    }
  }

  /**
   * 验证ObjectId
   */
  validateObjectId(id, field = 'ID') {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error(this.formatMessage('invalid', { field }))
    }
    return true
  }

  /**
   * 验证分页参数
   */
  validatePagination(page, pageSize, maxPageSize = 100) {
    page = parseInt(page) || 1
    pageSize = parseInt(pageSize) || 10
    
    if (page < 1) {
      throw new Error('页码必须大于0')
    }

    if (pageSize < 1 || pageSize > maxPageSize) {
      throw new Error(`每页记录数必须在1-${maxPageSize}之间`)
    }

    return { page, pageSize }
  }

  /**
   * 验证排序参数
   */
  validateSort(sortBy, allowedFields, defaultSort = { createdAt: -1 }) {
    if (!sortBy) return defaultSort

    const sort = {}
    const parts = sortBy.split(':')

    if (parts.length !== 2 || !['asc', 'desc'].includes(parts[1])) {
      throw new Error('排序参数格式应为 field:asc|desc')
    }

    if (!allowedFields.includes(parts[0])) {
      throw new Error(`不允许按 ${parts[0]} 字段排序`)
    }

    sort[parts[0]] = parts[1] === 'asc' ? 1 : -1
    return sort
  }

  /**
   * 验证枚举值
   */
  validateEnum(value, enumValues, field) {
    if (!enumValues.includes(value)) {
      throw new Error(`${field} 必须是以下值之一: ${enumValues.join(', ')}`)
    }
    return true
  }

  /**
   * 验证文件上传
   */
  validateFile(file, options = {}) {
    if (!file) {
      throw new Error('请上传文件')
    }

    const { 
      maxSize = 5 * 1024 * 1024, // 5MB
      allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'],
      allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf']
    } = options

    // 检查文件大小
    if (file.size > maxSize) {
      throw new Error(`文件大小不能超过 ${maxSize / 1024 / 1024}MB`)
    }

    // 检查MIME类型
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error(`只支持 ${allowedTypes.join(', ')} 格式的文件`)
    }

    // 检查文件扩展名
    const extension = path.extname(file.originalname).toLowerCase()
    if (!allowedExtensions.includes(extension)) {
      throw new Error(`只支持 ${allowedExtensions.join(', ')} 格式的文件`)
    }

    return true
  }
}

module.exports = new Validator()