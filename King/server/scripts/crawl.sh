#!/bin/bash
# server/scripts/crawl.sh

# 严格模式
set -euo pipefail
IFS=$'\n\t'

# 基础配置
LOG_DIR="../logs/crawler"
PID_FILE="../tmp/crawler.pid"
LOCK_FILE="../tmp/crawler.lock"
MAX_RUNTIME=7200  # 最大运行时间(秒)
CONCURRENCY=4     # 并发爬取数量
RETRY_LIMIT=3     # 失败重试次数

# 初始化环境
init_environment() {
  # 创建必要目录
  mkdir -p "$LOG_DIR"
  mkdir -p "../tmp"
  
  # 设置日志文件
  local timestamp=$(date +%Y%m%d_%H%M%S)
  LOG_FILE="$LOG_DIR/crawl_${timestamp}.log"
  touch "$LOG_FILE"
  
  # 加载环境变量
  if [ -f "../.env" ]; then
    export $(grep -v '^#' ../.env | xargs)
  fi
}

# 检查是否已在运行
check_running() {
  if [ -f "$PID_FILE" ]; then
    local pid=$(cat "$PID_FILE")
    if ps -p "$pid" > /dev/null; then
      echo "爬虫已在运行 (PID: $pid)"
      exit 1
    else
      rm -f "$PID_FILE"
      rm -f "$LOCK_FILE"
    fi
  fi
}

# 获取锁
acquire_lock() {
  exec 200>"$LOCK_FILE"
  flock -n 200 || {
    echo "无法获取锁文件，爬虫可能已在运行"
    exit 1
  }
  echo $$ > "$PID_FILE"
}

# 释放锁
release_lock() {
  rm -f "$PID_FILE"
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

# 主爬取函数
run_crawler() {
  log "INFO" "启动爬虫服务"
  log "INFO" "并发数: ${CONCURRENCY}, 最大运行时间: ${MAX_RUNTIME}秒"
  
  # 启动Node.js爬虫服务
  NODE_ENV=production node ../services/crawler.js \
    --concurrency "$CONCURRENCY" \
    --max-runtime "$MAX_RUNTIME" \
    --retry-limit "$RETRY_LIMIT" >> "$LOG_FILE" 2>&1
  
  local exit_code=$?
  
  if [ $exit_code -eq 0 ]; then
    log "INFO" "爬虫服务完成"
  else
    log "ERROR" "爬虫服务异常退出 (代码: ${exit_code})"
    exit $exit_code
  fi
}

# 清理函数
cleanup() {
  release_lock
  log "INFO" "清理完成"
  exit 0
}

# 监控函数
monitor() {
  local start_time=$(date +%s)
  
  while true; do
    sleep 60
    
    # 检查运行时间
    local current_time=$(date +%s)
    local runtime=$((current_time - start_time))
    
    if [ "$runtime" -gt "$MAX_RUNTIME" ]; then
      log "WARN" "达到最大运行时间，终止爬虫"
      pkill -P $$
      break
    fi
    
    # 检查磁盘空间
    local disk_usage=$(df -h . | awk 'NR==2 {print $5}' | tr -d '%')
    if [ "$disk_usage" -gt 90 ]; then
      log "ERROR" "磁盘空间不足 (使用率: ${disk_usage}%)"
      pkill -P $$
      exit 1
    fi
  done
}

# 主执行流程
main() {
  init_environment
  check_running
  acquire_lock
  
  # 设置信号处理
  trap cleanup SIGINT SIGTERM
  
  # 启动监控
  monitor &
  local monitor_pid=$!
  
  # 运行爬虫
  run_crawler
  
  # 清理监控
  kill "$monitor_pid" 2>/dev/null || true
  
  cleanup
}

# 执行主函数
main