<!-- client/src/App.vue -->
<template>
  <div id="app">
    <!-- 全局加载状态 -->
    <GlobalLoading v-if="isAppLoading" />

    <!-- 路由出口 -->
    <RouterView v-slot="{ Component }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>

    <!-- 全局通知 -->
    <GlobalNotification />

    <!-- 全局确认对话框 -->
    <GlobalConfirmDialog />
  </div>
</template>

<script>
import { ref, onMounted, provide } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'

// 全局组件
import GlobalLoading from '@/components/global/Loading.vue'
import GlobalNotification from '@/components/global/Notification.vue'
import GlobalConfirmDialog from '@/components/global/ConfirmDialog.vue'

export default {
  name: 'App',
  components: {
    GlobalLoading,
    GlobalNotification,
    GlobalConfirmDialog
  },

  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    const appStore = useAppStore()

    // 应用状态
    const isAppLoading = ref(true)

    // 提供全局方法
    provide('app', {
      showLoading: (state) => { isAppLoading.value = state },
      reloadPage: () => { window.location.reload() }
    })

    // 初始化应用
    const initApp = async () => {
      try {
        // 初始化认证状态
        await authStore.initAuth()

        // 加载应用配置
        await appStore.loadConfig()

        // 设置全局主题
        setTheme(appStore.theme)
      } catch (error) {
        console.error('App initialization failed:', error)
      } finally {
        isAppLoading.value = false
      }
    }

    // 设置主题
    const setTheme = (theme) => {
      document.documentElement.setAttribute('data-theme', theme)
    }

    // 监听路由变化
    router.beforeEach(() => {
      isAppLoading.value = true
    })

    router.afterEach(() => {
      isAppLoading.value = false
    })

    // 生命周期钩子
    onMounted(() => {
      initApp()
    })

    return {
      isAppLoading
    }
  }
}
</script>

<style lang="scss">
/* 全局样式 */
@import "@/assets/scss/main";

#app {
  font-family: $font-family-base;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--color-text-primary);
  background-color: var(--color-bg-primary);
  min-height: 100vh;
  transition: background-color 0.3s ease;
}

/* 全局过渡效果 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 全局滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--color-bg-secondary);
}

::-webkit-scrollbar-thumb {
  background: var(--color-primary);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-primary-dark);
}
</style>