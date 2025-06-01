// server/services/search.js
const { logger } = require('../utils/logger')
const { Enterprise, Website } = require('../models')

class SearchService {
  constructor() {
    // 搜索权重配置
    this.weights = {
      enterprise: {
        name: 10,
        description: 5,
        industry: 3,
        'contact.address': 2
      },
      website: {
        domain: 10,
        title: 8,
        description: 5,
        keywords: 3
      }
    }
  }

  /**
   * 统一搜索入口
   * @param {string} query - 搜索关键词
   * @param {Object} options - 搜索选项
   */
  async unifiedSearch(query, options = {}) {
    const { page = 1, pageSize = 20, types = ['enterprise', 'website'] } = options
    
    try {
      const results = {}
      
      if (types.includes('enterprise')) {
        results.enterprises = await this.searchEnterprises(query, options)
      }
      
      if (types.includes('website')) {
        results.websites = await this.searchWebsites(query, options)
      }

      // 计算综合评分并混合排序
      if (types.length > 1) {
        results.combined = this.combineResults(
          results.enterprises?.data || [],
          results.websites?.data || [],
          page,
          pageSize
        )
      }

      return {
        success: true,
        data: results,
        meta: {
          query,
          page,
          pageSize,
          types
        }
      }
    } catch (error) {
      logger.error('统一搜索失败:', error)
      throw new Error('搜索服务暂时不可用')
    }
  }

