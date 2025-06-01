<!-- client/src/components/AuthModal.vue -->
<template>
  <transition name="modal-fade">
    <div v-if="isVisible" class="auth-modal" @click.self="handleBackdropClick">
      <div class="auth-modal__container">
        <!-- 关闭按钮 -->
        <button class="auth-modal__close" @click="closeModal" aria-label="Close">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
          </svg>
        </button>

        <!-- 动态内容区域 -->
        <div class="auth-modal__content">
          <!-- 登录表单 -->
          <form v-if="activeTab === 'login'" @submit.prevent="handleLogin" class="auth-form">
            <h2 class="auth-form__title">Login</h2>
            
            <div class="form-group">
              <label for="login-email" class="form-label">Email</label>
              <input
                id="login-email"
                v-model="loginForm.email"
                type="email"
                class="form-input"
                required
                autocomplete="username"
              >
            </div>
            
            <div class="form-group">
              <label for="login-password" class="form-label">Password</label>
              <input
                id="login-password"
                v-model="loginForm.password"
                type="password"
                class="form-input"
                required
                autocomplete="current-password"
              >
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn btn--primary" :disabled="isLoading">
                <span v-if="!isLoading">Sign In</span>
                <span v-else class="loading-dots">Signing in</span>
              </button>
              <button type="button" class="btn btn--text" @click="switchTab('forgot')">
                Forgot password?
              </button>
            </div>
            
            <div class="form-footer">
              <span>Don't have an account?</span>
              <button type="button" class="btn btn--link" @click="switchTab('register')">
                Sign up
              </button>
            </div>
          </form>

          <!-- 注册表单 -->
          <form v-else-if="activeTab === 'register'" @submit.prevent="handleRegister" class="auth-form">
            <h2 class="auth-form__title">Create Account</h2>
            
            <div class="form-group">
              <label for="register-name" class="form-label">Full Name</label>
              <input
                id="register-name"
                v-model="registerForm.name"
                type="text"
                class="form-input"
                required
              >
            </div>
            
            <div class="form-group">
              <label for="register-email" class="form-label">Email</label>
              <input
                id="register-email"
                v-model="registerForm.email"
                type="email"
                class="form-input"
                required
                autocomplete="username"
              >
            </div>
            
            <div class="form-group">
              <label for="register-password" class="form-label">Password</label>
              <input
                id="register-password"
                v-model="registerForm.password"
                type="password"
                class="form-input"
                required
                autocomplete="new-password"
              >
              <div class="password-hint">
                Must be at least 8 characters
              </div>
            </div>
            
            <div class="form-group">
              <label for="register-confirm" class="form-label">Confirm Password</label>
              <input
                id="register-confirm"
                v-model="registerForm.confirmPassword"
                type="password"
                class="form-input"
                required
                autocomplete="new-password"
              >
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn btn--primary" :disabled="isLoading">
                <span v-if="!isLoading">Sign Up</span>
                <span v-else class="loading-dots">Creating account</span>
              </button>
            </div>
            
            <div class="form-footer">
              <span>Already have an account?</span>
              <button type="button" class="btn btn--link" @click="switchTab('login')">
                Sign in
              </button>
            </div>
          </form>

          <!-- 忘记密码表单 -->
          <form v-else-if="activeTab === 'forgot'" @submit.prevent="handleForgotPassword" class="auth-form">
            <h2 class="auth-form__title">Reset Password</h2>
            
            <div class="form-group">
              <label for="forgot-email" class="form-label">Email</label>
              <input
                id="forgot-email"
                v-model="forgotForm.email"
                type="email"
                class="form-input"
                required
                autocomplete="username"
              >
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn btn--primary" :disabled="isLoading">
                <span v-if="!isLoading">Send Reset Link</span>
                <span v-else class="loading-dots">Sending</span>
              </button>
              <button type="button" class="btn btn--text" @click="switchTab('login')">
                Back to login
              </button>
            </div>
          </form>

          <!-- 成功状态 -->
          <div v-else-if="activeTab === 'success'" class="auth-success">
            <div class="auth-success__icon">
              <svg viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
            </div>
            <h2 class="auth-success__title">{{ successTitle }}</h2>
            <p class="auth-success__message">{{ successMessage }}</p>
            <button class="btn btn--primary" @click="closeModal">
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

