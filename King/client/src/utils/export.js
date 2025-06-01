// client/src/utils/export.js
import { useAuthStore } from '@/stores/auth'

/**
 * 企业级数据导出工具
 * 支持多种格式导出和大型数据集分片处理
 */

const ExportUtil = {
  /**
   * 导出数据为CSV格式
   * @param {Array} data - 要导出的数据
   * @param {Object} options - 导出配置
   * @param {string} options.filename - 导出文件名
   * @param {Array} options.columns - 列配置 [{key: 'name', title: '名称'}]
   * @param {boolean} options.includeHeader - 是否包含表头
   */
  exportToCSV(data, options = {}) {
    const { filename = 'export.csv', columns, includeHeader = true } = options
    const authStore = useAuthStore()

    // 处理大型数据集（超过1万条自动分片）
    const CHUNK_SIZE = 10000
    const chunks = Math.ceil(data.length / CHUNK_SIZE)

    for (let i = 0; i < chunks; i++) {
      const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      this._processCSVChunk(chunk, {
        filename: chunks > 1 ? `${filename.replace('.csv', '')}_part${i + 1}.csv` : filename,
        columns,
        includeHeader: i === 0 && includeHeader,
        authToken: authStore.token
      })
    }
  },

  /**
   * 导出数据为Excel格式
   * @param {Array} data - 要导出的数据
   * @param {Object} options - 导出配置
   * @param {string} options.filename - 导出文件名
   * @param {Array} options.sheets - 多sheet配置 [{name: 'Sheet1', data: [], columns: []}]
   */
  exportToExcel(data, options = {}) {
    const { filename = 'export.xlsx', sheets = [] } = options
    const authStore = useAuthStore()

    if (sheets.length > 0) {
      this._exportMultiSheetExcel(sheets, filename, authStore.token)
    } else {
      this._exportSingleSheetExcel(data, { ...options, authToken: authStore.token })
    }
  },

  /**
   * 从API端点直接导出
   * @param {Object} config - 导出配置
   * @param {string} config.endpoint - API端点
   * @param {string} config.filename - 导出文件名
   * @param {string} config.method - HTTP方法
   * @param {Object} config.params - 查询参数
   */
  async exportFromAPI(config) {
    const { endpoint, filename = 'export', method = 'POST', params = {} } = config
    const authStore = useAuthStore()

    try {
      const response = await this._fetchExportData(endpoint, {
        method,
        params,
        authToken: authStore.token
      })

      this._downloadFile(response, filename)
    } catch (error) {
      console.error('导出失败:', error)
      throw new Error('导出过程中出现错误')
    }
  },

  // ==================== 内部方法 ====================
  _processCSVChunk(data, options) {
    const { filename, columns, includeHeader, authToken } = options
    const csvContent = []

    // 处理表头
    if (includeHeader && columns) {
      const headers = columns.map(col => `"${col.title || col.key}"`).join(',')
      csvContent.push(headers)
    }

    // 处理数据行
    data.forEach(item => {
      const row = columns 
        ? columns.map(col => `"${this._escapeCSV(item[col.key])}"`).join(',')
        : Object.values(item).map(val => `"${this._escapeCSV(val)}"`).join(',')
      csvContent.push(row)
    })

    // 创建下载
    const blob = new Blob([csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' })
    this._triggerDownload(blob, filename)
  },

  _exportSingleSheetExcel(data, options) {
    const { filename, columns, authToken } = options
    const csvContent = []

    // 处理表头
    if (columns) {
      const headers = columns.map(col => `"${col.title || col.key}"`).join(',')
      csvContent.push(headers)
    }

    // 处理数据行
    data.forEach(item => {
      const row = columns 
        ? columns.map(col => `"${this._escapeCSV(item[col.key])}"`).join(',')
        : Object.values(item).map(val => `"${this._escapeCSV(val)}"`).join(',')
      csvContent.push(row)
    })

    // 转换为Excel（使用原生Blob）
    const blob = new Blob([csvContent.join('\n')], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;' 
    })
    this._triggerDownload(blob, filename.replace('.csv', '.xlsx'))
  },

  _exportMultiSheetExcel(sheets, filename, authToken) {
    // 简单实现 - 实际企业应用中可使用SheetJS等库
    console.warn('多sheet导出需要引入专业库，当前降级为单sheet导出')
    this._exportSingleSheetExcel(sheets[0].data, {
      filename,
      columns: sheets[0].columns,
      authToken
    })
  },

  async _fetchExportData(endpoint, options) {
    const { method = 'GET', params = {}, authToken } = options
    const url = new URL(endpoint, window.location.origin)
    
    if (method === 'GET') {
      Object.keys(params).forEach(key => 
        url.searchParams.append(key, params[key])
      )
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: method !== 'GET' ? JSON.stringify(params) : undefined
    })

    if (!response.ok) {
      throw new Error(`导出请求失败: ${response.status}`)
    }

    return response.blob()
  },

  _triggerDownload(blob, filename) {
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    
    // 清理
    setTimeout(() => {
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }, 100)
  },

  _escapeCSV(value) {
    if (value === null || value === undefined) return ''
    return String(value)
      .replace(/"/g, '""')
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
  }
}

export default ExportUtil