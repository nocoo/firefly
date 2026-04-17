# Autoresearch Ideas: 内存优化

## 高优先级

### 1. Cache Handler 优化
- [ ] 缓存条目默认无限增长，考虑添加 LRU 淘汰策略
- [ ] `estimateSize()` 调用 `JSON.stringify()` 会创建临时字符串，考虑采样或延迟估算
- [ ] metadata Map 存储了重复的 tags 数组引用，考虑去重

### 2. Instrumentation 内存历史
- [ ] `memoryHistory` 数组 MAX_SAMPLES=2880，每个对象 ~100 bytes，约 288KB
- [ ] 考虑减少采样频率或使用更紧凑的存储格式

### 3. Redirect Cache
- [ ] 一次性加载所有 redirects 到内存
- [ ] 对于大量 redirect 规则，考虑按需查询或分片加载

## 中优先级

### 4. 依赖懒加载
- [ ] `sharp` 只在图片处理路由用到，考虑动态 import
- [ ] `@ai-sdk/*` 只在 AI 功能用到，考虑动态 import
- [ ] `recharts` 只在 admin 仪表盘用到，考虑代码分割

### 5. 减少模块初始化
- [ ] 检查全局常量的内存占用
- [ ] 检查静态数据结构是否可以延迟初始化

## 低优先级

### 6. Buffer/ArrayBuffer 复用
- [ ] 上传处理中的 Buffer 复制
- [ ] 检查是否有不必要的数据拷贝

### 7. 字符串驻留
- [ ] 检查重复字符串是否可以驻留
