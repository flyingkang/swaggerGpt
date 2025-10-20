<script>
import tracker from '@/analytics/tracker';
import { buildAnalyticsContext, buildUrlFromOptions } from '@/analytics/context';

function safeGetSystemInfo() {
  try {
    return uni.getSystemInfoSync();
  } catch (error) {
    console.warn('getSystemInfoSync failed', error);
    return {};
  }
}

async function updateContextFromOptions(options = {}) {
  const query = options.query || {};
  const systemInfo = safeGetSystemInfo();
  const fallbackUrl = buildUrlFromOptions({ ...options, ...query });
  const context = await buildAnalyticsContext(query, {
    systemInfo,
    existingContext: tracker.getContext(),
    currentUrl: fallbackUrl,
  });
  tracker.updateContext(context);
}

export default {
  async onLaunch(options) {
    await updateContextFromOptions(options);
  },
  async onShow(options) {
    await updateContextFromOptions(options);
  },
};
</script>

<style>
/* Intentionally left blank to keep global styles untouched. */
</style>
