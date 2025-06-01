// server/services/search.js
const { logger } = require('../utils/logger')
const { Enterprise, Website } = require('../models')

class SearchService {
  /**
   * 企业搜索
   * @param {Object} query - 搜索查询参数
   * @param {Object} options - 分页和排序选项
   */
  async searchEnterprises(query, options = {}) {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'relevance',
      sortOrder = 'desc'
    } = options

    try {
      // 构建搜索查询
      const searchQuery = this.buildEnterpriseQuery(query)
      
      // 构建排序规则
      const sort = this.buildSortCriteria(sortBy, sortOrder)

      const [results, total] = await Promise.all([
        Enterprise.find(searchQuery)
          .sort(sort)
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean(),
        Enterprise.countDocuments(searchQuery)
      ])

      return {
        data: results,
        meta: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    } catch (error) {
      logger.error('企业搜索失败:', error)
      throw new Error('搜索服务暂时不可用')
    }
  }

  /**
   * 网站搜索
   * @param {Object} query - 搜索查询参数
   * @param {Object} options - 分页和排序选项
   */
  async searchWebsites(query, options = {}) {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'relevance',
      sortOrder = 'desc'
    } = options

    try {
      const searchQuery = this.buildWebsiteQuery(query)
      const sort = this.buildSortCriteria(sortBy, sortOrder)

      const [results, total] = await Promise.all([
        Website.find(searchQuery)
          .sort(sort)
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .populate('enterprise', 'name industry')
          .lean(),
        Website.countDocuments(searchQuery)
      ])

      return {
        data: results,
        meta: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    } catch (error) {
      logger.error('网站搜索失败:', error)
      throw new Error('搜索服务暂时不可用')
    }
  }

  /**
   * 高级搜索（企业+网站联合搜索）
   */
  async advancedSearch(query, options = {}) {
    const {
      page = 1,
      pageSize = 20,
      target = 'all' // 'all', 'enterprises', 'websites'
    } = options

    try {
      const [enterprises, websites] = await Promise.all([
        target === 'all' || target === 'enterprises' 
          ? this.searchEnterprises(query, { ...options, pageSize: Math.ceil(pageSize / 2) })
          : { data: [], meta: { total: 0 } },
        target === 'all' || target === 'websites'
          ? this.searchWebsites(query, { ...options, pageSize: Math.ceil(pageSize / 2) })
          : { data: [], meta: { total: 0 } }
      ])

      // 合并结果并重新分页
      const combinedData = [...enterprises.data, ...websites.data]
      const totalResults = enterprises.meta.total + websites.meta.total

      // 简单分页实现
      const startIdx = (page - 1) * pageSize
      const paginatedData = combinedData.slice(startIdx, startIdx + pageSize)

      return {
        data: paginatedData,
        meta: {
          total: totalResults,
          page,
          pageSize,
          totalPages: Math.ceil(totalResults / pageSize),
          byType: {
            enterprises: enterprises.meta.total,
            websites: websites.meta.total
          }
        }
      }
    } catch (error) {
      logger.error('高级搜索失败:', error)
      throw new Error('高级搜索服务暂时不可用')
    }
  }

  /**
   * 搜索建议（自动完成）
   */
  async getSearchSuggestions(query, limit = 5) {
    try {
      if (!query || query.length < 2) {
        return []
      }

      const enterpriseSuggestions = await Enterprise.aggregate([
        {
          $search: {
            index: 'autocomplete',
            autocomplete: {
              query: query,
              path: 'name',
              tokenOrder: 'any'
            }
          }
        },
        { $limit: limit },
        { $project: { name: 1, _id: 1 } }
      ])

      const websiteSuggestions = await Website.aggregate([
        {
          $search: {
            index: 'autocomplete',
            autocomplete: {
              query: query,
              path: 'domain',
              tokenOrder: 'any'
            }
          }
        },
        { $limit: limit },
        { $project: { domain: 1, _id: 1 } }
      ])

      return [
        ...enterpriseSuggestions.map(item => ({
          type: 'enterprise',
          text: item.name,
          id: item._id
        })),
        ...websiteSuggestions.map(item => ({
          type: 'website',
          text: item.domain,
          id: item._id
        }))
      ].slice(0, limit)
    } catch (error) {
      logger.error('搜索建议获取失败:', error)
      return []
    }
  }

  /**
   * 构建企业搜索查询
   */
  buildEnterpriseQuery(params = {}) {
    const query = {}

    // 关键词搜索
    if (params.keyword) {
      query.$or = [
        { name: { $regex: params.keyword, $options: 'i' } },
        { description: { $regex: params.keyword, $options: 'i' } },
        { 'contact.address': { $regex: params.keyword, $options: 'i' } }
      ]
    }

    // 行业筛选
    if (params.industry) {
      query.industry = Array.isArray(params.industry) 
        ? { $in: params.industry }
        : params.industry
    }

    // 地区筛选
    if (params.location) {
      query['contact.address'] = { $regex: params.location, $options: 'i' }
    }

    // 状态筛选
    query.status = params.status || 'approved'

    // 成立年份范围
    if (params.foundedYearFrom || params.foundedYearTo) {
      query.foundedYear = {}
      if (params.foundedYearFrom) {
        query.foundedYear.$gte = parseInt(params.foundedYearFrom)
      }
      if (params.foundedYearTo) {
        query.foundedYear.$lte = parseInt(params.foundedYearTo)
      }
    }

    return query
  }

  /**
   * 构建网站搜索查询
   */
  buildWebsiteQuery(params = {}) {
    const query = {}

    // 域名或关键词搜索
    if (params.keyword) {
      query.$or = [
        { domain: { $regex: params.keyword, $options: 'i' } },
        { title: { $regex: params.keyword, $options: 'i' } },
        { description: { $regex: params.keyword, $options: 'i' } },
        { keywords: { $in: [new RegExp(params.keyword, 'i')] } }
      ]
    }

    // IP搜索
    if (params.ip) {
      query.ip = params.ip
    }

    // 网站类型筛选
    if (params.type) {
      query.type = Array.isArray(params.type) 
        ? { $in: params.type }
        : params.type
    }

    // 技术栈筛选
    if (params.technology) {
      query.technologies = Array.isArray(params.technology)
        ? { $all: params.technology }
        : params.technology
    }

    // 关联企业筛选
    if (params.enterprise) {
      query.enterprise = params.enterprise
    }

    // 状态筛选
    query.status = params.status || 'active'

    return query
  }

  /**
   * 构建排序规则
   */
  buildSortCriteria(sortBy, sortOrder = 'desc') {
    const order = sortOrder === 'asc' ? 1 : -1

    const sortOptions = {
      relevance: { score: { $meta: 'textScore' } },
      name: { name: order },
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      popular: { viewCount: -1 }
    }

    return sortOptions[sortBy] || sortOptions.relevance
  }

  /**
   * 记录搜索历史
   */
  async recordSearchHistory(userId, searchParams) {
    try {
      // 实际项目中可将搜索历史存入数据库
      logger.info(`搜索记录 - 用户: ${userId}, 参数: ${JSON.stringify(searchParams)}`)
      return true
    } catch (error) {
      logger.error('搜索历史记录失败:', error)
      return false
    }
  }
}

module.exports = new SearchService()