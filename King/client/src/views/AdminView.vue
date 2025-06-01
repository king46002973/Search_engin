<!-- client/src/views/AdminView.vue -->
<template>
  <div class="admin-view">
    <!-- 管理页头部 -->
    <AdminHeader 
      :user="currentUser"
      @logout="handleLogout"
    />

    <!-- 主内容区 -->
    <div class="admin-container">
      <!-- 侧边导航 -->
      <AdminSidebar 
        :menu-items="menuItems"
        :active-route="currentRoute"
        @navigate="handleNavigation"
      />

      <!-- 内容区 -->
      <main class="admin-content">
        <RouterView />
      </main>
    </div>

    <!-- 全局加载状态 -->
    <AppLoading v-if="isLoading" />

    <!-- 通知组件 -->
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
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'

// 本地组件
import AdminHeader from '@/components/admin/AdminHeader.vue'
import AdminSidebar from '@/components/admin/AdminSidebar.vue'
import AppLoading from '@/components/ui/AppLoading.vue'
import AppNotification from '@/components/ui/AppNotification.vue'

export default {
  name: 'AdminView',
  components: {
    AdminHeader,
    AdminSidebar,
    AppLoading,
    AppNotification
  },

  setup() {
    const router = useRouter()
    const route = useRoute()
    const authStore = useAuthStore()
    const adminStore = useAdminStore()

    // 响应式状态
    const isLoading = ref(false)
    const activeNotification = ref(null)

    // 计算属性
    const currentUser = computed(() => authStore.user)
    const currentRoute = computed(() => route.path)
    const menuItems = computed(() => [
      {
        title: 'Dashboard',
        icon: 'dashboard',
        path: '/admin/dashboard',
        roles: ['admin']
      },
      {
        title: 'Users',
        icon: 'users',
        path: '/admin/users',
        roles: ['admin']
      },
      {
        title: 'Settings',
        icon: 'settings',
        path: '/admin/settings',
        roles: ['admin']
      }
    ])

    // 生命周期钩子
    onMounted(async () => {
      if (!authStore.isAuthenticated) {
        router.push('/login')
        return
      }

      await loadAdminData()
    })

    // 方法
    const loadAdminData = async () => {
      try {
        isLoading.value = true
        await adminStore.fetchAdminData()
      } catch (error) {
        showNotification('Failed to load admin data', 'error')
      } finally {
        isLoading.value = false
      }
    }

    const handleNavigation = (path) => {
      router.push(path)
    }

    const handleLogout = () => {
      authStore.logout()
      router.push('/')
    }

    const showNotification = (message, type = 'info') => {
      activeNotification.value = { message, type }
    }

    const clearNotification = () => {
      activeNotification.value = null
    }

    return {
      isLoading,
      activeNotification,
      currentUser,
      currentRoute,
      menuItems,
      handleNavigation,
      handleLogout,
      clearNotification
    }
  }
}
</script>

<style lang="scss" scoped>
@import "@/assets/scss/variables";

.admin-view {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: $color-gray-50;
}

.admin-container {
  display: flex;
  flex: 1;
}

.admin-content {
  flex: 1;
  padding: 2rem;
  margin-left: 240px; /* 侧边栏宽度 */
  background-color: $color-white;
  min-height: calc(100vh - 60px); /* 减去头部高度 */
}

@media (max-width: 992px) {
  .admin-content {
    margin-left: 0;
    padding: 1rem;
  }
}
</style>