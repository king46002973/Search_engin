// server/services/export.js
const fs = require('fs')
const { promisify } = require('util')
const { pipeline } = require('stream')
const { logger } = require('../utils/logger')
const { Enterprise, Website, User } = require('../models')
const { createTempDir, cleanupTempFiles } = require('../utils/file')

const pipelineAsync = promisify(pipeline)

class ExportService {
  constructor() {
    // 导出配置
    this.config = {
      maxExportRecords: 10000, // 最大导出记录数
      tempDir: './temp/exports', // 临时文件目录
      retentionPeriod: 3600 * 1000 // 临时文件保留时间(1小时)
    }

    // 初始化临时目录
    createTempDir(this.config.tempDir)
    
    // 定期清理临时文件
    setInterval(() => cleanupTempFiles(this.config.tempDir, this.config.retentionPeriod), 3600 * 1000)
  }

  /**
   * 导出企业数据
   * @param {Object} query - 查询条件
   * @param {Object} options - 导出选项
   */
  async exportEnterprises(query = {}, options = {}) {
    const { format = 'csv', fields = 'all' } = options
    
    try {
      // 验证导出数量限制
      const count = await Enterprise.countDocuments(query)
      if (count > this.config.maxExportRecords) {
        throw new Error(`导出记录数超过最大限制(${this.config.maxExportRecords})`)
      }

      // 获取数据流
      const dataStream = await this.getEnterpriseStream(query, fields)
      
      // 生成导出文件
      const filePath = await this.generateExportFile(
        dataStream, 
        'enterprises',
        format,
        this.getEnterpriseHeaders(fields)
      )

      return {
        success: true,
        filePath,
        count,
        format
      }
    } catch (error) {
      logger.error('企业数据导出失败:', error)
      throw new Error(`企业数据导出失败: ${error.message}`)
    }
  }

  /**
   * 导出网站数据
   * @param {Object} query - 查询条件
   * @param {Object} options - 导出选项
   */
  async exportWebsites(query = {}, options = {}) {
    const { format = 'csv', fields = 'all' } = options
    
    try {
      // 验证导出数量限制
      const count = await Website.countDocuments(query)
      if (count > this.config.maxExportRecords) {
        throw new Error(`导出记录数超过最大限制(${this.config.maxExportRecords})`)
      }

      // 获取数据流
      const dataStream = await this.getWebsiteStream(query, fields)
      
      // 生成导出文件
      const filePath = await this.generateExportFile(
        dataStream, 
        'websites',
        format,
        this.getWebsiteHeaders(fields)
      )

      return {
        success: true,
        filePath,
        count,
        format
      }
    } catch (error) {
      logger.error('网站数据导出失败:', error)
      throw new Error(`网站数据导出失败: ${error.message}`)
    }
  }

  /**
   * 导出用户数据
   * @param {Object} query - 查询条件
   * @param {Object} options - 导出选项
   */
  async exportUsers(query = {}, options = {}) {
    const { format = 'csv', fields = 'all' } = options
    
    try {
      // 验证导出数量限制
      const count = await User.countDocuments(query)
      if (count > this.config.maxExportRecords) {
        throw new Error(`导出记录数超过最大限制(${this.config.maxExportRecords})`)
      }

      // 获取数据流
      const dataStream = await this.getUserStream(query, fields)
      
      // 生成导出文件
      const filePath = await this.generateExportFile(
        dataStream, 
        'users',
        format,
        this.getUserHeaders(fields)
      )

      return {
        success: true,
        filePath,
        count,
        format
      }
    } catch (error) {
      logger.error('用户数据导出失败:', error)
      throw new Error(`用户数据导出失败: ${error.message}`)
    }
  }

  /**
   * 获取企业数据流
   */
  async getEnterpriseStream(query, fields) {
    const projection = this.getEnterpriseProjection(fields)
    
    return Enterprise.find(query)
      .select(projection)
      .lean()
      .cursor()
  }

  /**
   * 获取网站数据流
   */
  async getWebsiteStream(query, fields) {
    const projection = this.getWebsiteProjection(fields)
    
    return Website.find(query)
      .select(projection)
      .populate('enterprise', 'name industry')
      .lean()
      .cursor()
  }

  /**
   * 获取用户数据流
   */
  async getUserStream(query, fields) {
    const projection = this.getUserProjection(fields)
    
    return User.find(query)
      .select(projection)
      .lean()
      .cursor()
  }