export default {
  name: 'AuthModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    defaultTab: {
      type: String,
      default: 'login',
      validator: (value) => ['login', 'register', 'forgot'].includes(value)
    }
  },

  setup(props, { emit }) {
    const authStore = useAuthStore()
    const router = useRouter()

    // 状态管理
    const isVisible = ref(props.show)
    const activeTab = ref(props.defaultTab)
    const isLoading = ref(false)
    const errorMessage = ref('')
    const successTitle = ref('')
    const successMessage = ref('')

    // 表单数据
    const loginForm = ref({
      email: '',
      password: ''
    })

    const registerForm = ref({
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    })

    const forgotForm = ref({
      email: ''
    })

    // 监听props变化
    watch(() => props.show, (newVal) => {
      isVisible.value = newVal
      if (newVal) {
        activeTab.value = props.defaultTab
        resetForms()
      }
    })

    // 切换标签页
    const switchTab = (tab) => {
      activeTab.value = tab
      errorMessage.value = ''
    }

    // 关闭模态框
    const closeModal = () => {
      isVisible.value = false
      emit('update:show', false)
      emit('close')
    }

    // 点击背景关闭
    const handleBackdropClick = (event) => {
      if (event.target === event.currentTarget) {
        closeModal()
      }
    }

    // 重置表单
    const resetForms = () => {
      loginForm.value = { email: '', password: '' }
      registerForm.value = { name: '', email: '', password: '', confirmPassword: '' }
      forgotForm.value = { email: '' }
      errorMessage.value = ''
    }

    // 处理登录
    const handleLogin = async () => {
      if (isLoading.value) return

      isLoading.value = true
      errorMessage.value = ''

      try {
        await authStore.login(loginForm.value)
        showSuccess('Login Successful', 'You have been successfully logged in.')
      } catch (error) {
        errorMessage.value = error.message || 'Login failed. Please try again.'
      } finally {
        isLoading.value = false
      }
    }

    // 处理注册
    const handleRegister = async () => {
      if (isLoading.value) return

      // 密码验证
      if (registerForm.value.password !== registerForm.value.confirmPassword) {
        errorMessage.value = 'Passwords do not match'
        return
      }

      if (registerForm.value.password.length < 8) {
        errorMessage.value = 'Password must be at least 8 characters'
        return
      }

      isLoading.value = true
      errorMessage.value = ''

      try {
        await authStore.register(registerForm.value)
        showSuccess('Registration Successful', 'Your account has been created successfully.')
      } catch (error) {
        errorMessage.value = error.message || 'Registration failed. Please try again.'
      } finally {
        isLoading.value = false
      }
    }

    // 处理忘记密码
    const handleForgotPassword = async () => {
      if (isLoading.value) return

      isLoading.value = true
      errorMessage.value = ''

      try {
        await authStore.forgotPassword(forgotForm.value)
        showSuccess('Email Sent', 'If an account exists, we have sent a password reset link to your email.')
      } catch (error) {
        errorMessage.value = error.message || 'Failed to send reset link. Please try again.'
      } finally {
        isLoading.value = false
      }
    }

    // 显示成功状态
    const showSuccess = (title, message) => {
      successTitle.value = title
      successMessage.value = message
      activeTab.value = 'success'
    }

    return {
      isVisible,
      activeTab,
      isLoading,
      errorMessage,
      successTitle,
      successMessage,
      loginForm,
      registerForm,
      forgotForm,
      switchTab,
      closeModal,
      handleBackdropClick,
      handleLogin,
      handleRegister,
      handleForgotPassword
    }
  }
}
</script>

<style lang="scss" scoped>
@import "@/assets/scss/variables";

.auth-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba($color-black, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: map-get($zindex-levels, 'modal');
  padding: spacer(2);
}

