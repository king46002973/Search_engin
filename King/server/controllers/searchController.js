// server/controllers/searchController.js
const { logger } = require('../utils/logger')
const { Enterprise, Website } = require('../models')
const { validateSearchParams } = require('../utils/validator')
const { buildSearchQuery } = require('../services/search')

class SearchController {
  /**
   * 企业搜索
   */
  async searchEnterprises(req, res) {
    try {
      // 验证查询参数
      const { error, value } = validateSearchParams(req.query)
      if (error) {
        return res.status(400).json({ error: error.details[0].message })
      }

      // 构建查询条件
      const query = buildSearchQuery(value)
      
      // 执行搜索
      const results = await Enterprise.find(query)
        .select('name industry location website')
        .limit(100) // 限制返回数量
        .lean()

      // 记录搜索日志
      logger.info(`搜索企业: ${JSON.stringify(query)}`, {
        userId: req.user?.userId,
        ip: req.ip
      })

      res.json({
        count: results.length,
        results
      })

    } catch (error) {
      logger.error('企业搜索失败:', error)
      res.status(500).json({ error: '搜索失败' })
    }
  }

  /**
   * 高级搜索
   */
  async advancedSearch(req, res) {
    try {
      const { keywords, industry, location, page = 1, pageSize = 20 } = req.body

      // 构建聚合查询
      const pipeline = [
        { $match: buildAdvancedQuery({ keywords, industry, location }) },
        { $skip: (page - 1) * pageSize },
        { $limit: pageSize },
        { 
          $project: {
            _id: 1,
            name: 1,
            score: { $meta: "textScore" } // 全文搜索评分
          }
        },
        { $sort: { score: -1 } }
      ]

      const [results, total] = await Promise.all([
        Enterprise.aggregate(pipeline),
        Enterprise.countDocuments(buildAdvancedQuery({ keywords, industry, location }))
      ])

      res.json({
        total,
        page,
        pageSize,
        results
      })

    } catch (error) {
      logger.error('高级搜索失败:', error)
      res.status(500).json({ error: '高级搜索失败' })
    }
  }

  /**
   * 网站搜索
   */
  async searchWebsites(req, res) {
    try {
      const { domain, ip, keyword } = req.query
      
      const query = {}
      if (domain) query.domain = { $regex: domain, $options: 'i' }
      if (ip) query.ip = ip
      if (keyword) {
        query.$text = { $search: keyword }
      }

      const results = await Website.find(query)
        .select('domain ip title description')
        .limit(50)
        .lean()

      res.json({
        count: results.length,
        results
      })

    } catch (error) {
      logger.error('网站搜索失败:', error)
      res.status(500).json({ error: '网站搜索失败' })
    }
  }

  /**
   * 搜索建议
   */
  async suggest(req, res) {
    try {
      const { q } = req.query
      if (!q || q.length < 2) {
        return res.json([])
      }

      const suggestions = await Enterprise.aggregate([
        {
          $search: {
            index: 'autocomplete',
            autocomplete: {
              query: q,
              path: 'name',
              tokenOrder: 'any'
            }
          }
        },
        { $limit: 5 },
        { $project: { name: 1 } }
      ])

      res.json(suggestions.map(item => item.name))

    } catch (error) {
      logger.error('搜索建议失败:', error)
      res.status(500).json({ error: '获取搜索建议失败' })
    }
  }

  /**
   * 搜索历史记录
   */
  async getSearchHistory(req, res) {
    try {
      // 实际项目中应从数据库获取用户搜索历史
      const history = [
        { query: '科技公司', date: new Date() },
        { query: '北京 互联网', date: new Date(Date.now() - 86400000) }
      ]
      
      res.json(history)

    } catch (error) {
      logger.error('获取搜索历史失败:', error)
      res.status(500).json({ error: '获取搜索历史失败' })
    }
  }
}

module.exports = new SearchController()