  /**
   * 企业搜索
   * @param {string} query - 搜索关键词
   * @param {Object} options - 搜索选项
   */
  async searchEnterprises(query, options = {}) {
    const { page = 1, pageSize = 20, filters = {} } = options
    
    try {
      // 构建搜索查询
      const searchQuery = this.buildEnterpriseQuery(query, filters)
      
      // 执行搜索
      const [data, total] = await Promise.all([
        Enterprise.find(searchQuery)
          .sort(this.buildEnterpriseSort(query))
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean(),
        Enterprise.countDocuments(searchQuery)
      ])

      // 计算相关性评分
      const scoredData = data.map(item => ({
        ...item,
        _score: this.calculateEnterpriseScore(item, query)
      }))

      return {
        data: scoredData,
        meta: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    } catch (error) {
      logger.error('企业搜索失败:', error)
      throw new Error('企业搜索服务暂时不可用')
    }
  }

  /**
   * 网站搜索
   * @param {string} query - 搜索关键词
   * @param {Object} options - 搜索选项
   */
  async searchWebsites(query, options = {}) {
    const { page = 1, pageSize = 20, filters = {} } = options
    
    try {
      // 构建搜索查询
      const searchQuery = this.buildWebsiteQuery(query, filters)
      
      // 执行搜索
      const [data, total] = await Promise.all([
        Website.find(searchQuery)
          .sort(this.buildWebsiteSort(query))
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .populate('enterprise', 'name industry')
          .lean(),
        Website.countDocuments(searchQuery)
      ])

      // 计算相关性评分
      const scoredData = data.map(item => ({
        ...item,
        _score: this.calculateWebsiteScore(item, query)
      }))

      return {
        data: scoredData,
        meta: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    } catch (error) {
      logger.error('网站搜索失败:', error)
      throw new Error('网站搜索服务暂时不可用')
    }
  }

  /**
   * 构建企业搜索查询
   */
  buildEnterpriseQuery(query, filters = {}) {
    const queryConditions = {}
    
    // 关键词搜索
    if (query) {
      queryConditions.$or = [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { industry: { $regex: query, $options: 'i' } },
        { 'contact.address': { $regex: query, $options: 'i' } }
      ]
    }

    // 应用过滤器
    if (filters.industry) {
      queryConditions.industry = Array.isArray(filters.industry) 
        ? { $in: filters.industry }
        : filters.industry
    }

    if (filters.status) {
      queryConditions.status = filters.status
    }

    if (filters.location) {
      queryConditions['contact.address'] = { $regex: filters.location, $options: 'i' }
    }

    return queryConditions
  }

  /**
   * 构建网站搜索查询
   */
  buildWebsiteQuery(query, filters = {}) {
    const queryConditions = {}
    
    // 关键词搜索
    if (query) {
      queryConditions.$or = [
        { domain: { $regex: query, $options: 'i' } },
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { keywords: { $in: [new RegExp(query, 'i')] } }
      ]
    }

    // 应用过滤器
    if (filters.type) {
      queryConditions.type = Array.isArray(filters.type) 
        ? { $in: filters.type }
        : filters.type
    }

    if (filters.status) {
      queryConditions.status = filters.status
    }

    if (filters.technology) {
      queryConditions.technologies = Array.isArray(filters.technology)
        ? { $all: filters.technology }
        : filters.technology
    }

    return queryConditions
  }

  /**
   * 构建企业排序规则
   */
  buildEnterpriseSort(query) {
    if (!query) return { createdAt: -1 }
    
    return {
      // 名称匹配优先
      [this.getWeightedField('name', query)]: -1,
      // 其次是行业匹配
      [this.getWeightedField('industry', query)]: -1,
      // 最后是创建时间
      createdAt: -1
    }
  }

  /**
   * 构建网站排序规则
   */
  buildWebsiteSort(query) {
    if (!query) return { createdAt: -1 }
    
    return {
      // 域名匹配优先
      [this.getWeightedField('domain', query)]: -1,
      // 其次是标题匹配
      [this.getWeightedField('title', query)]: -1,
      // 最后是创建时间
      createdAt: -1
    }
  }

  /**
   * 计算企业搜索结果相关性评分
   */
  calculateEnterpriseScore(enterprise, query) {
    if (!query) return 0
    
    let score = 0
    
    // 名称匹配
    if (enterprise.name && enterprise.name.match(new RegExp(query, 'i'))) {
      score += this.weights.enterprise.name
    }
    
    // 描述匹配
    if (enterprise.description && enterprise.description.match(new RegExp(query, 'i'))) {
      score += this.weights.enterprise.description
    }
    
    // 行业匹配
    if (enterprise.industry && enterprise.industry.match(new RegExp(query, 'i'))) {
      score += this.weights.enterprise.industry
    }
    
    // 地址匹配
    if (enterprise.contact?.address && enterprise.contact.address.match(new RegExp(query, 'i'))) {
      score += this.weights.enterprise['contact.address']
    }
    
    return score
  }

  /**
   * 计算网站搜索结果相关性评分
   */
  calculateWebsiteScore(website, query) {
    if (!query) return 0
    
    let score = 0
    
    // 域名匹配
    if (website.domain && website.domain.match(new RegExp(query, 'i'))) {
      score += this.weights.website.domain
    }
    
    // 标题匹配
    if (website.title && website.title.match(new RegExp(query, 'i'))) {
      score += this.weights.website.title
    }
    
    // 描述匹配
    if (website.description && website.description.match(new RegExp(query, 'i'))) {
      score += this.weights.website.description
    }
    
    // 关键词匹配
    if (website.keywords && website.keywords.some(kw => kw.match(new RegExp(query, 'i')))) {
      score += this.weights.website.keywords
    }
    
    return score
  }

  /**
   * 合并不同实体的搜索结果
   */
  combineResults(enterprises = [], websites = [], page, pageSize) {
    // 合并并排序
    const allResults = [...enterprises, ...websites]
      .sort((a, b) => b._score - a._score)
    
    // 分页
    const startIdx = (page - 1) * pageSize
    return allResults.slice(startIdx, startIdx + pageSize)
  }

  /**
   * 获取加权字段的匹配度
   */
  getWeightedField(field, query) {
    return {
      $cond: [
        { $regexMatch: { input: `$${field}`, regex: query, options: 'i' } },
        1,
        0
      ]
    }
  }

  /**
   * 搜索建议
   */
  async getSuggestions(query, limit = 5) {
    if (!query || query.length < 2) return []
    
    try {
      const [enterprises, websites] = await Promise.all([
        Enterprise.find({ name: { $regex: query, $options: 'i' } })
          .limit(limit)
          .select('name _id')
          .lean(),
        Website.find({ $or: [
          { domain: { $regex: query, $options: 'i' } },
          { title: { $regex: query, $options: 'i' } }
        ]})
          .limit(limit)
          .select('domain title _id')
          .lean()
      ])
      
      return [
        ...enterprises.map(e => ({
          type: 'enterprise',
          text: e.name,
          id: e._id
        })),
        ...websites.map(w => ({
          type: 'website',
          text: w.domain,
          id: w._id
        }))
      ].slice(0, limit)
    } catch (error) {
      logger.error('搜索建议获取失败:', error)
      return []
    }
  }
}

module.exports = new SearchService()