# Enterprise Catalog System

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

企业级信息目录系统，提供企业数据管理、搜索和导出功能。

## 项目结构
king/
├── client/ # 前端应用
│ ├── public/ # 静态资源
│ ├── src/ # 前端源代码
│ │ ├── api/ # API接口封装
│ │ ├── assets/ # 静态资源
│ │ ├── components/ # Vue组件
│ │ ├── composables/ # 组合式函数
│ │ ├── router/ # 路由配置
│ │ ├── stores/ # 状态管理
│ │ ├── utils/ # 工具函数
│ │ ├── views/ # 页面视图
│ │ ├── App.vue # 根组件
│ │ └── main.js # 应用入口
├── server/ # 后端服务
│ ├── config/ # 配置文件
│ ├── controllers/ # 控制器
│ ├── middlewares/ # 中间件
│ ├── models/ # 数据模型
│ ├── routes/ # 路由定义
│ ├── services/ # 业务服务
│ ├── utils/ # 工具类
│ ├── app.js # 应用入口
│ └── initDB.js # 数据库初始化
├── scripts/ # 脚本文件
│ ├── crawl.sh # 爬虫脚本
│ └── deploy.sh # 部署脚本
└── README.md # 项目文档


## 功能特性

- **企业数据管理**：CRUD操作、批量导入导出
- **高级搜索**：多条件组合搜索、相关性排序
- **数据可视化**：企业数据统计图表
- **权限控制**：基于角色的访问控制(RBAC)
- **审计日志**：记录所有关键操作

## 技术栈

### 前端
- Vue 3 + Vite
- Pinia 状态管理
- SCSS 预处理器
- Axios HTTP客户端

### 后端
- Node.js + Express
- MongoDB 数据库
- JWT 认证
- 自定义日志系统

## 快速开始

### 前置条件
- Node.js 16+
- MongoDB 4.4+
- Git

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/your-repo/enterprise-catalog.git
   cd enterprise-catalog

2:安装依赖：
# 前端依赖
cd client
npm install

# 后端依赖
cd ../server
npm install

3：配置环境变量：
# 复制示例文件
cp .env.example .env

# 编辑配置
nano .env

4：初始化数据库：
node initDB.js

5：启动开发服务器：
# 前端开发模式
cd ../client
npm run dev

# 后端开发模式
cd ../server
npm run dev

生产部署

1：手动部署步骤
cd client
npm run build

2：准备服务端
cd ../server
npm ci --production

3：配置PM2进程管理
pm2 start app.js --name "enterprise-catalog"

环境变量

1前端：(.env.development)
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_TITLE="Enterprise Catalog (Dev)"

2：后端(.env)
# 服务器配置
PORT=3000
NODE_ENV=development

# 数据库配置
MONGODB_URI=mongodb://localhost:27017/enterprise_db

# 安全配置
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=24h

测试
运行单元测试：
# 前端测试
cd client
npm test

# 后端测试
cd ../server
npm test


