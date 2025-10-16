<template>
  <view class="page-index" @scroll="handleScroll">
    <view class="banner" v-for="banner in banners" :key="banner.id" @tap="onBannerClick(banner.id)">
      <image :src="banner.image" mode="aspectFill" />
    </view>
    <view
      class="game-item"
      v-for="(game, idx) in games"
      :key="game.id"
      :data-game-id="game.id"
      :data-position="idx + 1"
      @tap="onGameClick(game, idx + 1, '游戏推荐')"
    >
      <text>{{ game.name }}</text>
    </view>
  </view>
</template>

<script>
import tracker from '@/analytics/tracker';
import { EVENTS } from '@/analytics/config';
import { observeGameExposure, resetExposureCache } from '@/analytics/exposure';

export default {
  data() {
    return {
      startTime: 0,
      banners: [],
      games: [],
      observer: null,
      scrollDepth: 0,
    };
  },
  onLoad(options) {
    const systemInfo = uni.getSystemInfoSync();
    const networkInfo = uni.getNetworkTypeSync();

    tracker.updateContext({
      user_id: options.userId,
      page_url: 'https://browserdev.hoorooplay.com',
      platform: options.platform || 'app',
      language: systemInfo.language,
      version_language: options.versionLanguage || 'zh',
      country: options.country || 'CN',
      os: systemInfo.platform,
      device_model: systemInfo.model,
      network_type: networkInfo.networkType,
      app_version: options.appVersion || '1.0.0',
      is_member: options.isMember === 'true',
      free_play_duration: Number(options.freePlayDuration || 0),
      entry_source: options.entrySource || 'unknown',
      watch_state: options.watchState === 'true',
    });

    this.startTime = Date.now();
  },
  onReady() {
    this.observer = observeGameExposure({
      vm: this,
      selector: '.game-item',
      pageName: '1',
      section: '游戏推荐',
    });
  },
  onShow() {
    resetExposureCache();
    this.startTime = Date.now();
  },
  onHide() {
    this.reportStayDuration();
    tracker.flush(true);
  },
  onUnload() {
    this.reportStayDuration();
    if (this.observer) {
      this.observer.disconnect();
    }
  },
  methods: {
    reportStayDuration() {
      const duration = Math.round((Date.now() - this.startTime) / 1000);
      tracker.track(EVENTS.PAGE_VIEW, {
        page_name: '1',
        duration_time: duration,
      });
    },
    onBannerClick(bannerId) {
      tracker.track(EVENTS.BANNER_CLICK, {
        page_name: '1',
        page_banner_id: bannerId,
      });
    },
    onGameClick(game, position, section) {
      tracker.track(EVENTS.PAGE_GAME_CLICK, {
        page_name: '1',
        game_id: game.id,
        position: `游戏推荐第${position}位`,
        section,
      });
    },
    handleScroll(event) {
      const scrollHeight = event.detail.scrollHeight || 1;
      const scrollTop = event.detail.scrollTop || 0;
      const viewHeight = event.detail.clientHeight || 1;
      const depth = Math.min(1, (scrollTop + viewHeight) / scrollHeight);
      const percent = Math.round(depth * 100);
      const milestones = [25, 50, 75, 100];
      const reached = milestones.find(m => percent >= m && m > this.scrollDepth);
      if (reached) {
        this.scrollDepth = reached;
        tracker.track(EVENTS.PAGE_SCROLL_DEPTH, {
          page_name: '1',
          scroll_depth: `${reached}%`,
        });
      }
    },
  },
};
</script>

<style scoped>
.page-index {
  display: flex;
  flex-direction: column;
}
.banner {
  width: 100%;
  height: 200rpx;
  margin-bottom: 16rpx;
}
.game-item {
  padding: 24rpx;
  border-bottom: 1rpx solid #eee;
}
</style>
