# H5 游戏页体感中心数据上报与指标体系方案

本方案针对体感浏览器 H5 游戏页，提供一套可跨项目复用的数据采集、事件上报与指标分析设计。方案涵盖以下内容：

- 埋点体系与公共字段约定
- 前端 SDK 架构与 session 管理
- 事件上报接口协议（模拟）
- 数据服务端存储设计
- 指标定义与可视化看板建议
- 实施与运维要点

> **备注**：所有统计数据默认排除游客用户（`memberType = 0` 且未登录）。

---

## 1. 埋点体系设计

### 1.1 公共参数

所有事件统一携带如下公共字段，便于多维分析：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `userId` | string | 用户唯一标识。优先使用客户端提供的 ID，缺失时由 `timezone` 派生 uuid。|
| `sessionId` | string | 30 分钟内无操作重置的会话 ID。|
| `eventTime` | number | 事件触发时间戳，毫秒级。|
| `pageUrl` | string | 事件发生页面的完整 URL。|
| `platform` | string | 访问来源（`sdk` / `app` / `web`）。|
| `language` | string | 设备语言（OS）。|
| `versionLanguage` | string | 页面语言版本（`zh-CN` / `en-US` 等）。|
| `country` | string | IP 解析的国家代码。|
| `os` | string | 操作系统（`iOS` / `Android` / `HarmonyOS` / `Other`）。|
| `deviceModel` | string | 设备型号。|
| `networkType` | string | 网络类型（`wifi` / `4g` / `5g` / `other`）。|
| `appVersion` | string | H5 页版本号。|
| `memberType` | integer | 是否会员（`1`=会员，`0`=非会员）。|
| `freePlayDuration` | number | 当前免费游玩剩余时长（秒）。|
| `entrySource` | string | 进入 H5 页入口来源。|
| `watchState` | integer | 手表连接状态（`1`=已连接，`0`=未连接）。|

### 1.2 Session 生成逻辑

1. 首次访问：生成 UUID 并存入 `localStorage`/`uni.setStorageSync('session_id')`。 
2. 每次事件触发前检查最近活动时间，若距离当前超过 30 分钟或浏览器关闭重新进入则刷新 session。 
3. 记录 `last_active_at` 时间戳，任何事件产生都更新。 

### 1.3 事件清单

#### 主页及 Tab2-4

| 事件 | 描述 | 额外参数 |
| --- | --- | --- |
| `page_view` | 离开页面时上报浏览时长 | `page_name`（"1"-"4"），`duration_time`（秒） |
| `banner_impression` | Banner 曝光 | `page_banner_id`，`page_name` |
| `banner_click` | Banner 点击 | `page_banner_id`，`page_name` |
| `page_game_impression` | 游戏曝光 ≥1s | `page_name`，`game_id`，`position`，`section` |
| `page_game_click` | 游戏点击 | `page_name`，`game_id`，`position`，`section` |
| `page_scroll_depth` | 滑动深度 | `page_name`，`scroll_depth`（25/50/75/100） |
| `page_more_click` | 点击更多 | `page_name`，`section` |
| `topic_impression` | 专题曝光 | `page_topic_id`，`page_name` |

#### 游戏专题详情页

| 事件 | 描述 | 参数 |
| --- | --- | --- |
| `game_detail_view` | 离开页面时上报停留时长 | `game_id`，`duration_time`，`section`（专题 ID） |
| `start_game_click` | 启动游戏 | `game_id`，`section` |

#### 分类 Tab（第 5 个）

| 事件 | 描述 | 参数 |
| --- | --- | --- |
| `category_page_view` | 页面浏览 | `page_name="分类页"`，`duration_time` |
| `category_click` | 分类点击 | `category_name` |
| `topic_game_impression` | 游戏曝光 | `game_id`，`position` |
| `category_game_click` | 游戏点击 | `game_id`，`position` |

#### 游戏会话

| 事件 | 描述 | 参数 |
| --- | --- | --- |
| `game_session_end` | 游戏返回我方页面视为结束 | `game_id`，`session_duration`（秒），`entry_source`（推荐/专题/category/banner） |

