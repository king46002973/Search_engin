// client/src/composables/useSearch.js
import { ref, computed, watch, onUnmounted } from 'vue'
import { useSearchStore } from '@/stores/search'
import { useRouter } from 'vue-router'

/**
 * 企业级搜索逻辑封装
 * @param {Object} options - 配置选项
 * @param {number} [options.debounce=300] - 防抖时间(ms)
 * @param {number} [options.minLength=2] - 最小搜索长度
 * @param {boolean} [options.autoSearch=true] - 是否自动搜索
 * @param {boolean} [options.keepAlive=false] - 是否保持搜索结果
 * @returns {Object} 搜索相关属性和方法
 */
export function useSearch(options = {}) {
  const {
    debounce = 300,
    minLength = 2,
    autoSearch = true,
    keepAlive = false
  } = options

  const searchStore = useSearchStore()
  const router = useRouter()

  // 响应式状态
  const query = ref('')
  const results = ref([])
  const isLoading = ref(false)
  const error = ref(null)
  const activeResultIndex = ref(-1)
  const lastRequestId = ref(null)

  // 计算属性
  const hasQuery = computed(() => query.value.length >= minLength)
  const hasResults = computed(() => results.value.length > 0)
  const totalResults = computed(() => searchStore.totalResults)
  const recentQueries = computed(() => searchStore.recentQueries)

  // 防抖搜索函数
  const performSearch = debounceFn(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < minLength) {
      results.value = []
      return
    }

    isLoading.value = true
    error.value = null
    const currentRequestId = Symbol()
    lastRequestId.value = currentRequestId

    try {
      const searchResults = await searchStore.search({
        query: searchQuery,
        limit: 50
      })

      // 确保处理的是最新请求的结果
      if (lastRequestId.value === currentRequestId) {
        results.value = searchResults
      }
    } catch (err) {
      error.value = err.message || 'Search failed'
      if (!keepAlive) {
        results.value = []
      }
    } finally {
      isLoading.value = false
    }
  }, debounce)

  // 监听搜索词变化
  watch(query, (newQuery) => {
    if (autoSearch) {
      performSearch(newQuery)
    }
  })

  // 路由变化时重置搜索
  if (!keepAlive) {
    const unwatch = router.afterEach(() => {
      query.value = ''
      results.value = []
    })

    onUnmounted(unwatch)
  }

  // 手动执行搜索
  const search = () => {
    if (query.value.length >= minLength) {
      performSearch(query.value)
      searchStore.saveRecentQuery(query.value)
    }
  }

  // 清空搜索
  const clearSearch = () => {
    query.value = ''
    results.value = []
    activeResultIndex.value = -1
    error.value = null
  }

  // 键盘导航
  const handleKeyNavigation = (e) => {
    if (!hasResults.value) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        activeResultIndex.value = Math.min(
          activeResultIndex.value + 1,
          results.value.length - 1
        )
        scrollToActiveResult()
        break
      case 'ArrowUp':
        e.preventDefault()
        activeResultIndex.value = Math.max(activeResultIndex.value - 1, -1)
        scrollToActiveResult()
        break
      case 'Enter':
        if (activeResultIndex.value >= 0) {
          e.preventDefault()
          selectResult(results.value[activeResultIndex.value])
        }
        break
    }
  }

  // 滚动到当前选中结果
  const scrollToActiveResult = () => {
    nextTick(() => {
      const activeElement = document.querySelector('.result-item.is-active')
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        })
      }
    })
  }

  // 选择结果
  const selectResult = (result) => {
    emit('select', result)
    if (result.route) {
      router.push(result.route)
    }
  }

  // 防抖函数实现
  function debounceFn(fn, delay) {
    let timeoutId
    return (...args) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        fn(...args)
      }, delay)
    }
  }

  return {
    // 状态
    query,
    results,
    isLoading,
    error,
    activeResultIndex,

    // 计算属性
    hasQuery,
    hasResults,
    totalResults,
    recentQueries,

    // 方法
    search,
    clearSearch,
    handleKeyNavigation,
    selectResult
  }
}