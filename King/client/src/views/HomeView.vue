<!-- client/src/views/HomeView.vue -->
<template>
  <div class="home-view">
    <!-- 顶部导航区 -->
    <header class="home-header">
      <div class="branding">
        <h1>{{ appName }}</h1>
        <p class="subtitle">{{ welcomeMessage }}</p>
      </div>
      
      <SearchBar 
        v-model="searchQuery"
        @search="handleSearch"
        class="home-search"
      />
    </header>

    <!-- 主要内容区 -->
    <main class="home-content">
      <!-- 功能入口 -->
      <section v-if="!searchQuery" class="feature-grid">
        <RouterLink 
          v-for="feature in features"
          :key="feature.id"
          :to="feature.path"
          class="feature-card"
        >
          <div class="feature-icon">
            <component :is="feature.icon" />
          </div>
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.description }}</p>
        </RouterLink>
      </section>

      <!-- 搜索结果展示 -->
      <template v-else>
        <SearchResults 
          :query="searchQuery"
          @clear-search="clearSearch"
        />
      </template>

      <!-- 动态内容区 -->
      <section class="dynamic-content">
        <template v-if="!searchQuery">
          <LatestUpdates :items="latestUpdates" />
          <QuickActions @action-triggered="handleQuickAction" />
        </template>
      </section>
    </main>

    <!-- 全局通知 -->
    <AppNotification 
      v-if="activeNotification"
      :message="activeNotification.message"
      :type="activeNotification.type"
      @close="clearNotification"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSearchStore } from '@/stores/search'
import { useAuthStore } from '@/stores/auth'

// 本地组件
import SearchBar from '@/components/SearchBar.vue'
import SearchResults from '@/components/SearchResults.vue'
import LatestUpdates from '@/components/LatestUpdates.vue'
import QuickActions from '@/components/QuickActions.vue'
import AppNotification from '@/components/AppNotification.vue'

// 图标 (使用内联SVG减少依赖)
const FeatureIcons = {
  dashboard: {
    template: `<svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>`
  },
  analytics: {
    template: `<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-5h2v5zm4 0h-2v-3h2v3zm4 0h-2v-7h2v7z"/></svg>`
  }
}

export default {
  name: 'HomeView',
  components: {
    SearchBar,
    SearchResults,
    LatestUpdates,
    QuickActions,
    AppNotification
  },

  setup() {
    const router = useRouter()
    const searchStore = useSearchStore()
    const authStore = useAuthStore()

    // 响应式状态
    const searchQuery = ref('')
    const activeNotification = ref(null)
    const latestUpdates = ref([])
    const isLoading = ref(false)

    // 计算属性
    const appName = computed(() => import.meta.env.VITE_APP_NAME || 'King Platform')
    const welcomeMessage = computed(() => {
      return authStore.user 
        ? `Welcome back, ${authStore.user.name}!`
        : 'Welcome to King Platform'
    })

    const features = computed(() => [
      {
        id: 'dashboard',
        title: 'Dashboard',
        description: 'View your analytics dashboard',
        path: '/dashboard',
        icon: FeatureIcons.dashboard
      },
      {
        id: 'analytics',
        title: 'Analytics',
        description: 'Explore data insights',
        path: '/analytics',
        icon: FeatureIcons.analytics
      }
    ])

    // 生命周期钩子
    onMounted(async () => {
      try {
        isLoading.value = true
        latestUpdates.value = await fetchLatestUpdates()
      } catch (error) {
        showNotification('Failed to load updates', 'error')
      } finally {
        isLoading.value = false
      }
    })

    // 方法
    const handleSearch = (query) => {
      searchStore.setSearchQuery(query)
      if (query) {
        router.push({ path: '/search', query: { q: query } })
      }
    }

    const clearSearch = () => {
      searchQuery.value = ''
      searchStore.clearSearch()
    }

    const showNotification = (message, type = 'info') => {
      activeNotification.value = { message, type }
    }

    const clearNotification = () => {
      activeNotification.value = null
    }

    const handleQuickAction = (action) => {
      switch (action) {
        case 'refresh':
          refreshData()
          break
        case 'settings':
          router.push('/settings')
          break
      }
    }

    const refreshData = async () => {
      try {
        isLoading.value = true
        latestUpdates.value = await fetchLatestUpdates()
        showNotification('Data refreshed successfully')
      } catch (error) {
        showNotification('Refresh failed', 'error')
      } finally {
        isLoading.value = false
      }
    }

    // 模拟API调用
    const fetchLatestUpdates = async () => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve([
            { id: 1, title: 'System Update', date: '2023-05-15', type: 'announcement' },
            { id: 2, title: 'New Feature Released', date: '2023-05-10', type: 'feature' }
          ])
        }, 500)
      })
    }

    return {
      searchQuery,
      activeNotification,
      latestUpdates,
      isLoading,
      appName,
      welcomeMessage,
      features,
      handleSearch,
      clearSearch,
      clearNotification,
      handleQuickAction
    }
  }
}
</script>

<style lang="scss" scoped>
@import "@/assets/scss/variables";

.home-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.home-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 0;
  border-bottom: 1px solid $color-gray-200;

  .branding {
    text-align: center;
    margin-bottom: 2rem;

    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      color: $color-primary;
    }

    .subtitle {
      font-size: 1.2rem;
      color: $color-gray-600;
    }
  }

  .home-search {
    width: 100%;
    max-width: 600px;
  }
}

.home-content {
  padding: 2rem 0;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.feature-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem;
  border-radius: $border-radius-lg;
  background: $color-white;
  box-shadow: $box-shadow-sm;
  transition: all 0.2s ease;
  text-align: center;
  color: inherit;
  text-decoration: none;

  &:hover {
    transform: translateY(-2px);
    box-shadow: $box-shadow-md;
  }

  .feature-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 1rem;
    color: $color-primary;

    svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }
  }

  h3 {
    margin-bottom: 0.5rem;
    font-size: 1.2rem;
  }

  p {
    color: $color-gray-600;
    font-size: 0.9rem;
  }
}

.dynamic-content {
  margin-top: 2rem;
}

@media (max-width: 768px) {
  .home-header {
    padding: 1rem 0;

    h1 {
      font-size: 2rem;
    }
  }

  .feature-grid {
    grid-template-columns: 1fr;
  }
}
</style>