  /**
   * 生成导出文件
   */
  async generateExportFile(dataStream, entityName, format, headers) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `${entityName}-${timestamp}.${format}`
    const filePath = `${this.config.tempDir}/${fileName}`

    try {
      // 创建写入流
      const writeStream = fs.createWriteStream(filePath)
      
      // 根据格式处理数据流
      switch (format.toLowerCase()) {
        case 'csv':
          await this.generateCSV(dataStream, writeStream, headers)
          break
        case 'json':
          await this.generateJSON(dataStream, writeStream)
          break
        default:
          throw new Error(`不支持的导出格式: ${format}`)
      }

      return filePath
    } catch (error) {
      // 清理失败的文件
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
      throw error
    }
  }

  /**
   * 生成CSV文件
   */
  async generateCSV(dataStream, writeStream, headers) {
    // 写入CSV表头
    writeStream.write(headers.join(',') + '\n')

    await pipelineAsync(
      dataStream,
      async function* (source) {
        for await (const record of source) {
          // 将记录转换为CSV行
          const row = headers.map(header => {
            const value = this.getNestedValue(record, header)
            // 处理包含逗号或换行的字段
            return typeof value === 'string' 
              ? `"${value.replace(/"/g, '""')}"` 
              : value
          }).join(',')
          yield row + '\n'
        }
      }.bind(this),
      writeStream
    )
  }

  /**
   * 生成JSON文件
   */
  async generateJSON(dataStream, writeStream) {
    writeStream.write('[')
    
    let firstRecord = true
    await pipelineAsync(
      dataStream,
      async function* (source) {
        for await (const record of source) {
          if (!firstRecord) {
            yield ','
          }
          firstRecord = false
          yield JSON.stringify(record)
        }
      },
      writeStream
    )
    
    writeStream.write(']')
  }

  /**
   * 获取嵌套对象的值
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((o, p) => o?.[p] ?? '', obj)
  }

  /**
   * 获取企业数据字段映射
   */
  getEnterpriseProjection(fields) {
    if (fields === 'all') {
      return '-__v -createdAt -updatedAt'
    }

    const fieldMap = {
      name: 1,
      industry: 1,
      description: 1,
      'contact.email': 1,
      'contact.phone': 1,
      'contact.address': 1,
      status: 1
    }

    return fields.reduce((proj, field) => {
      proj[field] = fieldMap[field] || 0
      return proj
    }, {})
  }

  /**
   * 获取网站数据字段映射
   */
  getWebsiteProjection(fields) {
    if (fields === 'all') {
      return '-__v -createdAt -updatedAt'
    }

    const fieldMap = {
      domain: 1,
      title: 1,
      description: 1,
      type: 1,
      technologies: 1,
      enterprise: 1,
      status: 1
    }

    return fields.reduce((proj, field) => {
      proj[field] = fieldMap[field] || 0
      return proj
    }, {})
  }

  /**
   * 获取用户数据字段映射
   */
  getUserProjection(fields) {
    if (fields === 'all') {
      return '-__v -password -salt -createdAt -updatedAt'
    }

    const fieldMap = {
      name: 1,
      email: 1,
      role: 1,
      status: 1,
      lastLoginAt: 1
    }

    return fields.reduce((proj, field) => {
      proj[field] = fieldMap[field] || 0
      return proj
    }, {})
  }

  /**
   * 获取企业CSV表头
   */
  getEnterpriseHeaders(fields) {
    const allHeaders = [
      'name',
      'industry',
      'description',
      'contact.email',
      'contact.phone',
      'contact.address',
      'status'
    ]

    return fields === 'all' 
      ? allHeaders 
      : allHeaders.filter(h => fields.includes(h.split('.')[0]))
  }

  /**
   * 获取网站CSV表头
   */
  getWebsiteHeaders(fields) {
    const allHeaders = [
      'domain',
      'title',
      'description',
      'type',
      'technologies',
      'enterprise.name',
      'enterprise.industry',
      'status'
    ]

    return fields === 'all' 
      ? allHeaders 
      : allHeaders.filter(h => fields.includes(h.split('.')[0]))
  }

  /**
   * 获取用户CSV表头
   */
  getUserHeaders(fields) {
    const allHeaders = [
      'name',
      'email',
      'role',
      'status',
      'lastLoginAt'
    ]

    return fields === 'all' ? allHeaders : fields
  }

  /**
   * 清理过期导出文件
   */
  async cleanupExpiredExports() {
    return cleanupTempFiles(this.config.tempDir, this.config.retentionPeriod)
  }
}

module.exports = new ExportService()