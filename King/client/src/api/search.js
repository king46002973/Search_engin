// client/src/api/search.js
import axios from 'axios';
import { useSearchStore } from '@/stores/search';
import { EventBus } from '@/utils/eventBus';
import { AuthError, RateLimitError } from './auth';

// 配置带取消令牌的 axios 实例
const searchApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  paramsSerializer: {
    indexes: false, // 不生成数组索引
    encode: (value) => encodeURIComponent(value).replace(/%20/g, '+')
  }
});

// 请求队列和取消令牌管理
const pendingRequests = new Map();

// 请求拦截器
searchApi.interceptors.request.use(config => {
  const requestKey = `${config.method}-${config.url}-${JSON.stringify(config.params)}`;
  
  // 取消重复请求
  if (pendingRequests.has(requestKey)) {
    pendingRequests.get(requestKey).cancel('Request canceled due to duplication');
  }
  
  const cancelToken = new axios.CancelToken(cancel => {
    pendingRequests.set(requestKey, { cancel });
  });
  
  config.cancelToken = cancelToken;
  config.metadata = { requestKey };
  
  // 添加性能标记
  config.headers['X-Perf-Mark'] = performance.now().toFixed(2);
  
  return config;
});

// 响应拦截器
searchApi.interceptors.response.use(
  response => {
    const { config, data } = response;
    const { requestKey } = config.metadata;
    
    // 清理已完成请求
    pendingRequests.delete(requestKey);
    
    // 缓存控制
    if (data.cacheKey) {
      cacheSearchResult(data.cacheKey, data);
    }
    
    // 性能监控
    const perfMark = parseFloat(config.headers['X-Perf-Mark']);
    const duration = performance.now() - perfMark;
    logSearchPerf(config.params, duration);
    
    return data;
  },
  error => {
    if (axios.isCancel(error)) {
      return Promise.reject(new SearchError('请求已取消', 'REQUEST_CANCELED'));
    }
    
    const { response, config } = error;
    if (config) {
      const { requestKey } = config.metadata;
      pendingRequests.delete(requestKey);
    }
    
    return handleSearchError(response);
  }
);

/**
 * 企业级搜索服务
 */
export const SearchService = {
  /**
   * 高级搜索
   * @param {Object} params - 搜索参数
   * @param {string} params.query - 搜索关键词
   * @param {string} [params.sort] - 排序方式
   * @param {number} [params.page] - 页码
   * @param {number} [params.perPage] - 每页数量
   * @param {Object} [params.filters] - 过滤条件
   * @param {boolean} [params.useCache] - 是否使用缓存
   */
  async advancedSearch(params) {
    try {
      const cacheKey = generateCacheKey(params);
      
      // 缓存命中检查
      if (params.useCache && getCachedResult(cacheKey)) {
        return getCachedResult(cacheKey);
      }
      
      const { data } = await searchApi.get('/search/advanced', {
        params: {
          ...params,
          // 添加搜索上下文
          context: getSearchContext(),
          // 添加设备信息
          device_type: getDeviceType()
        },
        // 超时重试配置
        retry: 2,
        retryDelay: 1000
      });
      
      // 触发搜索分析事件
      EventBus.emit('search-analytics', {
        query: params.query,
        result_count: data.total,
        filters: params.filters
      });
      
      return data;
    } catch (error) {
      // 降级到本地缓存或备用数据
      if (error instanceof RateLimitError) {
        return getFallbackData(params);
      }
      throw error;
    }
  },
  
  /**
   * 即时搜索建议
   * @param {string} query - 搜索词
   * @param {number} [limit=5] - 建议数量
   */
  async getSuggestions(query, limit = 5) {
    if (!query || query.length < 2) {
      return [];
    }
    
    const { data } = await searchApi.get('/search/suggestions', {
      params: {
        q: query,
        limit,
        lang: navigator.language
      },
      // 防抖处理
      debounce: 300
    });
    
    return data.suggestions;
  },
  
  /**
   * 获取搜索过滤器选项
   */
  async getSearchFilters() {
    const { data } = await searchApi.get('/search/filters', {
      // 长期缓存
      cacheTTL: 3600
    });
    return data;
  },
  
  /**
   * 获取搜索结果的详细信息
   * @param {string} id - 结果ID
   * @param {string} [type] - 结果类型
   */
  async getSearchDetail(id, type) {
    const { data } = await searchApi.get(`/search/detail/${id}`, {
      params: { type },
      // 优先从缓存读取
      staleWhileRevalidate: true
    });
    return data;
  },
  
  /**
   * 批量获取搜索结果
   * @param {Array<string>} ids - 结果ID数组
   */
  async batchGetResults(ids) {
    const { data } = await searchApi.post('/search/batch', { ids });
    return data.results;
  },
  
  /**
   * 取消所有进行中的搜索请求
   */
  cancelAllRequests() {
    pendingRequests.forEach(({ cancel }, key) => {
      cancel('Manual cancel');
      pendingRequests.delete(key);
    });
  }
};

// ==================== 工具函数 ====================
function generateCacheKey(params) {
  const { query, sort, page, perPage, filters } = params;
  return `${query}-${sort}-${page}-${perPage}-${JSON.stringify(filters)}`;
}

function getCachedResult(cacheKey) {
  const cache = JSON.parse(sessionStorage.getItem('searchCache') || '{}');
  return cache[cacheKey];
}

function cacheSearchResult(cacheKey, data) {
  const cache = JSON.parse(sessionStorage.getItem('searchCache') || '{}');
  cache[cacheKey] = data;
  sessionStorage.setItem('searchCache', JSON.stringify(cache));
}

function getSearchContext() {
  const store = useSearchStore();
  return {
    recent_queries: store.recentQueries,
    preferred_categories: store.preferredCategories
  };
}

function getDeviceType() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  return isMobile ? 'mobile' : 'desktop';
}

function logSearchPerf(params, duration) {
  if (import.meta.env.MODE === 'production') {
    const perfData = {
      timestamp: new Date().toISOString(),
      query: params.query,
      duration: duration.toFixed(2),
      page: params.page || 1,
      filters: params.filters || {}
    };
    console.log('[SEARCH_PERF]', perfData);
    // 实际项目中发送到性能监控系统
    // perfTracker.track(perfData);
  }
}

function getFallbackData(params) {
  // 实际项目中可以从 IndexedDB 或 Service Worker 获取备用数据
  console.warn('Using fallback data due to rate limiting');
  return {
    results: [],
    total: 0,
    isFallback: true,
    params
  };
}

// ==================== 错误处理 ====================
function handleSearchError(response) {
  if (!response) {
    return Promise.reject(new SearchError('网络错误', 'NETWORK_ERROR'));
  }

  const errorMap = {
    400: () => new SearchError('无效的搜索请求', 'INVALID_REQUEST'),
    401: () => new AuthError('请重新登录', 'SESSION_EXPIRED'),
    403: () => new SearchError('无搜索权限', 'FORBIDDEN'),
    429: () => new RateLimitError('请求过于频繁', response.headers['retry-after']),
    500: () => new SearchError('搜索服务不可用', 'SERVICE_UNAVAILABLE')
  };

  const handler = errorMap[response.status] || 
    (() => new SearchError(response.data?.message || '未知错误', 'UNKNOWN_ERROR'));
  
  return Promise.reject(handler());
}

class SearchError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SearchError';
    this.code = code || 'SEARCH_ERROR';
  }
}

// 导出错误类以便外部捕获特定错误
export { SearchError };