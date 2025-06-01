// client/src/api/auth.js
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import { EventBus } from '@/utils/eventBus';

// 创建带拦截器的 axios 实例
const authApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
  withCredentials: true
});

// 请求拦截器
authApi.interceptors.request.use(config => {
  const authStore = useAuthStore();
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`;
  }
  config.headers['X-Request-ID'] = generateRequestId();
  return config;
}, error => {
  return Promise.reject(error);
});

// 响应拦截器
authApi.interceptors.response.use(
  response => {
    auditLog(response.config, response.data);
    return response.data;
  },
  error => {
    const { response } = error;
    
    // 401 处理
    if (response?.status === 401) {
      EventBus.emit('force-logout');
    }
    
    // 429 限流处理
    if (response?.status === 429) {
      EventBus.emit('rate-limit', {
        retryAfter: response.headers['retry-after'] || 60
      });
    }
    
    return Promise.reject(parseError(response));
  }
);

/**
 * 企业级认证服务
 */
export const AuthService = {
  /**
   * 基础登录
   * @param {Object} credentials - 认证信息
   * @param {string} credentials.username - 用户名
   * @param {string} credentials.password - 密码
   * @param {string} [credentials.captcha] - 验证码
   */
  async login(credentials) {
    try {
      const { data } = await authApi.post('/auth/login', {
        ...credentials,
        device_fingerprint: getDeviceFingerprint()
      });
      
      // 需要双因素验证的情况
      if (data.requires2FA) {
        return { requires2FA: true, tempToken: data.tempToken };
      }
      
      return data;
    } catch (error) {
      throw new AuthError(error.message, error.code);
    }
  },

  /**
   * 双因素验证
   * @param {Object} params
   * @param {string} params.token - 临时令牌
   * @param {string} params.code - 验证码
   */
  async verify2FA({ token, code }) {
    const { data } = await authApi.post('/auth/verify-2fa', {
      token,
      code,
      device_trusted: isDeviceTrusted()
    });
    return data;
  },

  /**
   * 获取当前用户信息
   */
  async getCurrentUser() {
    const { data } = await authApi.get('/auth/me');
    return data;
  },

  /**
   * 刷新访问令牌
   */
  async refreshToken() {
    const { data } = await authApi.post('/auth/refresh', {
      refresh_token: getRefreshToken()
    });
    return data;
  },

  /**
   * 登出
   */
  async logout() {
    await authApi.post('/auth/logout');
    clearAuthStorage();
  },

  /**
   * 请求密码重置
   * @param {string} email - 用户邮箱
   */
  async requestPasswordReset(email) {
    await authApi.post('/auth/forgot-password', {
      email,
      reset_link: generateResetLink()
    });
  },

  /**
   * 验证重置令牌
   * @param {string} token - 重置令牌
   */
  async verifyResetToken(token) {
    const { data } = await authApi.get(`/auth/reset-password/${token}`);
    return data.valid;
  },

  /**
   * 重置密码
   * @param {Object} params
   * @param {string} params.token - 重置令牌
   * @param {string} params.newPassword - 新密码
   */
  async resetPassword({ token, newPassword }) {
    await authApi.post(`/auth/reset-password/${token}`, {
      new_password: newPassword,
      password_strength: checkPasswordStrength(newPassword)
    });
  }
};

// ==================== 工具函数 ====================
function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getDeviceFingerprint() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('device-fingerprint', 2, 2);
  return canvas.toDataURL();
}

function parseError(response) {
  const defaultError = {
    code: 'UNKNOWN_ERROR',
    message: '未知错误',
    status: 500
  };
  
  if (!response) return defaultError;
  
  return {
    code: response.data?.code || `HTTP_${response.status}`,
    message: response.data?.message || response.statusText,
    status: response.status,
    details: response.data?.details
  };
}

function auditLog(config, response) {
  if (import.meta.env.MODE === 'production') {
    const logData = {
      timestamp: new Date().toISOString(),
      method: config.method,
      url: config.url,
      params: config.params,
      status: response?.code || 200,
      user: getCurrentUser()?.id,
      requestId: config.headers['X-Request-ID']
    };
    
    console.log('[AUDIT]', logData);
    // 实际项目中发送到日志服务
    // logService.send(logData);
  }
}

// ==================== 错误处理 ====================
class AuthError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AuthError';
    this.code = code || 'AUTH_ERROR';
  }
}

// ==================== 存储操作 ====================
function getRefreshToken() {
  return localStorage.getItem('refresh_token');
}

function clearAuthStorage() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  sessionStorage.removeItem('temp_auth_data');
}

// 导出错误类以便外部捕获特定错误
export { AuthError };