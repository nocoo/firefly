# Autoresearch: 优化运行时内存占用

## 目标
降低 Next.js 应用的运行时内存占用（heapUsed），通过以下方式：
1. 优化缓存策略（cache-handler）
2. 减少模块加载开销
3. 优化数据结构
4. 懒加载重型依赖

## 基准测试方法
1. Build 项目
2. 启动 Next.js 服务器
3. 模拟一系列典型请求
4. 测量 heap 内存使用

## 约束
- 不能破坏功能（tests 必须通过）
- 不能牺牲性能换内存
- 不能过拟合基准测试

## 主要指标
- `heap_used_mb`: 堆内存使用量（MB）

## 次要指标
- `heap_total_mb`: 总堆内存（MB）
- `rss_mb`: 进程内存（MB）
- `startup_time_ms`: 启动时间（ms）
