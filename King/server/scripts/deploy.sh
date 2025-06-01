#!/bin/bash
# scripts/deploy.sh

# 严格模式
set -euo pipefail
IFS=$'\n\t'

# 基础配置
DEPLOY_ENV=${1:-production}  # 部署环境 (production/staging)
APP_NAME="enterprise-catalog"
TIMESTAMP=$(date +%Y%m%d%H%M%S)
BUILD_DIR="../dist"
BACKUP_DIR="../backups"
LOG_DIR="../logs/deploy"
LOCK_FILE="../tmp/deploy.lock"

# 初始化环境
init() {
  echo "🔄 初始化部署环境 ($DEPLOY_ENV)"
  mkdir -p "$BUILD_DIR"
  mkdir -p "$BACKUP_DIR"
  mkdir -p "$LOG_DIR"
  mkdir -p "../tmp"
  
  LOG_FILE="$LOG_DIR/deploy_${DEPLOY_ENV}_${TIMESTAMP}.log"
  touch "$LOG_FILE"
  
  # 加载环境变量
  if [ -f "../.env.${DEPLOY_ENV}" ]; then
    echo "🔧 加载 ${DEPLOY_ENV} 环境变量"
    export $(grep -v '^#' ../.env.${DEPLOY_ENV} | xargs)
  fi
}

# 获取锁
acquire_lock() {
  exec 200>"$LOCK_FILE"
  if ! flock -n 200; then
    echo "🔴 部署已在进行中，请稍后再试"
    exit 1
  fi
  echo $$ > "$LOCK_FILE"
}

# 释放锁
release_lock() {
  rm -f "$LOCK_FILE"
  exec 200>&-
}

# 日志函数
log() {
  local level=$1
  local message=$2
  local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  echo "[${timestamp}] [${level}] ${message}" | tee -a "$LOG_FILE"
}

