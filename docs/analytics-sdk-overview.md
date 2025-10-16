# 埋点 SDK 使用与架构说明

本文档对仓库中的 `src/analytics` 目录进行拆解，帮助快速理解其实现逻辑、在项目中的使用方式，以及当前方案的优缺点。

## 1. 核心设计逻辑

### 1.1 Tracker 事件采集器

`Tracker` 是对外暴露的埋点入口，负责管理会话、公共上下文与事件发送流程：

1. **会话管理**：
   - 初始化时读取 `localStorage/uni-storage` 中的 `session_id` 与最近活跃时间；
   - 超过 `SESSION_TIMEOUT`（默认 30 分钟）则重新生成 `session_id`；
   - 每次调用 `track` 会刷新活跃时间，确保同一会话内事件打通。
2. **公共上下文**：
   - 通过 `updateContext` 维护公共字段（如 `user_id`、`page_url`）；
   - `track` 会将公共字段与事件私有字段合并后入队，保证所有事件携带一致的分析维度。
3. **事件队列与批量上报**：
   - 事件被 push 到内存队列，达到 `FLUSH_POLICY.MAX_BATCH_SIZE` 或超过 `MAX_WAITING_MS` 自动触发 `flush`；
   - 统一走 `uni.request` 发送到 `/events/batch` 接口，失败会将事件回滚到队列等待下次发送。

### 1.2 Exposure 曝光监听

`observeGameExposure` 基于 `IntersectionObserver`，自动监听元素进入视口的时间，满足“至少曝光 1 秒”后回调 `tracker.track`。这样可以减少手写曝光逻辑的重复代码。

### 1.3 Storage 抽象

`getStorage` / `setStorage` 统一封装 `uni.getStorageSync` 与 `uni.setStorageSync`，便于未来扩展到其他框架时替换为不同的持久化方式。

### 1.4 配置集中管理

`config.js` 汇总事件枚举、默认上下文、批量策略与后端地址。保持常量集中，便于多项目复用以及统一更新。

## 2. 如何接入使用

1. **初始化公共上下文**（在页面 `onLoad` 或登录后调用）：
   ```js
   import tracker from '@/analytics/tracker';
   import { EVENTS } from '@/analytics/config';

   tracker.updateContext({
     user_id: options.userId,
     page_url: 'https://browserdev.hoorooplay.com',
     platform: options.platform || 'app',
     // ...其余公共字段
   });
   ```
2. **记录页面停留时长**：
   ```js
   const start = Date.now();
   // 离开页面时调用
   tracker.track(EVENTS.PAGE_VIEW, {
     page_name: '1',
     duration_time: Math.round((Date.now() - start) / 1000),
   });
   ```
3. **曝光监听**：
   ```js
   import { observeGameExposure } from '@/analytics/exposure';

   const observer = observeGameExposure({
     vm: this,
     selector: '.game-item',
     pageName: '1',
     section: '游戏推荐',
   });
   // 页面销毁时记得 disconnect
   ```
4. **用户交互事件**：
   ```js
   tracker.track(EVENTS.PAGE_GAME_CLICK, {
     page_name: '1',
     game_id: game.id,
     position: `游戏推荐第${index}位`,
     section: '游戏推荐',
   });
   ```
5. **主动刷新队列（可选）**：在 `onHide` 或切后台时执行 `tracker.flush(true)`，避免临时退出导致数据滞留。

## 3. 方案优点

- **跨项目可移植**：所有配置集中在 `config.js`，更换项目只需调整枚举与后端地址。
- **公共字段自动注入**：减少每次埋点手动拼装公共参数的重复工作，提高准确性。
- **批量传输减少请求**：队列 + 批量上报机制在高频事件场景下可显著降低网络开销。
- **曝光监听封装**：内置曝光计时逻辑，满足“曝光 ≥ 1 秒”的准确统计需求。
- **易于扩展**：存储、上报方式均单独封装，后续可替换为离线缓存、本地数据库等实现。

## 4. 当前限制与潜在优化

- **缺乏离线持久化**：队列仅存在内存中，如果应用被强制关闭，未上报事件会丢失。可考虑落地到本地缓存，重启后重放。
- **错误重试策略简单**：目前失败后仅回滚队列，没有退避重试或失败告警；复杂项目需补充重试与日志采集。
- **仅适配 uni-app**：`uni` 相关 API 写死在实现中，在纯 Web 环境需替换为浏览器 API。
- **曝光监听依赖 IntersectionObserver**：在低端机或不支持的环境需要降级策略（例如滚动监听计算）。
- **缺乏类型约束**：当前项目未引入 TypeScript/类型校验，容易出现字段拼写错误，可通过定义事件 Schema 或 TS 接口改进。

了解以上逻辑后，可按需扩展事件枚举、补充后端接口联调以及与指标看板串联，实现完整的数据驱动闭环。