#### 付费链路

| 事件 | 描述 | 参数 |
| --- | --- | --- |
| `payment_popup_view` | 付费弹窗曝光 | `game_id`，`trigger_reason`（如 `free_time_up`） |
| `payment_popup_click` | 弹窗按钮点击 | `game_id`，`button_name`（付费/关闭） |
| `payment_success` | 付费成功 | `game_id`，`amount`（单位：元） |

---

## 2. 前端 SDK 通用方案（Vue2 + uni-app）

### 2.1 文件结构建议

```
src/
  analytics/
    tracker.js         // 核心埋点 SDK
    exposure.js        // 曝光监听工具
    storage.js         // 持久化工具封装
    config.js          // 常量、事件枚举
```

### 2.2 Tracker 核心能力

1. **初始化**：注入基础上下文（用户、语言、入口等）和接口配置。
2. **Session 管理**：自动维护 `session_id` 与 `last_active_at`。
3. **事件缓冲**：事件入队列，批量或单发上报；失败自动重试。
4. **曝光判定**：支持 IntersectionObserver/H5 滚动监听。
5. **自动页面停留**：在 `onHide` / `onUnload` 钩子中统计停留时间。
6. **多项目复用**：通过 `config.js` 配置项目 ID、上报域名。

### 2.3 Tracker 接口示例

```javascript
// src/analytics/tracker.js（简化版，详见源码）
import { getStorage, setStorage } from './storage';
import {
  BASE_ENDPOINT,
  PROJECT_ID,
  DEFAULT_CONTEXT,
  FLUSH_POLICY,
  SESSION_TIMEOUT,
} from './config';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class Tracker {
  constructor(options = {}) {
    this.projectId = options.projectId || PROJECT_ID;
    this.endpoint = options.endpoint || BASE_ENDPOINT;
    this.contextKey = options.contextKey || 'tracker_persistent_context';
    const cachedContext = getStorage(this.contextKey) || {};
    this.context = { ...DEFAULT_CONTEXT, ...cachedContext, ...(options.context || {}) };
    this.queue = [];
    this.flushTimer = null;
    this.sessionKey = options.sessionKey || 'tracker_session_info';
    this.initSession();
  }

  initSession() {
    const now = Date.now();
    const cached = getStorage(this.sessionKey);
    if (cached && cached.sessionId && now - cached.lastActive < SESSION_TIMEOUT) {
      this.sessionId = cached.sessionId;
    } else {
      this.sessionId = generateUUID();
    }
    this.persistSession(now);
  }

  updateContext(extra = {}) {
    this.context = { ...this.context, ...extra };
    setStorage(this.contextKey, this.context);
  }

  track(eventName, payload = {}) {
    const event = {
      eventName,
      eventTime: Date.now(),
      sessionId: this.sessionId,
      projectId: this.projectId,
      context: { ...this.context },
      payload,
    };
    this.queue.push(event);
    this.persistSession(Date.now());
    this.scheduleFlush();
  }

  scheduleFlush() {
    if (this.queue.length >= FLUSH_POLICY.MAX_BATCH_SIZE) {
      this.flush(true);
      return;
    }
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => this.flush(true), FLUSH_POLICY.MAX_WAITING_MS);
  }

  flush(force = false) {
    if (!force && this.queue.length === 0) return;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    const batch = this.queue.splice(0, this.queue.length);
    if (batch.length === 0) return;
    batch.forEach(event => this.dispatchEvent(event));
  }

  dispatchEvent(event) {
    const payload = this.buildRequestPayload(event);
    uni.request({
      url: this.endpoint,
      method: 'POST',
      data: payload,
      fail: () => {
        this.queue.unshift(event);
        this.scheduleFlush();
      },
      complete: () => {
        this.flushTimer = null;
      },
    });
  }

  buildRequestPayload(event) {
    const { eventName, eventTime, sessionId, context = {}, payload = {} } = event;
    const booleanToInt = value => (value ? 1 : 0);
    return {
      userId: context.userId,
      appVersion: context.appVersion,
      country: context.country,
      deviceModel: context.deviceModel,
      entrySource: context.entrySource,
      eventName,
      eventPara: JSON.stringify(payload || {}),
      eventTime,
      freePlayDuration: Number(context.freePlayDuration || 0),
      language: context.language,
      memberType:
        typeof context.memberType !== 'undefined'
          ? Number(context.memberType)
          : booleanToInt(context.isMember),
      networkType: context.networkType,
      os: context.os,
      pageUrl: context.pageUrl,
      platform: context.platform,
      sessionId,
      versionLanguage: context.versionLanguage,
      watchState: booleanToInt(context.watchState),
    };
  }
}

export default new Tracker();
```

