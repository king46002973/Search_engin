// server/services/crawler.js
const axios = require('axios')
const cheerio = require('cheerio')
const { URL } = require('url')
const { logger } = require('../utils/logger')
const { Website } = require('../models')
const { rateLimit } = require('../middlewares/rateLimit')

class CrawlerService {
  constructor() {
    // 爬虫配置
    this.config = {
      timeout: 10000, // 10秒超时
      maxRedirects: 3, // 最大重定向次数
      rateLimit: 1000, // 每秒最多请求数
      userAgent: 'Mozilla/5.0 (compatible; EnterpriseCrawler/1.0; +https://yourdomain.com/bot)'
    }

    // 初始化限流器
    this.limiter = rateLimit({
      windowMs: 1000,
      max: this.config.rateLimit
    })
  }

  /**
   * 爬取单个网站
   * @param {string} url - 要爬取的URL
   * @param {Object} options - 爬取选项
   */
  async crawlWebsite(url, options = {}) {
    try {
      // 验证URL格式
      const parsedUrl = this.validateUrl(url)
      if (!parsedUrl) {
        throw new Error('无效的URL格式')
      }

      // 应用限流
      await this.applyRateLimit()

      // 获取网站数据
      const response = await axios.get(parsedUrl.href, {
        timeout: this.config.timeout,
        maxRedirects: this.config.maxRedirects,
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        },
        ...options
      })

      // 解析HTML内容
      const $ = cheerio.load(response.data)
      const metadata = this.extractMetadata($, parsedUrl)

      return {
        url: parsedUrl.href,
        status: response.status,
        data: {
          metadata,
          technologies: this.detectTechnologies(response),
          links: this.extractLinks($, parsedUrl)
        }
      }
    } catch (error) {
      logger.error(`爬取失败: ${url}`, error)
      throw new Error(`爬取失败: ${error.message}`)
    }
  }

  /**
   * 批量爬取网站
   * @param {Array} urls - 要爬取的URL数组
   * @param {Object} options - 爬取选项
   */
  async batchCrawlWebsites(urls, options = {}) {
    const results = []
    const errors = []

    for (const url of urls) {
      try {
        const result = await this.crawlWebsite(url, options)
        results.push(result)
      } catch (error) {
        errors.push({
          url,
          error: error.message
        })
      }
    }

    return {
      success: results,
      failed: errors
    }
  }

  /**
   * 更新网站爬取数据
   * @param {string} websiteId - 网站ID
   */
  async updateWebsiteData(websiteId) {
    try {
      const website = await Website.findById(websiteId)
      if (!website) {
        throw new Error('网站记录不存在')
      }

      const { data } = await this.crawlWebsite(website.domain)
      
      // 更新网站数据
      website.technologies = data.technologies
      website.metadata = data.metadata
      website.lastCrawledAt = new Date()
      website.lastCrawlStatus = 'success'

      await website.save()

      return {
        website: website.toJSON(),
        crawlData: data
      }
    } catch (error) {
      logger.error(`更新网站数据失败: ${websiteId}`, error)
      
      // 更新爬取状态为失败
      await Website.findByIdAndUpdate(websiteId, {
        lastCrawledAt: new Date(),
        lastCrawlStatus: 'failed',
        crawlError: error.message
      })

      throw error
    }
  }

  /**
   * 验证并规范化URL
   */
  validateUrl(url) {
    try {
      const parsed = new URL(url)
      
      // 确保使用HTTPS
      if (parsed.protocol === 'http:') {
        parsed.protocol = 'https:'
      }

      // 规范化路径
      parsed.pathname = parsed.pathname.replace(/\/+/g, '/')

      return parsed
    } catch (error) {
      return null
    }
  }

  /**
   * 提取页面元数据
   */
  extractMetadata($, parsedUrl) {
    return {
      title: $('title').text().trim(),
      description: $('meta[name="description"]').attr('content') || '',
      keywords: $('meta[name="keywords"]').attr('content') || '',
      canonical: $('link[rel="canonical"]').attr('href') || parsedUrl.href,
      viewport: $('meta[name="viewport"]').attr('content') || '',
      ogTitle: $('meta[property="og:title"]').attr('content') || '',
      ogDescription: $('meta[property="og:description"]').attr('content') || '',
      ogImage: $('meta[property="og:image"]').attr('content') || ''
    }
  }

  /**
   * 检测网站技术栈
   */
  detectTechnologies(response) {
    const technologies = []
    const headers = response.headers

    // 检测服务器类型
    if (headers['server']) {
      technologies.push(headers['server'])
    }

    // 检测X-Powered-By
    if (headers['x-powered-by']) {
      technologies.push(headers['x-powered-by'])
    }

    // 从HTML中检测技术栈
    const $ = cheerio.load(response.data)
    
    // 检测常见框架
    const frameworkSignatures = {
      'React': /react|react-dom/,
      'Vue': /vue|vue-router/,
      'Angular': /angular/,
      'jQuery': /jquery/
    }

    $('script').each((i, el) => {
      const src = $(el).attr('src') || ''
      Object.entries(frameworkSignatures).forEach(([name, regex]) => {
        if (regex.test(src)) {
          technologies.push(name)
        }
      })
    })

    return [...new Set(technologies)] // 去重
  }

  /**
   * 提取页面链接
   */
  extractLinks($, parsedUrl) {
    const links = []
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`

    $('a').each((i, el) => {
      const href = $(el).attr('href')
      if (!href) return

      try {
        const url = new URL(href, baseUrl)
        if (url.hostname === parsedUrl.hostname) {
          links.push({
            url: url.href,
            text: $(el).text().trim(),
            external: false
          })
        } else {
          links.push({
            url: url.href,
            text: $(el).text().trim(),
            external: true
          })
        }
      } catch (error) {
        // 忽略无效URL
      }
    })

    return links
  }

  /**
   * 应用请求限流
   */
  async applyRateLimit() {
    return new Promise((resolve) => {
      this.limiter({}, {}, () => resolve())
    })
  }

  /**
   * 深度爬取网站结构
   */
  async deepCrawlWebsite(baseUrl, maxDepth = 2) {
    const visited = new Set()
    const results = []
    const queue = [{ url: baseUrl, depth: 0 }]

    while (queue.length > 0) {
      const { url, depth } = queue.shift()

      if (depth > maxDepth || visited.has(url)) continue

      try {
        const result = await this.crawlWebsite(url)
        visited.add(url)
        results.push(result)

        // 添加内部链接到队列
        result.data.links
          .filter(link => !link.external)
          .forEach(link => {
            if (!visited.has(link.url)) {
              queue.push({
                url: link.url,
                depth: depth + 1
              })
            }
          })
      } catch (error) {
        logger.error(`深度爬取失败: ${url}`, error)
      }
    }

    return results
  }
}

module.exports = new CrawlerService()