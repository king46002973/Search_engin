<!-- client/src/components/ResultItem.vue -->
<template>
  <article 
    class="result-item"
    :class="{
      'is-highlighted': isHighlighted,
      'is-interactive': isInteractive
    }"
    @click="handleClick"
    @mouseenter="handleHover"
  >
    <!-- 结果项头部 -->
    <header class="result-header">
      <h3 class="result-title" v-html="highlightText(title, searchQuery)"></h3>
      
      <div v-if="metaInfo" class="result-meta">
        <span v-if="metaInfo.source" class="meta-source">{{ metaInfo.source }}</span>
        <span v-if="metaInfo.date" class="meta-date">{{ formatDate(metaInfo.date) }}</span>
        <span v-if="metaInfo.type" class="meta-type">{{ metaInfo.type }}</span>
      </div>
    </header>

    <!-- 结果项内容 -->
    <div v-if="description" class="result-content">
      <p v-html="highlightText(description, searchQuery)"></p>
    </div>

    <!-- 结果项底部 -->
    <footer v-if="hasFooter" class="result-footer">
      <slot name="footer">
        <template v-if="actions && actions.length">
          <button
            v-for="(action, index) in actions"
            :key="index"
            class="action-button"
            :class="`action-${action.type}`"
            @click.stop="handleAction(action)"
          >
            {{ action.label }}
          </button>
        </template>
      </slot>
    </footer>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
    </div>
  </article>
</template>

<script>
import { computed } from 'vue'
import { useSearchStore } from '@/stores/search'
import { formatDate } from '@/utils/dateUtils'

export default {
  name: 'ResultItem',
  props: {
    id: {
      type: [String, Number],
      required: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    metaInfo: {
      type: Object,
      default: () => ({})
    },
    isHighlighted: {
      type: Boolean,
      default: false
    },
    isInteractive: {
      type: Boolean,
      default: true
    },
    isLoading: {
      type: Boolean,
      default: false
    },
    actions: {
      type: Array,
      default: () => []
    }
  },

  setup(props, { emit }) {
    const searchStore = useSearchStore()

    const searchQuery = computed(() => searchStore.currentQuery)

    const hasFooter = computed(() => {
      return props.actions?.length > 0 || !!slots.footer
    })

    // 高亮匹配文本
    const highlightText = (text, query) => {
      if (!text || !query) return text
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(${escapedQuery})`, 'gi')
      return text.replace(regex, '<mark>$1</mark>')
    }

    // 处理点击事件
    const handleClick = () => {
      if (props.isInteractive) {
        emit('select', props.id)
      }
    }

    // 处理悬停事件
    const handleHover = () => {
      emit('hover', props.id)
    }

    // 处理动作按钮点击
    const handleAction = (action) => {
      emit('action', { 
        action: action.type, 
        itemId: props.id 
      })
    }

    return {
      searchQuery,
      hasFooter,
      highlightText,
      formatDate,
      handleClick,
      handleHover,
      handleAction
    }
  }
}
</script>

<style lang="scss" scoped>
@import "@/assets/scss/variables";

.result-item {
  position: relative;
  padding: spacer(3);
  margin-bottom: spacer(2);
  background-color: $color-white;
  border: 1px solid $color-gray-200;
  border-radius: map-get($border-radius-scale, 'md');
  transition: all $transition-base;
  overflow: hidden;

  &.is-highlighted {
    border-color: theme-color('primary');
    box-shadow: 0 0 0 1px theme-color('primary');
  }

  &.is-interactive {
    cursor: pointer;

    &:hover {
      border-color: $color-gray-300;
      box-shadow: map-get($box-shadow-scale, 'sm');
      transform: translateY(-1px);
    }
  }
}

.result-header {
  margin-bottom: spacer(2);
}

.result-title {
  font-size: map-get($font-size-scale, 'md');
  font-weight: $font-weight-medium;
  line-height: map-get($line-height-scale, 'tight');
  margin-bottom: spacer(1);

  :deep(mark) {
    background-color: rgba(theme-color('primary'), 0.2);
    color: inherit;
    padding: 0 0.2em;
    border-radius: map-get($border-radius-scale, 'sm');
  }
}

.result-meta {
  display: flex;
  align-items: center;
  font-size: map-get($font-size-scale, 'xs');
  color: $color-gray-600;

  > * {
    margin-right: spacer(3);

    &:not(:last-child)::after {
      content: '•';
      margin-left: spacer(3);
    }
  }
}

.result-content {
  font-size: map-get($font-size-scale, 'sm');
  line-height: map-get($line-height-scale, 'normal');
  color: $color-gray-700;

  :deep(mark) {
    background-color: rgba(theme-color('primary'), 0.2);
    color: inherit;
    padding: 0 0.2em;
    border-radius: map-get($border-radius-scale, 'sm');
  }
}

.result-footer {
  display: flex;
  align-items: center;
  margin-top: spacer(3);
  padding-top: spacer(2);
  border-top: 1px solid $color-gray-100;
}

.action-button {
  padding: spacer(1) spacer(2);
  margin-right: spacer(2);
  font-size: map-get($font-size-scale, 'xs');
  border: 1px solid $color-gray-300;
  border-radius: map-get($border-radius-scale, 'md');
  background-color: $color-white;
  cursor: pointer;
  transition: all $transition-base;

  &:hover {
    background-color: $color-gray-100;
  }

  &.action-primary {
    background-color: theme-color('primary');
    color: color-yiq(theme-color('primary'));
    border-color: theme-color('primary');

    &:hover {
      background-color: darken(theme-color('primary'), 5%);
    }
  }

  &.action-danger {
    background-color: theme-color('danger');
    color: color-yiq(theme-color('danger'));
    border-color: theme-color('danger');

    &:hover {
      background-color: darken(theme-color('danger'), 5%);
    }
  }
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba($color-white, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid $color-gray-200;
  border-top-color: theme-color('primary');
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>