### 2.4 事件封装示例

```javascript
// src/analytics/config.js
export const BASE_ENDPOINT = 'https://api.mock-analytics.com/smhl/outer/browser/web/track';

export const EVENTS = {
  PAGE_VIEW: 'page_view',
  BANNER_CLICK: 'banner_click',
  BANNER_IMPRESSION: 'banner_impression',
  PAGE_GAME_IMPRESSION: 'page_game_impression',
  PAGE_GAME_CLICK: 'page_game_click',
  PAGE_SCROLL_DEPTH: 'page_scroll_depth',
  PAGE_MORE_CLICK: 'page_more_click',
  GAME_DETAIL_VIEW: 'game_detail_view',
  START_GAME_CLICK: 'start_game_click',
  CATEGORY_PAGE_VIEW: 'category_page_view',
  CATEGORY_CLICK: 'category_click',
  TOPIC_GAME_IMPRESSION: 'topic_game_impression',
  TOPIC_IMPRESSION: 'topic_impression',
  CATEGORY_GAME_CLICK: 'category_game_click',
  GAME_SESSION_END: 'game_session_end',
  PAYMENT_POPUP_VIEW: 'payment_popup_view',
  PAYMENT_POPUP_CLICK: 'payment_popup_click',
  PAYMENT_SUCCESS: 'payment_success',
};

export const DEFAULT_CONTEXT = Object.freeze({
  platform: 'web',
  language: 'zh-CN',
  versionLanguage: 'zh',
  country: 'CN',
  os: 'other',
  deviceModel: '',
  networkType: 'wifi',
  appVersion: '1.0.0',
  isMember: false,
  freePlayDuration: 0,
  entrySource: 'unknown',
  watchState: false,
  pageUrl: '',
});
```

```javascript
// src/analytics/storage.js
export function getStorage(key) {
  try {
    return uni.getStorageSync(key);
  } catch (error) {
    return null;
  }
}

export function setStorage(key, value) {
  try {
    uni.setStorageSync(key, value);
  } catch (error) {
    console.warn('setStorage failed', error);
  }
}
```

### 2.5 页面集成示例

```javascript
// pages/index/index.vue（片段）
import tracker from '@/analytics/tracker';
import { buildAnalyticsContext } from '@/analytics/context';
import { EVENTS } from '@/analytics/config';
import {
  observeBannerExposure,
  observeGameExposure,
  observeTopicExposure,
  resetExposureCache,
} from '@/analytics/exposure';

export default {
  data() {
    return {
      startTime: 0,
      hasReportedStayDuration: false,
      scrollDepth: 0,
    };
  },
  async onLoad(options) {
    let systemInfo = {};
    try {
      systemInfo = uni.getSystemInfoSync();
    } catch (error) {
      console.warn('getSystemInfoSync failed', error);
    }

    const analyticsOptions = await buildAnalyticsContext(options, {
      systemInfo,
      existingContext: tracker.getContext(),
      currentUrl: typeof window !== 'undefined' ? window.location.href : '',
    });

    tracker.updateContext(analyticsOptions);
    this.hasReportedStayDuration = false;
    this.startTime = Date.now();
  },
  onReady() {
    this.gameObserver = observeGameExposure({
      vm: this,
      selector: '.game-item',
      pageName: '1',
      section: '游戏推荐',
    });
    this.bannerObserver = observeBannerExposure({ vm: this, selector: '.banner', pageName: '1' });
    this.topicObserver = observeTopicExposure({ vm: this, selector: '.topic-item', pageName: '1' });
  },
  onShow() {
    resetExposureCache();
    this.hasReportedStayDuration = false;
    this.startTime = Date.now();
  },
  onHide() {
    this.reportStayDuration();
    tracker.flush(true);
  },
  onUnload() {
    this.reportStayDuration();
    [this.gameObserver, this.bannerObserver, this.topicObserver]
      .filter(Boolean)
      .forEach(observer => observer.disconnect());
  },
};
```