.auth-modal__container {
  position: relative;
  background-color: $color-white;
  border-radius: map-get($border-radius-scale, 'lg');
  width: 100%;
  max-width: 440px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: map-get($box-shadow-scale, 'lg');
  animation: modal-enter 0.3s ease-out;
}

.auth-modal__close {
  position: absolute;
  top: spacer(2);
  right: spacer(2);
  background: none;
  border: none;
  padding: spacer(1);
  cursor: pointer;
  color: $color-gray-600;
  z-index: 1;

  &:hover {
    color: $color-gray-800;
  }

  .icon {
    width: 24px;
    height: 24px;
    fill: currentColor;
  }
}

.auth-modal__content {
  padding: spacer(5) spacer(4);
}

.auth-form {
  &__title {
    font-size: map-get($font-size-scale, 'xl');
    font-weight: $font-weight-bold;
    margin-bottom: spacer(4);
    text-align: center;
    color: $color-gray-900;
  }
}

.form-group {
  margin-bottom: spacer(3);
}

.form-label {
  display: block;
  margin-bottom: spacer(1);
  font-size: map-get($font-size-scale, 'sm');
  color: $color-gray-700;
  font-weight: $font-weight-medium;
}

.form-input {
  width: 100%;
  padding: spacer(2) spacer(3);
  font-size: map-get($font-size-scale, 'md');
  border: 1px solid $color-gray-300;
  border-radius: map-get($border-radius-scale, 'md');
  transition: border-color $transition-base;

  &:focus {
    outline: none;
    border-color: theme-color('primary');
    box-shadow: 0 0 0 2px rgba(theme-color('primary'), 0.1);
  }
}

.password-hint {
  font-size: map-get($font-size-scale, 'xs');
  color: $color-gray-500;
  margin-top: spacer(1);
}

.form-actions {
  margin-top: spacer(4);
  display: flex;
  flex-direction: column;
  gap: spacer(2);
}

.form-footer {
  margin-top: spacer(3);
  text-align: center;
  font-size: map-get($font-size-scale, 'sm');
  color: $color-gray-600;

  .btn--link {
    margin-left: spacer(1);
    padding: 0;
    font-weight: $font-weight-medium;
  }
}

.auth-success {
  text-align: center;
  padding: spacer(2);

  &__icon {
    width: 64px;
    height: 64px;
    margin: 0 auto spacer(3);
    background-color: rgba(theme-color('success'), 0.1);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      width: 32px;
      height: 32px;
      fill: theme-color('success');
    }
  }

  &__title {
    font-size: map-get($font-size-scale, 'xl');
    font-weight: $font-weight-bold;
    margin-bottom: spacer(2);
    color: $color-gray-900;
  }

  &__message {
    font-size: map-get($font-size-scale, 'md');
    color: $color-gray-600;
    margin-bottom: spacer(4);
  }
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: spacer(2) spacer(3);
  font-size: map-get($font-size-scale, 'md');
  font-weight: $font-weight-medium;
  border-radius: map-get($border-radius-scale, 'md');
  border: 1px solid transparent;
  cursor: pointer;
  transition: all $transition-base;

  &--primary {
    background-color: theme-color('primary');
    color: color-yiq(theme-color('primary'));

    &:hover {
      background-color: darken(theme-color('primary'), 5%);
    }

    &:disabled {
      background-color: $color-gray-300;
      color: $color-gray-600;
      cursor: not-allowed;
    }
  }

  &--text {
    background: none;
    color: theme-color('primary');

    &:hover {
      text-decoration: underline;
    }
  }

  &--link {
    background: none;
    border: none;
    color: theme-color('primary');
    text-decoration: underline;
  }
}

.loading-dots {
  display: inline-flex;
  align-items: center;

  &::after {
    content: '...';
    display: inline-block;
    width: 1em;
    text-align: left;
    animation: dots 1.5s steps(4, end) infinite;
  }
}

@keyframes dots {
  0%, 20% { content: '.'; }
  40% { content: '..'; }
  60%, 100% { content: '...'; }
}

@keyframes modal-enter {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>