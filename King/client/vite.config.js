// client/vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  // 环境变量配置
  const isProduction = mode === 'production'
  const isDevelopment = mode === 'development'

  return {
    // ==================== 基础配置 ====================
    base: './',
    publicDir: 'public',
    
    // ==================== 插件配置 ====================
    plugins: [
      vue({
        template: {
          compilerOptions: {
            // 生产环境移除开发特性
            isCustomElement: isProduction ? [] : undefined,
            whitespace: isProduction ? 'condense' : 'preserve'
          }
        }
      })
    ],

    // ==================== 解析配置 ====================
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '~assets': fileURLToPath(new URL('./src/assets', import.meta.url))
      },
      extensions: ['.js', '.vue', '.json']
    },

    // ==================== 开发服务器配置 ====================
    server: {
      port: parseInt(process.env.VITE_DEV_SERVER_PORT || '5173'),
      open: process.env.VITE_DEV_OPEN_BROWSER === 'true',
      https: process.env.VITE_DEV_HTTPS === 'true',
      proxy: {
        '/api': {
          target: process.env.VITE_API_BASE_URL || 'http://localhost:3000',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api/, '')
        }
      }
    },

    // ==================== 构建配置 ====================
    build: {
      outDir: 'dist',
      assetsDir: 'static',
      assetsInlineLimit: 4096, // 4KB以下资源内联
      sourcemap: isProduction ? false : 'inline',
      minify: isProduction ? 'terser' : false,
      chunkSizeWarningLimit: 1024, // 1MB
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // 将核心依赖单独打包
              if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) {
                return 'vendor-core'
              }
              return 'vendor'
            }
          },
          entryFileNames: 'static/js/[name]-[hash].js',
          chunkFileNames: 'static/js/[name]-[hash].js',
          assetFileNames: assetInfo => {
            const extType = assetInfo.name.split('.').at(-1)
            if (/\.(css|scss)$/.test(assetInfo.name)) {
              return `static/css/[name]-[hash].${extType}`
            }
            if (/\.(png|jpe?g|gif|svg|webp|avif)$/.test(assetInfo.name)) {
              return `static/images/[name]-[hash].${extType}`
            }
            if (/\.(woff2?|eot|ttf|otf)$/.test(assetInfo.name)) {
              return `static/fonts/[name]-[hash].${extType}`
            }
            return `static/assets/[name]-[hash].${extType}`
          }
        }
      },
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction
        }
      }
    },

    // ==================== CSS配置 ====================
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/assets/scss/_variables.scss";`
        }
      },
      postcss: {
        plugins: [
          require('autoprefixer')({
            overrideBrowserslist: [
              'last 2 versions',
              '> 1%',
              'not dead'
            ]
          })
        ]
      }
    },

    // ==================== 优化配置 ====================
    optimizeDeps: {
      include: [
        'vue',
        'pinia',
        'vue-router'
      ],
      exclude: []
    }
  }
})