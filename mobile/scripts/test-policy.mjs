/**
 * Checks when the app switches to offline mode and when the offline assistant may download itself (src/lib/modePolicy.ts):
 *
 *   node mobile/scripts/test-policy.mjs
 */
import { autoDownloadVerdict, GRACE_MS, isOnline, offlineModeNow, STORAGE_MARGIN, llmSupported, offlineModeApplies } from '../src/lib/modePolicy.ts';

let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };

console.log('1. online or not');
ok(isOnline({ connected: true, reachable: true }), 'connected and reachable is online');
ok(isOnline({ connected: true, reachable: null }), 'connected with the internet check not finished yet counts as online (no flash of the offline screen)');
ok(!isOnline({ connected: true, reachable: false }), 'a network that does not reach the internet is offline');
ok(!isOnline({ connected: false, reachable: null }), 'no network is offline');

console.log('2. offline mode starts after a grace period and ends at once');
const t = 1_000_000;
ok(!offlineModeNow(null, t), 'online: no offline mode');
ok(!offlineModeNow(t, t + 1000), 'one second without signal does not switch');
ok(!offlineModeNow(t, t + GRACE_MS - 1), 'just under the grace period does not switch');
ok(offlineModeNow(t, t + GRACE_MS), 'after the grace period it switches');
ok(!offlineModeNow(null, t + 99999), 'as soon as the phone is online again it switches back');

console.log('3. automatic download');
const MB = 1024 * 1024;
const wifi = { connected: true, reachable: true, type: 'wifi', expensive: false };
const base = { ready: false, enabled: true, net: wifi, freeBytes: 5000 * MB, remainingBytes: 769 * MB };
ok(autoDownloadVerdict(base).ok, 'on Wi-Fi with room it starts by itself');
ok(autoDownloadVerdict({ ...base, ready: true }).reason === 'ready', 'nothing to do when the assistant is already there');
ok(autoDownloadVerdict({ ...base, enabled: false }).reason === 'off', 'the person can turn it off');
ok(autoDownloadVerdict({ ...base, net: { ...wifi, connected: false } }).reason === 'offline', 'it waits while offline');
ok(autoDownloadVerdict({ ...base, net: { connected: true, reachable: true, type: 'cellular', expensive: true } }).reason === 'mobile_data', 'it does not use mobile data by itself');
ok(autoDownloadVerdict({ ...base, net: { connected: true, reachable: true, type: 'wifi', expensive: true } }).reason === 'mobile_data', 'a Wi-Fi hotspot that is metered counts as mobile data');
ok(autoDownloadVerdict({ ...base, net: { connected: true, reachable: true, type: 'unknown', expensive: null } }).reason === 'mobile_data', 'an unknown kind of network is treated as metered, to be safe');
ok(autoDownloadVerdict({ ...base, net: { connected: true, reachable: true, type: 'ethernet', expensive: false } }).ok, 'ethernet is fine');
ok(autoDownloadVerdict({ ...base, net: { connected: true, reachable: true, type: 'cellular', expensive: true }, allowMetered: true }).ok, 'the person can choose to download on mobile data');
ok(autoDownloadVerdict({ ...base, enabled: false, allowMetered: true, net: { connected: true, reachable: true, type: 'cellular', expensive: true } }).ok, 'choosing "download now" works even when the automatic download is off');
ok(autoDownloadVerdict({ ...base, freeBytes: 769 * MB + STORAGE_MARGIN - 1 }).reason === 'storage', 'it does not start without room for the file and a margin');
ok(autoDownloadVerdict({ ...base, freeBytes: 769 * MB + STORAGE_MARGIN }).ok, 'exactly enough room is enough');
ok(autoDownloadVerdict({ ...base, freeBytes: null }).ok, 'when the free space cannot be read it still tries');
ok(autoDownloadVerdict({ ...base, remainingBytes: 100 * MB, freeBytes: 600 * MB }).ok, 'a download that is partly done needs room only for the rest');

console.log('memory');
ok(autoDownloadVerdict({ ...base, memoryBytes: 1.8e9 }).reason === 'memory', 'a phone with about 2 GB of memory does not download the model');
ok(autoDownloadVerdict({ ...base, memoryBytes: 2.9e9 }).ok, 'a phone with about 3 GB of memory does');
ok(autoDownloadVerdict({ ...base, memoryBytes: null }).ok, 'an unknown amount of memory does not block the download');
ok(autoDownloadVerdict({ ...base, memoryBytes: 1.8e9, allowMetered: true }).reason === 'memory', 'choosing mobile data does not override the memory rule');

console.log('32-bit and 64-bit phones');
ok(llmSupported(['arm64-v8a', 'armeabi-v7a', 'armeabi']), 'a 64-bit phone (which also lists the 32-bit ones) can run the model');
ok(llmSupported(['x86_64', 'x86']), 'a 64-bit emulator can');
ok(!llmSupported(['armeabi-v7a', 'armeabi']), 'a phone with a 32-bit system cannot, whatever its processor');
ok(!llmSupported(['x86']), 'neither can a 32-bit emulator');
ok(llmSupported(null) && llmSupported([]) && llmSupported(undefined), 'an unknown list never blocks a phone');
ok(autoDownloadVerdict({ ...base, cpuAbis: ['armeabi-v7a'] }).reason === 'unsupported', 'a 32-bit phone does not download a model it cannot load');
ok(autoDownloadVerdict({ ...base, cpuAbis: ['armeabi-v7a'], allowMetered: true }).reason === 'unsupported', 'choosing mobile data does not override that');
ok(autoDownloadVerdict({ ...base, cpuAbis: ['arm64-v8a', 'armeabi-v7a'] }).ok, 'a 64-bit phone downloads as usual');

console.log('offline mode by phone type');
ok(offlineModeApplies(true, true), 'a 64-bit phone with no internet switches to the offline assistant');
ok(!offlineModeApplies(true, false), 'a 32-bit phone with no internet keeps the normal app (no offline assistant screen)');
ok(!offlineModeApplies(false, true) && !offlineModeApplies(false, false), 'with internet nobody is switched');

console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
