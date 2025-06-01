// client/src/composables/usePagination.js
import { ref, computed, watch } from 'vue'

/**
 * 企业级分页逻辑封装
 * @param {Object} options - 配置选项
 * @param {number} options.total - 总数据量
 * @param {number} [options.perPage=10] - 每页数量
 * @param {number} [options.currentPage=1] - 当前页码
 * @param {number} [options.visiblePages=5] - 可见页码数
 * @param {boolean} [options.autoReset=true] - 数据变化时是否自动重置页码
 * @returns {Object} 分页相关属性和方法
 */
export function usePagination(options) {
  const {
    total,
    perPage = 10,
    currentPage = 1,
    visiblePages = 5,
    autoReset = true
  } = options

  // 响应式状态
  const page = ref(currentPage)
  const itemsPerPage = ref(perPage)
  const totalItems = ref(total)

  // 计算属性
  const totalPages = computed(() => Math.ceil(totalItems.value / itemsPerPage.value))
  const offset = computed(() => (page.value - 1) * itemsPerPage.value)
  const hasPrevious = computed(() => page.value > 1)
  const hasNext = computed(() => page.value < totalPages.value)
  const isFirstPage = computed(() => page.value === 1)
  const isLastPage = computed(() => page.value === totalPages.value)

  // 分页范围计算
  const pageRange = computed(() => {
    const half = Math.floor(visiblePages / 2)
    let start = Math.max(1, page.value - half)
    let end = Math.min(totalPages.value, start + visiblePages - 1)

    // 调整起始位置确保显示足够的页码
    if (end - start + 1 < visiblePages) {
      start = Math.max(1, end - visiblePages + 1)
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  })

  // 监听总数据量变化
  if (autoReset) {
    watch(totalItems, (newTotal, oldTotal) => {
      if (newTotal !== oldTotal) {
        page.value = 1
      }
    })
  }

  // 分页方法
  const setPage = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages.value) {
      page.value = newPage
    }
  }

  const nextPage = () => {
    if (hasNext.value) {
      page.value++
    }
  }

  const prevPage = () => {
    if (hasPrevious.value) {
      page.value--
    }
  }

  const firstPage = () => {
    setPage(1)
  }

  const lastPage = () => {
    setPage(totalPages.value)
  }

  const updateItemsPerPage = (newPerPage) => {
    itemsPerPage.value = newPerPage
    // 重新计算当前页码，防止超出范围
    const newTotalPages = Math.ceil(totalItems.value / newPerPage)
    if (page.value > newTotalPages) {
      page.value = newTotalPages || 1
    }
  }

  const updateTotalItems = (newTotal) => {
    totalItems.value = newTotal
  }

  // 分页数据切片方法
  const paginate = (items) => {
    return items.slice(offset.value, offset.value + itemsPerPage.value)
  }

  return {
    // 状态
    page,
    itemsPerPage,
    totalItems,

    // 计算属性
    totalPages,
    offset,
    hasPrevious,
    hasNext,
    isFirstPage,
    isLastPage,
    pageRange,

    // 方法
    setPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    updateItemsPerPage,
    updateTotalItems,
    paginate
  }
}