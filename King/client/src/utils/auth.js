// client/src/utils/auth.js
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

/**
 * 企业级认证工具
 * 提供认证相关工具函数，与Pinia store和路由集成
 */

// JWT工具函数
const JWT = {
  /**
   * 解析JWT令牌
   * @param {string} token - JWT令牌
   * @returns {Object|null} 解析后的payload
   */
  parse(token) {
    if (!token) return null
    
    try {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      return JSON.parse(atob(base64))
    } catch (error) {
      console.error('JWT解析失败:', error)
      return null
    }
  },

  /**
   * 检查JWT是否过期
   * @param {string} token - JWT令牌
   * @returns {boolean} 是否过期
   */
  isExpired(token) {
    const payload = this.parse(token)
    if (!payload || !payload.exp) return true
    return Date.now() >= payload.exp * 1000
  }
}

// 认证工具主对象
const Auth = {
  /**
   * 初始化认证状态
   * @returns {Promise<boolean>} 是否已认证
   */
  async init() {
    const authStore = useAuthStore()
    
    // 从存储中恢复token
    const token = this.getTokenFromStorage()
    if (!token) return false

    // 验证token有效性
    if (JWT.isExpired(token)) {
      this.clearAuth()
      return false
    }

    // 设置store状态
    authStore.setToken(token)
    
    // 获取用户信息
    try {
      await authStore.fetchUser()
      return true
    } catch (error) {
      console.error('用户信息获取失败:', error)
      this.clearAuth()
      return false
    }
  },

  /**
   * 登录处理
   * @param {string} token - JWT令牌
   * @param {Object} user - 用户信息
   */
  login(token, user) {
    const authStore = useAuthStore()
    const router = useRouter()

    // 存储token
    this.setTokenToStorage(token)
    
    // 更新store状态
    authStore.setToken(token)
    authStore.setUser(user)
    
    // 重定向到目标路由或首页
    const redirect = authStore.redirectRoute || '/'
    router.push(redirect)
    authStore.clearRedirect()
  },

  /**
   * 登出处理
   */
  logout() {
    const authStore = useAuthStore()
    const router = useRouter()
    
    this.clearAuth()
    router.push('/login')
  },

  /**
   * 清除认证信息
   */
  clearAuth() {
    const authStore = useAuthStore()
    
    this.removeTokenFromStorage()
    authStore.clearAuth()
  },

  /**
   * 检查认证状态
   * @returns {boolean} 是否已认证
   */
  isAuthenticated() {
    const authStore = useAuthStore()
    const token = authStore.token || this.getTokenFromStorage()
    
    if (!token || JWT.isExpired(token)) {
      this.clearAuth()
      return false
    }
    return true
  },

  /**
   * 检查用户角色
   * @param {string|Array} roles - 需要的角色
   * @returns {boolean} 是否具有权限
   */
  hasRole(roles) {
    const authStore = useAuthStore()
    if (!authStore.user?.roles) return false
    
    const requiredRoles = Array.isArray(roles) ? roles : [roles]
    return requiredRoles.some(role => authStore.user.roles.includes(role))
  },

  /**
   * 从存储获取token
   * @returns {string|null} token
   */
  getTokenFromStorage() {
    try {
      return localStorage.getItem('auth_token') || null
    } catch (error) {
      console.error('从存储获取token失败:', error)
      return null
    }
  },

  /**
   * 存储token
   * @param {string} token - JWT令牌
   */
  setTokenToStorage(token) {
    try {
      localStorage.setItem('auth_token', token)
    } catch (error) {
      console.error('存储token失败:', error)
    }
  },

  /**
   * 移除存储的token
   */
  removeTokenFromStorage() {
    try {
      localStorage.removeItem('auth_token')
    } catch (error) {
      console.error('移除token失败:', error)
    }
  },

  /**
   * 刷新token处理
   * @returns {Promise<boolean>} 是否刷新成功
   */
  async refreshToken() {
    const authStore = useAuthStore()
    
    try {
      const newToken = await authStore.refreshToken()
      if (newToken) {
        this.setTokenToStorage(newToken)
        return true
      }
    } catch (error) {
      console.error('刷新token失败:', error)
      this.clearAuth()
    }
    return false
  }
}

export default Auth