# 检查依赖
check_dependencies() {
  local missing=()
  
  for cmd in node npm git ssh-keygen rsync systemctl; do
    if ! command -v "$cmd" &> /dev/null; then
      missing+=("$cmd")
    fi
  done
  
  if [ ${#missing[@]} -gt 0 ]; then
    log "ERROR" "缺少必要依赖: ${missing[*]}"
    exit 1
  fi
}

# 构建客户端
build_client() {
  log "INFO" "🏗️  构建客户端应用"
  cd ../client
  
  # 清理旧构建
  rm -rf dist node_modules/.vite
  
  # 安装依赖
  if [ "$DEPLOY_ENV" = "production" ]; then
    npm ci --production >> "$LOG_FILE" 2>&1
  else
    npm install >> "$LOG_FILE" 2>&1
  fi
  
  # 执行构建
  if [ "$DEPLOY_ENV" = "production" ]; then
    npm run build >> "$LOG_FILE" 2>&1
  else
    npm run build:staging >> "$LOG_FILE" 2>&1
  fi
  
  # 复制构建结果
  rsync -a --delete dist/ "../${BUILD_DIR}/client"
  cd - > /dev/null
}

# 构建服务端
build_server() {
  log "INFO" "🏗️  构建服务端应用"
  cd ..
  
  # 清理旧构建
  rm -rf "$BUILD_DIR/server"
  
  # 复制必要文件
  mkdir -p "$BUILD_DIR/server"
  rsync -a \
    --exclude='node_modules' \
    --exclude='logs' \
    --exclude='tmp' \
    --exclude='.env*' \
    --exclude='test' \
    server/ "$BUILD_DIR/server"
  
  # 安装生产依赖
  cd "$BUILD_DIR/server"
  npm ci --production >> "$LOG_FILE" 2>&1
  cd - > /dev/null
}

# 数据库迁移
run_migrations() {
  log "INFO" "🔄 执行数据库迁移"
  cd ..
  
  if [ "$DEPLOY_ENV" = "production" ]; then
    NODE_ENV=production node server/initDB.js >> "$LOG_FILE" 2>&1
  else
    NODE_ENV=staging node server/initDB.js >> "$LOG_FILE" 2>&1
  fi
  
  cd - > /dev/null
}

# 备份当前版本
backup_current() {
  log "INFO" "📦 备份当前版本"
  local backup_file="${BACKUP_DIR}/${APP_NAME}_${DEPLOY_ENV}_${TIMESTAMP}.tar.gz"
  
  if [ -d "/opt/${APP_NAME}" ]; then
    tar -czf "$backup_file" -C "/opt/${APP_NAME}" . >> "$LOG_FILE" 2>&1
    log "INFO" "备份已保存到: ${backup_file}"
  else
    log "WARN" "没有找到当前部署版本，跳过备份"
  fi
}

# 部署新版本
deploy_new_version() {
  log "INFO" "🚀 部署新版本到 /opt/${APP_NAME}"
  
  # 创建应用目录
  sudo mkdir -p "/opt/${APP_NAME}"
  sudo chown -R $(whoami):$(whoami) "/opt/${APP_NAME}"
  
  # 复制文件
  rsync -a --delete "$BUILD_DIR/" "/opt/${APP_NAME}"
  
  # 复制环境变量
  if [ -f "../.env.${DEPLOY_ENV}" ]; then
    cp "../.env.${DEPLOY_ENV}" "/opt/${APP_NAME}/server/.env"
  fi
  
  # 设置权限
  find "/opt/${APP_NAME}" -type d -exec chmod 755 {} \;
  find "/opt/${APP_NAME}" -type f -exec chmod 644 {} \;
  chmod +x "/opt/${APP_NAME}/server/scripts/"*.sh
}

# 重启服务
restart_service() {
  log "INFO" "🔄 重启应用服务"
  
  # 创建systemd服务文件
  local service_file="/etc/systemd/system/${APP_NAME}.service"
  
  sudo tee "$service_file" > /dev/null <<EOF
[Unit]
Description=Enterprise Catalog Application
After=network.target

[Service]
User=$(whoami)
Group=$(whoami)
WorkingDirectory=/opt/${APP_NAME}/server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /opt/${APP_NAME}/server/app.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=${APP_NAME}

[Install]
WantedBy=multi-user.target
EOF

  # 启用并重启服务
  sudo systemctl daemon-reload
  sudo systemctl enable "${APP_NAME}.service" >> "$LOG_FILE" 2>&1
  sudo systemctl restart "${APP_NAME}.service" >> "$LOG_FILE" 2>&1
  
  # 检查服务状态
  sleep 5
  if ! systemctl is-active --quiet "${APP_NAME}.service"; then
    log "ERROR" "服务启动失败"
    sudo journalctl -u "${APP_NAME}.service" -n 50 --no-pager
    exit 1
  fi
}

# 健康检查
health_check() {
  local retries=10
  local interval=5
  local endpoint="http://localhost:${PORT:-3000}/health"
  
  log "INFO" "🏥 执行健康检查 (${endpoint})"
  
  for ((i=1; i<=retries; i++)); do
    if curl -sSf "$endpoint" > /dev/null; then
      log "INFO" "✅ 健康检查通过"
      return 0
    fi
    log "WARN" "健康检查失败 (尝试 ${i}/${retries})"
    sleep "$interval"
  done
  
  log "ERROR" "健康检查未通过"
  return 1
}

# 清理旧备份
cleanup_old_backups() {
  log "INFO" "🧹 清理旧备份 (保留最近5个)"
  ls -t "${BACKUP_DIR}/${APP_NAME}_${DEPLOY_ENV}_"*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f --
}

# 主部署流程
deploy() {
  log "INFO" "🚀 开始部署 ${APP_NAME} (${DEPLOY_ENV})"
  
  check_dependencies
  build_client
  build_server
  backup_current
  deploy_new_version
  run_migrations
  restart_service
  health_check
  cleanup_old_backups
  
  log "INFO" "🎉 部署成功完成"
}

# 执行部署
main() {
  init
  acquire_lock
  trap release_lock EXIT
  
  deploy
}

# 启动主流程
main