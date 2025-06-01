// client/src/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'

// 根组件
import App from './App.vue'

// 全局样式
import './assets/scss/main.scss'

// 路由配置
import routes from './router'

// 创建应用实例
const app = createApp(App)

// ==================== 初始化Pinia ====================
const pinia = createPinia()

/**
 * Pinia插件示例：持久化存储
 */
pinia.use(({ store }) => {
  // 从存储中恢复状态
  const savedState = localStorage.getItem(`pinia_${store.$id}`)
  if (savedState) {
    store.$patch(JSON.parse(savedState))
  }

  // 监听变化并保存
  store.$subscribe((mutation, state) => {
    localStorage.setItem(`pinia_${store.$id}`, JSON.stringify(state))
  })
})

app.use(pinia)

// ==================== 初始化路由 ====================
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

/**
 * 全局路由守卫
 */
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  // 初始化认证状态
  await authStore.initAuth()

  // 检查是否需要认证
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    authStore.setRedirectRoute(to.fullPath)
    return next('/login')
  }

  // 检查角色权限
  if (to.meta.requiredRoles) {
    const hasPermission = authStore.user?.roles?.some(role => 
      to.meta.requiredRoles.includes(role)
    )
    if (!hasPermission) return next('/forbidden')
  }

  next()
})

app.use(router)

// ==================== 全局错误处理 ====================
app.config.errorHandler = (err, vm, info) => {
  console.error('Global error:', err)
  const appStore = useAppStore()
  appStore.showNotification('An unexpected error occurred', 'error')
}

// ==================== 全局属性/方法 ====================
app.config.globalProperties.$filters = {
  formatDate(value) {
    if (!value) return ''
    return new Date(value).toLocaleDateString()
  },
  truncate(text, length = 30) {
    if (!text) return ''
    return text.length > length 
      ? text.substring(0, length) + '...' 
      : text
  }
}

// ==================== 生产环境配置 ====================
if (import.meta.env.PROD) {
  // 禁用console.log
  console.log = () => {}
  
  // 错误监控集成
  window.onerror = function(message, source, lineno, colno, error) {
    // 这里可以集成Sentry等错误监控
    console.error('Window error:', { message, source, lineno, colno, error })
  }
}

// ==================== 挂载应用 ====================
app.mount('#app')

// ==================== 开发环境工具 ====================
if (import.meta.env.DEV) {
  // 暴露app实例用于开发调试
  window.__APP__ = app
}