// server/config/db.js

const { MongoClient } = require('mongodb')
const { logger } = require('../utils/logger')

class Database {
  constructor() {
    this.client = null
    this.db = null
    this.isConnected = false
    this.connectionAttempts = 0
    this.maxRetries = 3
    this.retryDelay = 5000 // 5 seconds
  }

  /**
   * 初始化数据库连接
   * @param {string} uri - MongoDB连接字符串
   * @param {string} dbName - 数据库名称
   */
  async init(uri, dbName) {
    try {
      this.client = new MongoClient(uri, {
        connectTimeoutMS: 10000,
        socketTimeoutMS: 30000,
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 100,
        minPoolSize: 10,
        retryWrites: true,
        retryReads: true
      })

      await this._connectWithRetry(dbName)
      logger.info(`成功连接到数据库: ${dbName}`)
    } catch (error) {
      logger.error('数据库连接失败:', error)
      throw error
    }
  }

  /**
   * 带重试机制的连接方法
   */
  async _connectWithRetry(dbName) {
    while (this.connectionAttempts < this.maxRetries) {
      try {
        await this.client.connect()
        this.db = this.client.db(dbName)
        this.isConnected = true
        
        // 添加连接事件监听
        this.client.on('serverClosed', () => {
          logger.warn('MongoDB连接关闭')
          this.isConnected = false
        })
        
        this.client.on('serverOpening', () => {
          logger.info('MongoDB连接重新建立')
          this.isConnected = true
        })
        
        return
      } catch (error) {
        this.connectionAttempts++
        if (this.connectionAttempts < this.maxRetries) {
          logger.warn(`连接尝试 ${this.connectionAttempts}/${this.maxRetries}, 将在 ${this.retryDelay/1000}秒后重试...`)
          await new Promise(resolve => setTimeout(resolve, this.retryDelay))
        } else {
          throw error
        }
      }
    }
  }

  /**
   * 获取数据库实例
   */
  getDB() {
    if (!this.isConnected) {
      throw new Error('数据库未连接')
    }
    return this.db
  }

  /**
   * 获取集合
   * @param {string} collectionName - 集合名称
   */
  getCollection(collectionName) {
    return this.getDB().collection(collectionName)
  }

  /**
   * 关闭数据库连接
   */
  async close() {
    try {
      if (this.client) {
        await this.client.close()
        this.isConnected = false
        logger.info('数据库连接已关闭')
      }
    } catch (error) {
      logger.error('关闭数据库连接时出错:', error)
      throw error
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      await this.db.command({ ping: 1 })
      return true
    } catch (error) {
      logger.error('数据库健康检查失败:', error)
      return false
    }
  }
}

// 创建单例实例
const dbInstance = new Database()

// 导出配置
module.exports = {
  /**
   * 初始化数据库连接
   * @param {object} config - 数据库配置
   */
  async initDB(config) {
    const { DB_URI, DB_NAME } = config
    if (!DB_URI || !DB_NAME) {
      throw new Error('缺少必要的数据库配置')
    }

    await dbInstance.init(DB_URI, DB_NAME)
    return dbInstance
  },

  /**
   * 获取数据库实例
   */
  getDB() {
    return dbInstance.getDB()
  },

  /**
   * 获取集合
   * @param {string} collectionName 
   */
  getCollection(collectionName) {
    return dbInstance.getCollection(collectionName)
  },

  /**
   * 关闭数据库连接
   */
  async closeDB() {
    await dbInstance.close()
  },

  /**
   * 数据库健康检查
   */
  async healthCheck() {
    return await dbInstance.healthCheck()
  }
}