### 2.6 曝光监听工具示例

```javascript
// src/analytics/exposure.js
import tracker from './tracker';
import { EVENTS } from './config';

export function observeGameExposure({ vm, selector, pageName, section }) {
  const observer = uni.createIntersectionObserver(vm, {
    thresholds: [0.5],
  });

  observer.relativeToViewport().observe(selector, res => {
    const {
      intersectionRatio,
      dataset: { gameId, position },
    } = res;
    if (intersectionRatio >= 0.5 && gameId) {
      tracker.track(EVENTS.PAGE_GAME_IMPRESSION, {
        page_name: pageName,
        game_id: gameId,
        position,
        section,
      });
    }
  });

  return observer;
}
```

### 2.7 上报策略

- 默认实时发送；在低网速下可以设置批量（例如 5 条或 5 秒触发）。
- 网络失败：将事件压回队列并在下次 `flush()` 时重试。
- 离线场景：可结合 `onHide` 存储本地，网络恢复后统一上报。
- 性能监控：控制每次请求 payload < 20KB，避免阻塞主线程。

---

## 3. 模拟上报接口设计

### 3.1 HTTP 请求

- **URL**：`POST https://api.mock-analytics.com/smhl/outer/browser/web/track`
- **Header**：`Content-Type: application/json`
- **Body**：

```json
{
  "userId": "u123",
  "sessionId": "b8e...",
  "eventName": "page_view",
  "eventTime": 1714300000000,
  "eventPara": "{\"page_name\":\"1\",\"duration_time\":45}",
  "pageUrl": "https://browserdev.hoorooplay.com/",
  "platform": "app",
  "language": "zh-CN",
  "versionLanguage": "zh",
  "country": "CN",
  "os": "iOS",
  "deviceModel": "iPhone15,3",
  "networkType": "Wi-Fi",
  "appVersion": "1.2.0",
  "memberType": 1,
  "freePlayDuration": 0,
  "entrySource": "push",
  "watchState": 0
}
```

### 3.2 响应

```json
{
  "code": 0,
  "message": "ok"
}
```

### 3.3 安全与容错

- 使用 HTTPS + 鉴权头（如 `X-Api-Key`）。
- 服务端对事件字段做 schema 校验，异常记录并返回错误码。
- 过滤 `memberType = 0` 的数据后再入库。

---

## 4. 服务端数据设计

### 4.1 数据流

1. **接入层**：Nginx / API Gateway 校验签名。
2. **采集服务**：Node.js/Go 接收事件，写入 Kafka / RabbitMQ。
3. **实时处理**：Flink / Spark Streaming 过滤游客、补齐维度。
4. **落地存储**：
   - 明细：ClickHouse / BigQuery `fact_events`
   - 维度：`dim_game`, `dim_topic`, `dim_country`
5. **BI 工具**：DataStudio / Superset 构建看板。

### 4.2 明细表字段示例

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `event_date` | date | 分区字段，`event_time` 转化。|
| `event_time` | datetime | 毫秒时间戳。|
| `event_name` | string | 事件名。|
| `user_id` | string | 非游客用户 ID。|
| `session_id` | string | 会话 ID。|
| `page_url` | string | 页面 URL。|
| `page_name` | string | 页面名称（可空）。|
| `game_id` | string | 游戏 ID（可空）。|
| `section` | string | 模块来源。|
| `position` | string | 位置信息。|
| `category_name` | string | 分类名称。|
| `duration_time` | int | 停留时长。|
| `session_duration` | int | 游戏会话时长。|
| `amount` | decimal | 付费金额。|
| `country` | string | 国家。|
| `language` | string | 设备语言。|
| `version_language` | string | 页面语言版本。|
| `platform` | string | 平台。|
| `os` | string | 操作系统。|
| `device_model` | string | 设备型号。|
| `network_type` | string | 网络类型。|
| `entry_source` | string | 入口来源。|
| `watch_state` | boolean | 手表连接状态。|
| `member_type` | tinyint | 是否会员（1=会员，0=游客）。|

