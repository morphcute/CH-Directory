import { test } from "node:test";
import assert from "node:assert/strict";
import {
  registerViewer,
  removeViewer,
  getLiveViewerCount,
  isBotUserAgent,
  subscribeViewerCount,
  _resetLiveViewers,
} from "../src/server/liveViewerStore";

test("liveViewerStore: starts at 0 and increments with genuine viewer", () => {
  _resetLiveViewers();
  assert.equal(getLiveViewerCount(), 0);

  const count1 = registerViewer("user_1", "192.168.1.1", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
  assert.equal(count1, 1);
  assert.equal(getLiveViewerCount(), 1);
});

test("liveViewerStore: deduplicates multiple tabs from same device token", () => {
  _resetLiveViewers();
  const deviceToken = "device_token_abc";

  // Simulate 3 tabs opening on the same device with same token
  registerViewer(deviceToken, "192.168.1.1", "Mozilla/5.0");
  registerViewer(deviceToken, "192.168.1.1", "Mozilla/5.0");
  const count = registerViewer(deviceToken, "192.168.1.1", "Mozilla/5.0");

  assert.equal(count, 1, "Multiple tabs from same device token must count as 1 viewer");
  assert.equal(getLiveViewerCount(), 1);
});

test("liveViewerStore: increments for distinct devices", () => {
  _resetLiveViewers();
  registerViewer("device_1", "192.168.1.1", "Mozilla/5.0");
  registerViewer("device_2", "192.168.1.2", "Mozilla/5.0");
  const count = registerViewer("device_3", "192.168.1.3", "Mozilla/5.0");

  assert.equal(count, 3);
  assert.equal(getLiveViewerCount(), 3);
});

test("liveViewerStore: filters out automated web bots and crawlers", () => {
  _resetLiveViewers();

  assert.equal(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), true);
  assert.equal(isBotUserAgent("curl/7.68.0"), true);
  assert.equal(isBotUserAgent("python-requests/2.25.1"), true);
  assert.equal(isBotUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"), false);

  // Attempting to register with bot user agent should be rejected
  const count = registerViewer("bot_1", "192.168.1.5", "Googlebot/2.1");
  assert.equal(count, 0, "Bot user agent must not increase viewer count");
  assert.equal(getLiveViewerCount(), 0);
});

test("liveViewerStore: restricts single IP flooding (max 5 devices per IP)", () => {
  _resetLiveViewers();
  const spamIp = "10.0.0.99";

  for (let i = 1; i <= 5; i++) {
    registerViewer(`device_${i}`, spamIp, "Mozilla/5.0");
  }
  assert.equal(getLiveViewerCount(), 5);

  // 6th device from same IP should be blocked from inflating count
  const count6 = registerViewer("device_6", spamIp, "Mozilla/5.0");
  assert.equal(count6, 5, "Excessive devices from same IP must be throttled");
  assert.equal(getLiveViewerCount(), 5);
});

test("liveViewerStore: removes viewer immediately on leave beacon", () => {
  _resetLiveViewers();
  registerViewer("device_leave_1", "192.168.1.1", "Mozilla/5.0");
  registerViewer("device_leave_2", "192.168.1.2", "Mozilla/5.0");
  assert.equal(getLiveViewerCount(), 2);

  const remaining = removeViewer("device_leave_1");
  assert.equal(remaining, 1);
  assert.equal(getLiveViewerCount(), 1);

  const empty = removeViewer("device_leave_2");
  assert.equal(empty, 0);
  assert.equal(getLiveViewerCount(), 0);
});

test("liveViewerStore: notifies subscribers on presence changes", () => {
  _resetLiveViewers();
  const recordedCounts: number[] = [];
  const unsubscribe = subscribeViewerCount((count) => {
    recordedCounts.push(count);
  });

  registerViewer("sub_device_1", "192.168.1.1", "Mozilla/5.0");
  registerViewer("sub_device_2", "192.168.1.2", "Mozilla/5.0");
  removeViewer("sub_device_1");

  unsubscribe();
  registerViewer("sub_device_3", "192.168.1.3", "Mozilla/5.0");

  assert.deepEqual(recordedCounts, [1, 2, 1]);
});
