# Autoresearch Ideas: 内存优化

## 已完成

### 1. estimateSize() 优化 ✅
- 避免 JSON.stringify 创建临时字符串
- 改用启发式估算
- 效果：在噪声范围内（~0.3MB）

### 2. Tag 字符串驻留 ✅
- 添加 tag 字符串池避免重复分配
- 缓存条目共享 tags 数组引用
- 效果：在噪声范围内

## 已测试但无效

### Float64Array 存储 memoryHistory
- 固定分配 138KB (2880 * 6 * 8 bytes)
- 短期测试中历史记录不够多，看不出效果
- 可能在长期运行的服务器上有帮助

### --max-old-space-size=64
- 当前使用量已经在 64MB 以下
- 没有触发更积极的 GC

### 懒加载 memory collection
- timer 开销可忽略
- setInterval 不额外分配内存

### image cache TTL
- 基准测试不包含图片请求

## 结论

运行时 RSS 约 46MB，其中：
- 启动后约 39MB（Next.js + Node.js 核心）
- 请求处理后增长约 7MB（模块加载 + 缓存）

Next.js 框架本身的内存占用是主要部分。进一步优化需要：
- 检查生产环境的实际工作负载
- 考虑代码分割和动态导入
- 长期监控内存增长趋势
