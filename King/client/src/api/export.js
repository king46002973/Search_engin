// client/src/api/export.js
import { useExportStore } from '@/stores/export';
import { EventBus } from '@/utils/eventBus';

// 最大分片大小 (1MB)
const MAX_CHUNK_SIZE = 1024 * 1024;
// 支持的导出格式
const SUPPORTED_FORMATS = {
  CSV: { mime: 'text/csv', ext: 'csv' },
  JSON: { mime: 'application/json', ext: 'json' },
  XLSX: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' }
};

/**
 * 企业级导出服务 (纯前端实现)
 */
export const ExportService = {
  /**
   * 导出数据
   * @param {Object} options - 导出选项
   * @param {Array|Object} options.data - 要导出的数据
   * @param {string} options.format - 导出格式 (CSV/JSON/XLSX)
   * @param {string} options.filename - 文件名 (不含扩展名)
   * @param {Object} [options.mapping] - 字段映射 {显示名: 数据字段}
   * @param {boolean} [options.includeHeader=true] - 是否包含表头(CSV)
   */
  async exportData(options) {
    const {
      data,
      format = 'CSV',
      filename = 'export',
      mapping,
      includeHeader = true
    } = options;

    validateExportParams({ data, format, filename });

    const store = useExportStore();
    store.startExport(filename);

    try {
      // 大数据量分片处理
      if (needsChunking(data, format)) {
        await exportInChunks({
          data,
          format,
          filename,
          mapping,
          includeHeader,
          onProgress: (progress) => store.updateProgress(progress)
        });
      } else {
        const blob = formatData({
          data,
          format,
          mapping,
          includeHeader
        });
        triggerDownload(blob, filename, format);
      }

      store.completeExport();
      EventBus.emit('export-success', { filename, format, size: calculateDataSize(data) });
    } catch (error) {
      store.failExport(error.message);
      EventBus.emit('export-error', { error: error.message });
      throw new ExportError(`导出失败: ${error.message}`, 'EXPORT_FAILED');
    }
  },

  /**
   * 生成导出模板
   * @param {Array<string>} fields - 需要的字段
   * @param {string} format - 导出格式
   */
  generateTemplate(fields, format = 'CSV') {
    const templateData = [fields.reduce((acc, field) => {
      acc[field] = '';
      return acc;
    }, {})];

    return this.exportData({
      data: templateData,
      format,
      filename: `template_${new Date().toISOString().slice(0, 10)}`,
      includeHeader: true
    });
  },

  /**
   * 中止当前导出
   */
  abortExport() {
    const store = useExportStore();
    store.cancelExport();
    EventBus.emit('export-aborted');
  }
};

// ==================== 核心导出逻辑 ====================
function formatData({ data, format, mapping, includeHeader }) {
  switch (format.toUpperCase()) {
    case 'CSV':
      return convertToCSV(data, mapping, includeHeader);
    case 'JSON':
      return convertToJSON(data);
    case 'XLSX':
      return convertToXLSX(data, mapping);
    default:
      throw new ExportError(`不支持的导出格式: ${format}`, 'UNSUPPORTED_FORMAT');
  }
}

function convertToCSV(data, mapping, includeHeader) {
  const items = Array.isArray(data) ? data : [data];
  const fields = mapping ? Object.keys(mapping) : Object.keys(items[0]);
  
  let csv = '';
  
  // 添加表头
  if (includeHeader) {
    const headers = mapping 
      ? Object.values(mapping) 
      : fields.map(f => `"${f.replace(/"/g, '""')}"`);
    csv += headers.join(',') + '\r\n';
  }
  
  // 添加数据行
  items.forEach(item => {
    const row = fields.map(field => {
      let value = item[field];
      if (value === null || value === undefined) value = '';
      if (typeof value === 'object') value = JSON.stringify(value);
      
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    
    csv += row.join(',') + '\r\n';
  });
  
  return new Blob([csv], { type: SUPPORTED_FORMATS.CSV.mime });
}

function convertToJSON(data) {
  const jsonString = JSON.stringify(data, null, 2);
  return new Blob([jsonString], { type: SUPPORTED_FORMATS.JSON.mime });
}

function convertToXLSX(data) {
  // 纯前端XLSX生成 (不依赖第三方库的简化实现)
  const items = Array.isArray(data) ? data : [data];
  const xml = generateExcelXML(items);
  return new Blob([xml], { type: SUPPORTED_FORMATS.XLSX.mime });
}

function generateExcelXML(data) {
  // 简化的Excel XML结构 (实际项目建议使用SheetJS等库)
  let rows = '';
  data.forEach(item => {
    let cells = '';
    Object.values(item).forEach(val => {
      cells += `<Cell><Data ss:Type="String">${escapeXML(String(val))}</Data></Cell>`;
    });
    rows += `<Row>${cells}</Row>`;
  });

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Sheet1">
  <Table>${rows}</Table>
 </Worksheet>
</Workbook>`;
}

function escapeXML(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
}

// ==================== 分片处理逻辑 ====================
async function exportInChunks({ data, format, filename, mapping, includeHeader, onProgress }) {
  const items = Array.isArray(data) ? data : [data];
  const totalChunks = Math.ceil(calculateDataSize(items) / MAX_CHUNK_SIZE);
  let exportedCount = 0;
  
  for (let i = 0; i < items.length; i += MAX_CHUNK_SIZE) {
    const chunk = items.slice(i, i + MAX_CHUNK_SIZE);
    const blob = formatData({
      data: chunk,
      format,
      mapping,
      includeHeader: includeHeader && i === 0 // 只在第一片包含表头
    });
    
    triggerDownload(
      blob, 
      `${filename}_part${Math.ceil(i / MAX_CHUNK_SIZE) + 1}`,
      format,
      i === 0 // 只在第一次显示保存对话框
    );
    
    exportedCount += chunk.length;
    onProgress(Math.round((exportedCount / items.length) * 100));
    
    // 模拟延迟以避免浏览器阻塞
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// ==================== 工具函数 ====================
function validateExportParams({ data, format, filename }) {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    throw new ExportError('导出数据不能为空', 'EMPTY_DATA');
  }
  
  if (!SUPPORTED_FORMATS[format.toUpperCase()]) {
    throw new ExportError(`不支持的导出格式: ${format}`, 'UNSUPPORTED_FORMAT');
  }
  
  if (!filename || !/^[\w\-]+$/.test(filename)) {
    throw new ExportError('文件名包含非法字符', 'INVALID_FILENAME');
  }
}

function needsChunking(data, format) {
  if (format.toUpperCase() === 'XLSX') return false; // XLSX不分片
  return calculateDataSize(data) > MAX_CHUNK_SIZE;
}

function calculateDataSize(data) {
  const items = Array.isArray(data) ? data : [data];
  return JSON.stringify(items).length;
}

function triggerDownload(blob, filename, format, showDialog = true) {
  const url = URL.createObjectURL(blob);
  const ext = SUPPORTED_FORMATS[format.toUpperCase()].ext;
  const link = document.createElement('a');
  
  link.href = url;
  link.download = `${filename}.${ext}`;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  
  if (showDialog) {
    link.click();
  } else {
    // 静默下载后续分片
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    setTimeout(() => iframe.remove(), 1000);
  }
  
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 100);
}

// ==================== 错误处理 ====================
class ExportError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ExportError';
    this.code = code || 'EXPORT_ERROR';
  }
}

// 导出错误类以便外部捕获
export { ExportError };