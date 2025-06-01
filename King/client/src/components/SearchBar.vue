<template>
  <div class="search-bar" :class="{ 'has-results': showResults }">
    <!-- 搜索输入框 -->
    <div class="search-input-container">
      <input
        ref="searchInput"
        v-model="searchQuery"
        type="text"
        class="search-input"
        :placeholder="placeholder"
        @focus="onFocus"
        @blur="onBlur"
        @keyup.enter="executeSearch"
        @keyup.esc="clearSearch"
      />
      <button
        v-if="searchQuery"
        class="clear-button"
        @click="clearSearch"
        aria-label="Clear search"
      >
        ×
      </button>
      <button
        class="search-button"
        @click="executeSearch"
        :disabled="!searchQuery"
        aria-label="Search"
      >
        <svg class="search-icon" viewBox="0 0 24 24">
          <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 001.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 00-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 005.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
      </button>
    </div>

    <!-- 搜索结果下拉框 -->
    <div v-if="showResults" class="search-results">
      <div v-if="isLoading" class="loading-indicator">
        <div class="spinner"></div>
        <span>Searching...</span>
      </div>
      
      <template v-else>
        <div v-if="results.length > 0" class="results-list">
          <div
            v-for="(result, index) in results"
            :key="result.id || index"
            class="result-item"
            @mousedown="selectResult(result)"
          >
            <slot name="result" :result="result">
              <div class="result-title" v-html="highlightMatches(result.title)"></div>
              <div v-if="result.description" class="result-description" v-html="highlightMatches(result.description)"></div>
            </slot>
          </div>
        </div>
        
        <div v-else class="no-results">
          No results found for "{{ searchQuery }}"
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import { ref, watch, nextTick } from 'vue'
import { useSearchStore } from '@/stores/search'
import { useDebounceFn } from '@/composables/useDebounce'

export default {
  name: 'SearchBar',
  props: {
    placeholder: {
      type: String,
      default: 'Search...'
    },
    debounceTime: {
      type: Number,
      default: 300
    },
    minLength: {
      type: Number,
      default: 2
    },
    autoSearch: {
      type: Boolean,
      default: true
    },
    focusOnMount: {
      type: Boolean,
      default: false
    }
  },

  setup(props, { emit }) {
    const searchStore = useSearchStore()
    const searchInput = ref(null)
    const searchQuery = ref('')
    const results = ref([])
    const isLoading = ref(false)
    const isFocused = ref(false)
    const lastRequestId = ref(null)

    // 防抖搜索函数
    const debouncedSearch = useDebounceFn(async (query) => {
      if (query.length < props.minLength) {
        results.value = []
        return
      }

      isLoading.value = true
      try {
        // 生成当前请求ID用于取消过时请求
        const currentRequestId = Symbol()
        lastRequestId.value = currentRequest

        const searchResults = await searchStore.search({
          query,
          limit: 5
        })

        // 确保这是最新的请求结果
        if (lastRequestId.value === currentRequestId) {
          results.value = searchResults
          emit('results', searchResults)
        }
      } catch (error) {
        console.error('Search error:', error)
        results.value = []
        emit('error', error)
      } finally {
        isLoading.value = false
      }
    }, props.debounceTime)

    // 监听搜索词变化
    watch(searchQuery, (newQuery) => {
      emit('update:query', newQuery)
      if (props.autoSearch) {
        debouncedSearch(newQuery)
      }
    })

    // 高亮匹配文本
    const highlightMatches = (text) => {
      if (!searchQuery.value || !text) return text
      const query = searchQuery.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(${query})`, 'gi')
      return text.replace(regex, '<mark>$1</mark>')
    }

    // 执行搜索
    const executeSearch = () => {
      if (searchQuery.value.length >= props.minLength) {
        emit('search', searchQuery.value)
        searchStore.saveRecentQuery(searchQuery.value)
      }
    }

    // 清空搜索
    const clearSearch = () => {
      searchQuery.value = ''
      results.value = []
      emit('clear')
      nextTick(() => {
        searchInput.value?.focus()
      })
    }

    // 选择结果
    const selectResult = (result) => {
      emit('select', result)
      searchQuery.value = result.title
      results.value = []
    }

    // 焦点处理
    const onFocus = () => {
      isFocused.value = true
      emit('focus')
    }

    const onBlur = () => {
      setTimeout(() => {
        isFocused.value = false
        emit('blur')
      }, 200)
    }

    // 计算是否显示结果
    const showResults = computed(() => {
      return isFocused.value && searchQuery.value.length >= props.minLength
    })

    // 挂载时自动聚焦
    onMounted(() => {
      if (props.focusOnMount) {
        nextTick(() => {
          searchInput.value?.focus()
        })
      }
    })

    return {
      searchInput,
      searchQuery,
      results,
      isLoading,
      showResults,
      executeSearch,
      clearSearch,
      selectResult,
      onFocus,
      onBlur,
      highlightMatches
    }
  }
}
</script>

<style lang="scss" scoped>
@import "@/assets/scss/variables";

.search-bar {
  position: relative;
  width: 100%;
  max-width: map-get($breakpoints, 'md');
  margin: 0 auto;

  &.has-results {
    .search-results {
      display: block;
    }
  }
}

.search-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  width: 100%;
  padding: spacer(2) spacer(4) spacer(2) spacer(2);
  font-size: map-get($font-size-scale, 'md');
  border: 1px solid map-get($theme-default, 'border');
  border-radius: map-get($border-radius-scale, 'pill');
  transition: all $transition-base;
  
  &:focus {
    outline: none;
    border-color: theme-color('primary');
    box-shadow: 0 0 0 2px rgba(theme-color('primary'), 0.2);
  }
}

.clear-button {
  position: absolute;
  right: spacer(5);
  background: none;
  border: none;
  color: $color-gray-500;
  font-size: map-get($font-size-scale, 'lg');
  cursor: pointer;
  padding: spacer(1);
  
  &:hover {
    color: $color-gray-700;
  }
}

.search-button {
  position: absolute;
  right: spacer(1);
  background: none;
  border: none;
  padding: spacer(1);
  cursor: pointer;
  color: $color-gray-600;
  
  &:disabled {
    opacity: map-get($opacity-levels, 'medium');
    cursor: not-allowed;
  }
  
  &:hover:not(:disabled) {
    color: theme-color('primary');
  }
}

.search-icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.search-results {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: spacer(1);
  background: $color-white;
  border: 1px solid $color-gray-200;
  border-radius: map-get($border-radius-scale, 'md');
  box-shadow: map-get($box-shadow-scale, 'lg');
  z-index: map-get($zindex-levels, 'dropdown');
  max-height: 60vh;
  overflow-y: auto;
}

.loading-indicator {
  display: flex;
  align-items: center;
  padding: spacer(3);
  color: $color-gray-600;
  
  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid $color-gray-300;
    border-top-color: theme-color('primary');
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    margin-right: spacer(2);
  }
}

.results-list {
  padding: spacer(1) 0;
}

.result-item {
  padding: spacer(2) spacer(3);
  cursor: pointer;
  transition: background-color $transition-base;
  
  &:hover {
    background-color: $color-gray-100;
  }
  
  mark {
    background-color: rgba(theme-color('primary'), 0.2);
    color: inherit;
  }
}

.result-title {
  font-weight: $font-weight-medium;
  margin-bottom: spacer(1);
}

.result-description {
  font-size: map-get($font-size-scale, 'sm');
  color: $color-gray-600;
  line-height: map-get($line-height-scale, 'tight');
}

.no-results {
  padding: spacer(3);
  color: $color-gray-600;
  text-align: center;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>