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

export class Tracker {
  constructor(options = {}) {
    this.projectId = options.projectId || PROJECT_ID;
    this.endpoint = options.endpoint || BASE_ENDPOINT;
    this.context = { ...DEFAULT_CONTEXT, ...(options.context || {}) };
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

  persistSession(lastActive) {
    setStorage(this.sessionKey, {
      sessionId: this.sessionId,
      lastActive,
    });
  }

  touchSession() {
    this.persistSession(Date.now());
  }

  updateContext(extra = {}) {
    this.context = { ...this.context, ...extra };
  }

  withContext(payload = {}) {
    return {
      ...this.context,
      ...payload,
    };
  }

  track(eventName, payload = {}) {
    const event = {
      event_name: eventName,
      event_time: Date.now(),
      session_id: this.sessionId,
      project_id: this.projectId,
      ...this.withContext(payload),
    };
    this.queue.push(event);
    this.touchSession();
    this.scheduleFlush();
    return event;
  }

  scheduleFlush() {
    if (this.queue.length >= FLUSH_POLICY.MAX_BATCH_SIZE) {
      this.flush(true);
      return;
    }
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flush(true);
    }, FLUSH_POLICY.MAX_WAITING_MS);
  }

  flush(force = false) {
    if (!force && this.queue.length === 0) return;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const batch = this.queue.splice(0, this.queue.length);
    if (batch.length === 0) return;

    uni.request({
      url: `${this.endpoint}/events/batch`,
      method: 'POST',
      data: {
        project_id: this.projectId,
        events: batch,
      },
      success: () => {},
      fail: () => {
        this.queue.unshift(...batch);
      },
      complete: () => {
        this.flushTimer = null;
      },
    });
  }

  resetSession() {
    this.sessionId = generateUUID();
    this.persistSession(Date.now());
  }
}

const trackerSingleton = new Tracker();
export default trackerSingleton;
