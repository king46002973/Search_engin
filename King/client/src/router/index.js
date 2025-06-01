// client/src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSearchStore } from '@/stores/search'

/**
 * 路由懒加载封装 (减少第三方依赖)
 * @param {string} viewPath - 视图路径(相对于views目录)
 * @returns {Promise} 异步组件
 */
function lazyLoad(viewPath) {
  return () => import(/* webpackChunkName: "view-[request]" */ `@/views/${viewPath}.vue`)
}

// 路由配置
const routes = [
  {
    path: '/',
    name: 'home',
    component: lazyLoad('HomeView'),
    meta: {
      title: 'Home',
      requiresAuth: false,
      keepAlive: true
    }
  },
  {
    path: '/about',
    name: 'about',
    component: lazyLoad('AboutView'),
    meta: {
      title: 'About Us',
      requiresAuth: false
    }
  },
  {
    path: '/admin',
    name: 'admin',
    component: lazyLoad('AdminView'),
    meta: {
      title: 'Admin Dashboard',
      requiresAuth: true,
      requiredRoles: ['admin']
    },
    children: [
      {
        path: 'dashboard',
        name: 'admin-dashboard',
        component: lazyLoad('AdminDashboardView'),
        meta: {
          title: 'Dashboard'
        }
      },
      {
        path: 'settings',
        name: 'admin-settings',
        component: lazyLoad('AdminSettingsView'),
        meta: {
          title: 'Settings',
          requiredRoles: ['super-admin']
        }
      }
    ]
  },
  {
    path: '/search',
    name: 'search',
    component: lazyLoad('SearchView'),
    meta: {
      title: 'Search Results',
      requiresAuth: false,
      scrollToTop: true
    },
    props: route => ({ query: route.query.q })
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: lazyLoad('NotFoundView'),
    meta: {
      title: 'Page Not Found'
    }
  }
]

// 创建路由实例
const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else if (to.meta.scrollToTop) {
      return { top: 0 }
    }
    return { left: 0, top: 0 }
  }
})

// 全局前置守卫
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  const searchStore = useSearchStore()

  // 设置页面标题
  document.title = to.meta.title ? `${to.meta.title} | ${process.env.VUE_APP_NAME}` : process.env.VUE_APP_NAME

  // 检查认证状态
  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) {
      // 保存目标路由以便登录后重定向
      authStore.setRedirectRoute(to.fullPath)
      return next({ name: 'home', query: { auth: 'required' } })
    }

    // 检查角色权限
    if (to.meta.requiredRoles) {
      const hasRole = authStore.user.roles?.some(role => 
        to.meta.requiredRoles.includes(role)
      )
      if (!hasRole) {
        return next({ name: 'not-found' })
      }
    }
  }

  // 清除搜索状态 (非搜索相关路由)
  if (!to.path.startsWith('/search')) {
    searchStore.clearResults()
  }

  next()
})

// 全局后置钩子
router.afterEach((to, from) => {
  // 可以在这里添加埋点统计等逻辑
})

// 开发环境路由调试
if (process.env.NODE_ENV === 'development') {
  router.afterEach((to, from) => {
    console.log(
      `[Router] ${from.fullPath} -> ${to.fullPath}`,
      `\nMeta:`, to.meta
    )
  })
}

export default router