### 4.3 维度表

- `dim_game`：`game_id`, `game_name`, `genre`, `developer`, `release_date`。
- `dim_topic`：`topic_id`, `topic_name`, `curator`, `priority`。
- `dim_country`：`country_code`, `country_name`, `region`。

---

## 5. 指标体系与看板

### 5.1 用户行为漏斗

1. 访问 H5 页用户数（按国家/设备拆分）。
2. 游戏曝光用户数（曝光 ≥1 次）。
3. 游戏点击用户数。
4. 游戏启动用户数。
5. 游戏会话完成数（session_duration ≥30s）。
6. 付费弹窗曝光用户数。
7. 付费点击用户数。
8. 付费成功用户数与金额。

### 5.2 转化与留存

- 页面停留均值、分位数。
- `entry_source` 维度的启动率、付费率。
- `watch_state` 对付费成功率的影响。
- 游戏偏好热度榜：按 `page_game_click` 计数。
- 免费时长使用率：`free_play_duration` 消耗与续费情况。

### 5.3 看板模块建议

1. **实时监控**：UV、PV、会话数、付费实时流水。 
2. **路径分析**：用户从入口到付费的 Sankey 图。 
3. **国家/语言对比**：地图/柱状展示。 
4. **设备表现**：不同设备/网络下的跳出率、时长。 
5. **专题运营**：专题曝光、点击、启动、付费表现。 

---

## 6. 实施步骤

1. **需求梳理**：与产品确认所有事件触发条件。 
2. **字段映射**：客户端确保能提供公共字段，如手表状态。 
3. **SDK 集成**：在 `App.vue` 初始化 tracker，绑定生命周期。 
4. **事件埋点**：按页面组件实现具体事件。 
5. **联调测试**：使用抓包工具（Charles）确认字段完整。 
6. **灰度发布**：先在小流量渠道验证指标。 
7. **看板搭建**：BI 工具接入 ClickHouse 建模。 
8. **迭代优化**：根据运营反馈扩展事件或字段。 

---

## 7. 运维与质量保障

- **日志留存**：客户端打印关键事件日志，方便排查。 
- **抽样校验**：每日抽取用户行为与后台日志比对。 
- **告警**：指标突降时触发企业微信/钉钉告警。 
- **版本控制**：埋点 SDK 使用 npm 私有仓库管理版本。 
- **隐私合规**：披露数据采集范围，遵守 GDPR/网络安全法。 

---

## 8. 附：事件到指标映射

| 事件 | 指标 | 计算公式 |
| --- | --- | --- |
| `page_view` | 页面停留均值 | `avg(duration_time)` |
| `page_scroll_depth` | 页面阅读深度 | `distribution(scroll_depth)` |
| `page_game_impression` | 游戏曝光人数 | 去重 `user_id` |
| `page_game_click` | 点击率 | `count(click)/count(impression)` |
| `start_game_click` | 启动率 | `count(start_game_click)/count(page_game_click)` |
| `game_session_end` | 游戏会话均时长 | `avg(session_duration)` |
| `payment_popup_view` | 付费漏斗起点 | - |
| `payment_popup_click` | 付费点击率 | `count(payment_popup_click)/count(payment_popup_view)` |
| `payment_success` | 转化率 & ARPU | `count(success)/count(view)`，`sum(amount)/user_count` |

通过以上方案，可快速搭建跨项目复用的埋点体系，支持体感浏览器 H5 游戏页在用户来源、行为路径、游戏偏好及付费表现等维度的精细化分析。
