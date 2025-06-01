// server/utils/logger.js
const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const { createLogStream, ensureLogDir } = require('./fileUtils')

const appendFile = promisify(fs.appendFile)
const mkdir = promisify(fs.mkdir)

class Logger {
  constructor() {
    this.config = {
      logDir: './logs',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 30, // 保留30个日志文件
      levels: {
        error: 0,
        warn: 1,
        info: 2,
        debug: 3
      },
      colors: {
        error: '\x1b[31m', // 红色
        warn: '\x1b[33m',  // 黄色
        info: '\x1b[32m', // 绿色
        debug: '\x1b[36m', // 青色
        reset: '\x1b[0m'   // 重置颜色
      }
    }

    // 初始化日志目录
    ensureLogDir(this.config.logDir)

    // 当前日志流
    this.currentStream = null
    this.currentDate = this.getCurrentDate()
    this.currentFileSize = 0

    // 初始化日志文件
    this.initLogFile()
  }

  /**
   * 初始化日志文件
   */
  async initLogFile() {
    const logFile = path.join(this.config.logDir, `${this.currentDate}.log`)
    this.currentStream = createLogStream(logFile)
    this.currentFileSize = fs.existsSync(logFile) ? fs.statSync(logFile).size : 0
  }

  /**
   * 检查并轮转日志文件
   */
  async checkRotate() {
    const currentDate = this.getCurrentDate()
    
    // 日期变化或文件过大时轮转
    if (currentDate !== this.currentDate || this.currentFileSize >= this.config.maxFileSize) {
      await this.rotateLogs()
      this.currentDate = currentDate
      await this.initLogFile()
    }
  }

  /**
   * 轮转日志文件
   */
  async rotateLogs() {
    if (this.currentStream) {
      this.currentStream.end()
    }

    // 清理旧日志文件
    const files = fs.readdirSync(this.config.logDir)
      .filter(file => file.endsWith('.log'))
      .sort()

    while (files.length > this.config.maxFiles) {
      const fileToDelete = files.shift()
      fs.unlinkSync(path.join(this.config.logDir, fileToDelete))
    }
  }

  /**
   * 记录日志
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {Object} [meta] - 元数据
   */
  async log(level, message, meta = {}) {
    try {
      await this.checkRotate()

      const timestamp = new Date().toISOString()
      const logEntry = this.formatLogEntry(level, timestamp, message, meta)
      
      // 写入文件
      this.currentStream.write(logEntry + '\n')
      this.currentFileSize += Buffer.byteLength(logEntry + '\n')

      // 控制台输出
      this.consoleLog(level, logEntry)
    } catch (error) {
      console.error('日志记录失败:', error)
    }
  }

  /**
   * 格式化日志条目
   */
  formatLogEntry(level, timestamp, message, meta) {
    const metaStr = Object.keys(meta).length > 0 
      ? ' ' + JSON.stringify(meta)
      : ''
    
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`
  }

  /**
   * 控制台输出
   */
  consoleLog(level, logEntry) {
    const color = this.config.colors[level] || ''
    console.log(`${color}${logEntry}${this.config.colors.reset}`)
  }

  /**
   * 获取当前日期字符串
   */
  getCurrentDate() {
    const now = new Date()
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
  }

  /**
   * 错误日志
   */
  error(message, meta) {
    this.log('error', message, meta)
  }

  /**
   * 警告日志
   */
  warn(message, meta) {
    this.log('warn', message, meta)
  }

  /**
   * 信息日志
   */
  info(message, meta) {
    this.log('info', message, meta)
  }

  /**
   * 调试日志
   */
  debug(message, meta) {
    if (process.env.NODE_ENV !== 'production') {
      this.log('debug', message, meta)
    }
  }

  /**
   * HTTP请求日志中间件
   */
  httpLogger() {
    return (req, res, next) => {
      const start = Date.now()
      const { method, originalUrl, ip } = req

      res.on('finish', () => {
        const { statusCode } = res
        const responseTime = Date.now() - start
        const message = `${method} ${originalUrl} ${statusCode} ${responseTime}ms - ${ip}`

        if (statusCode >= 500) {
          this.error(message, {
            headers: req.headers,
            body: req.body
          })
        } else if (statusCode >= 400) {
          this.warn(message)
        } else {
          this.info(message)
        }
      })

      next()
    }
  }

  /**
   * 数据库操作日志
   */
  dbLog(operation, collection, query, duration, error = null) {
    const message = `DB ${operation} ${collection} - ${duration}ms`
    const meta = { query }

    if (error) {
      this.error(message, { ...meta, error: error.message })
    } else {
      this.debug(message, meta)
    }
  }
}

// 文件工具函数
function ensureLogDir(logDir) {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }
}

function createLogStream(logFile) {
  return fs.createWriteStream(logFile, { flags: 'a' })
}

module.exports = new Logger()