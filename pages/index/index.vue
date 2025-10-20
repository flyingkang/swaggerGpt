<template>
  <view class="page-index" @scroll="handleScroll">
    <view
      class="banner"
      v-for="banner in banners"
      :key="banner.id"
      :data-banner-id="banner.id"
      @tap="onBannerClick(banner.id)"
    >
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
      banners: [],
      games: [],
      gameObserver: null,
      bannerObserver: null,
      topicObserver: null,
      scrollDepth: 0,
      hasReportedStayDuration: false,
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

    this.bannerObserver = observeBannerExposure({
      vm: this,
      selector: '.banner',
      pageName: '1',
    });

    this.topicObserver = observeTopicExposure({
      vm: this,
      selector: '.topic-item',
      pageName: '1',
    });
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
    this.gameObserver = null;
    this.bannerObserver = null;
    this.topicObserver = null;
  },
  methods: {
    async fetchNetworkType() {
      if (typeof uni.getNetworkType !== 'function') {
        return 'unknown';
      }

      return new Promise(resolve => {
        uni.getNetworkType({
          success: res => resolve(res.networkType),
          fail: () => resolve('unknown'),
        });
      });
    },
    normalizeAnalyticsOptions(rawOptions = {}) {
      const decode = value => {
        if (typeof value !== 'string') {
          return value;
        }
        try {
          return decodeURIComponent(value);
        } catch (err) {
          return value;
        }
      };

      const booleanFromString = value => {
        if (typeof value === 'boolean') {
          return value;
        }
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true';
        }
        return false;
      };

      const numberFromString = value => {
        if (typeof value === 'number') {
          return value;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      };

      const pageUrl = decode(
        rawOptions.pageUrl || rawOptions.url || 'https://browserdev.hoorooplay.com'
      );

      return {
        userId: rawOptions.userId || rawOptions.user_id || '',
        pageUrl,
        platform: rawOptions.platform || 'app',
        versionLanguage: rawOptions.versionLanguage || rawOptions.version_language || 'zh',
        country: rawOptions.country || 'CN',
        appVersion: rawOptions.appVersion || rawOptions.app_version || '1.0.0',
        isMember: booleanFromString(rawOptions.isMember ?? rawOptions.is_member),
        freePlayDuration: numberFromString(
          rawOptions.freePlayDuration ?? rawOptions.free_play_duration
        ),
        entrySource: rawOptions.entrySource || rawOptions.entry_source || 'unknown',
        watchState: booleanFromString(rawOptions.watchState ?? rawOptions.watch_state),
      };
    },
    reportStayDuration() {
      if (this.hasReportedStayDuration || !this.startTime) {
        return;
      }
      this.hasReportedStayDuration = true;
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
