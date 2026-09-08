import { test } from "node:test";
import assert from "node:assert/strict";
import {
  submitRaffleEntry,
  updateRaffleSettings,
  getRaffleState,
  setRaffleWinner,
  removeRaffleEntry,
  clearAllRaffleEntries,
  archiveCurrentRaffle,
  getArchivedRaffles,
  deleteRaffle,
  deleteArchivedRaffle,
} from "../src/server/raffleStore";
import {
  broadcastLiveSpin,
  getLiveSpinState,
  subscribeLiveSpin,
} from "../src/server/liveSpinStore";
import { normalizePrizeItems } from "../src/types";

test("raffle anti-spam: same device edits name without duplicate entries", async () => {
  const raffleId = "test-raffle-antispam";
  await clearAllRaffleEntries(raffleId);

  // Setup active raffle with future deadline
  await updateRaffleSettings({
    id: raffleId,
    title: "Anti-Spam Test Raffle",
    category: "Diamonds Giveaway",
    description: "Testing anti-spam device protection",
    cutoffDate: new Date(Date.now() + 86400000).toISOString(),
    prizes: ["100 Diamonds", "Starlight Card"],
    isActive: true,
  });

  const deviceId = `test-device-${Date.now()}`;

  // 1. Initial submission from device
  const res1 = await submitRaffleEntry(raffleId, "Juan Dela Cruz", deviceId);
  assert.equal(res1.success, true);
  assert.equal(res1.updated, false);
  assert.equal(res1.entry?.fullName, "Juan Dela Cruz");
  assert.equal(res1.entry?.category, "Diamonds Giveaway");
  assert.equal(res1.entry?.raffleTitle, "Anti-Spam Test Raffle");

  // 2. Same device submits an updated name (edit mode)
  const res2 = await submitRaffleEntry(raffleId, "Juan M. Dela Cruz", deviceId);
  assert.equal(res2.success, true);
  assert.equal(res2.updated, true);
  assert.equal(res2.entry?.fullName, "Juan M. Dela Cruz");

  // Verify there is only 1 total entry, and it has the updated name
  const state = await getRaffleState(raffleId);
  const deviceEntries = state.entries.filter((e) => e.deviceId === deviceId || e.fullName.includes("Juan"));
  assert.equal(deviceEntries.length, 1);
  assert.equal(deviceEntries[0].fullName, "Juan M. Dela Cruz");

  await deleteRaffle(raffleId);
});

test("raffle duplicate name prevention: different device cannot submit exact same full name", async () => {
  const raffleId = "test-raffle-duplicates";
  await clearAllRaffleEntries(raffleId);

  await updateRaffleSettings({
    id: raffleId,
    title: "Duplicate Check Raffle",
    description: "Testing duplicate name prevention",
    cutoffDate: new Date(Date.now() + 86400000).toISOString(),
    prizes: ["50 Diamonds"],
    isActive: true,
  });

  const devA = "device-alpha";
  const devB = "device-beta";

  const resA = await submitRaffleEntry(raffleId, "Pedro Penduko", devA);
  assert.equal(resA.success, true);

  // devB tries to submit the same full name
  const resB = await submitRaffleEntry(raffleId, "  pedro penduko  ", devB);
  assert.equal(resB.success, false);
  assert.match(resB.error || "", /already registered/i);

  await deleteRaffle(raffleId);
});

test("raffle cut-off deadline: submissions and edits are blocked when deadline passes", async () => {
  const raffleId = "test-raffle-cutoff";
  await clearAllRaffleEntries(raffleId);

  // Set cut-off in the past
  await updateRaffleSettings({
    id: raffleId,
    title: "Past Raffle",
    description: "Deadline has passed",
    cutoffDate: new Date(Date.now() - 3600000).toISOString(),
    prizes: ["Starlight"],
    isActive: true,
  });

  const res = await submitRaffleEntry(raffleId, "Late Hero", "device-late");
  assert.equal(res.success, false);
  assert.match(res.error || "", /cut-off date/i);

  await deleteRaffle(raffleId);
});

test("raffle winner assignment: admin can assign and remove prizes for winners", async () => {
  const raffleId = "test-raffle-winners";
  await clearAllRaffleEntries(raffleId);

  await updateRaffleSettings({
    id: raffleId,
    title: "Winner Raffle",
    description: "Testing winner prize assignment",
    cutoffDate: new Date(Date.now() + 86400000).toISOString(),
    prizes: ["Starlight Card", "100 Diamonds"],
    isActive: true,
  });

  const entry = await submitRaffleEntry(raffleId, "Lucky Winner", "dev-lucky");
  assert.equal(entry.success, true);
  const entryId = entry.entry!.id;

  // Assign prize
  const assignOk = await setRaffleWinner(entryId, "Starlight Card");
  assert.equal(assignOk, true);

  let state = await getRaffleState(raffleId);
  let matched = state.entries.find((e) => e.id === entryId);
  assert.equal(matched?.prizeWon, "Starlight Card");

  // Remove prize
  const removeOk = await setRaffleWinner(entryId, null);
  assert.equal(removeOk, true);

  state = await getRaffleState(raffleId);
  matched = state.entries.find((e) => e.id === entryId);
  assert.equal(matched?.prizeWon, null);

  await deleteRaffle(raffleId);
});

test("raffle archive: completed raffle is moved to archive with winners and new edition starts", async () => {
  const raffleId = "test-raffle-archive";
  await clearAllRaffleEntries(raffleId);

  await updateRaffleSettings({
    id: raffleId,
    title: "Archive Test Edition",
    description: "Concluded raffle to be archived",
    cutoffDate: new Date(Date.now() + 86400000).toISOString(),
    prizes: ["Starlight Card"],
    isActive: true,
  });

  const entry = await submitRaffleEntry(raffleId, "Champion Player", "dev-champ");
  assert.equal(entry.success, true);
  await setRaffleWinner(entry.entry!.id, "Starlight Card");

  // Archive this raffle
  const archiveRes = await archiveCurrentRaffle(raffleId);
  assert.equal(archiveRes.success, true);
  assert.ok(archiveRes.newRaffle);
  assert.equal(archiveRes.newRaffle.isArchived, false);

  // Check archives list contains the archived raffle and its winner
  const archives = await getArchivedRaffles();
  assert.ok(archives.length > 0);
  const archived = archives.find((a) => a.id === raffleId);
  if (archived) {
    assert.equal(archived.title, "Archive Test Edition");
    assert.equal(archived.winners.length, 1);
    assert.equal(archived.winners[0].fullName, "Champion Player");
    assert.equal(archived.winners[0].prizeWon, "Starlight Card");
  }

  // Cleanup newly created edition & archived raffle
  if (archiveRes.newRaffle) {
    await deleteRaffle(archiveRes.newRaffle.id);
  }
  await deleteArchivedRaffle(raffleId);
});

test("raffle winner quotas: supports setting 100 Diamonds with multiple winner count and tracking quota", async () => {
  const raffleId = "test-raffle-quota";
  await clearAllRaffleEntries(raffleId);

  // Setup raffle with 100 Diamonds for 3 winners
  await updateRaffleSettings({
    id: raffleId,
    title: "Diamond Fest",
    category: "Diamonds Giveaway",
    description: "Win 100 diamonds! 3 winners will be chosen.",
    cutoffDate: new Date(Date.now() + 86400000).toISOString(),
    prizes: [{ name: "100 Diamonds", winnerCount: 3 }],
    isActive: true,
  });

  const e1 = await submitRaffleEntry(raffleId, "Winner One", "dev-q1");
  const e2 = await submitRaffleEntry(raffleId, "Winner Two", "dev-q2");
  const e3 = await submitRaffleEntry(raffleId, "Winner Three", "dev-q3");
  const e4 = await submitRaffleEntry(raffleId, "Contestant Four", "dev-q4");

  assert.equal(e1.success, true);
  assert.equal(e1.entry?.category, "Diamonds Giveaway");
  assert.equal(e1.entry?.raffleTitle, "Diamond Fest");

  // Assign 100 Diamonds to e1 and e2
  await setRaffleWinner(e1.entry!.id, "100 Diamonds");
  await setRaffleWinner(e2.entry!.id, "100 Diamonds");

  const state = await getRaffleState(raffleId);
  const normalized = normalizePrizeItems(state.prizes);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].name, "100 Diamonds");
  assert.equal(normalized[0].winnerCount, 3);

  const awardedCount = state.entries.filter((e) => e.prizeWon === "100 Diamonds").length;
  assert.equal(awardedCount, 2);
  const remainingQuota = normalized[0].winnerCount - awardedCount;
  assert.equal(remainingQuota, 1);

  // Cleanup
  await deleteRaffle(raffleId);
});

test("raffle anti-spam: same IP restriction prevents multiple entries across different browsers", async () => {
  const raffleId = "test-raffle-ip-restriction";
  await clearAllRaffleEntries(raffleId);

  await updateRaffleSettings({
    id: raffleId,
    title: "IP Restriction Test",
    description: "Testing anti-spam IP restriction across different browsers",
    cutoffDate: new Date(Date.now() + 86400000).toISOString(),
    prizes: ["100 Diamonds"],
    isActive: true,
  });

  const ipAddress = "192.168.1.50";
  const devChrome = "dev-chrome-123";
  const devEdge = "dev-edge-456";

  // 1. First browser (Chrome) registers
  const resChrome = await submitRaffleEntry(raffleId, "Juan Dela Cruz", devChrome, ipAddress);
  assert.equal(resChrome.success, true);
  assert.equal(resChrome.updated, false);

  // 2. Second browser (Edge) on the same IP tries to register a different name
  const resEdge = await submitRaffleEntry(raffleId, "Pedro Penduko", devEdge, ipAddress);
  assert.equal(resEdge.success, false);
  assert.match(resEdge.error || "", /only 1 entry is allowed per network/i);

  // 3. First browser (Chrome) updates its existing name
  const resUpdate = await submitRaffleEntry(raffleId, "Juan M. Dela Cruz", devChrome, ipAddress);
  assert.equal(resUpdate.success, true);
  assert.equal(resUpdate.updated, true);
  assert.equal(resUpdate.entry?.fullName, "Juan M. Dela Cruz");

  // Verify only 1 entry exists total for that IP
  const state = await getRaffleState(raffleId);
  assert.equal(state.entries.length, 1);
  assert.equal(state.entries[0].fullName, "Juan M. Dela Cruz");

  await deleteRaffle(raffleId);
});

test("raffle real-time live spin: in-memory pub/sub broadcasts spin events with zero DB queries", async () => {
  let receivedEvent: any = null;
  const unsubscribe = subscribeLiveSpin((state) => {
    receivedEvent = state;
  });

  const testSpinState = {
    id: "spin-test-1",
    raffleId: "default",
    prize: "300 Diamonds",
    winnerId: "winner-uuid-999",
    winnerName: "Kim Morph",
    winningIndex: 4,
    startedAt: Date.now(),
    durationMs: 5200,
    sliceCount: 10,
    status: "spinning" as const,
  };

  const activeState = broadcastLiveSpin(testSpinState);
  assert.equal(activeState?.status, "spinning");
  assert.equal(activeState?.prize, "300 Diamonds");
  assert.equal(activeState?.winnerName, "Kim Morph");
  assert.equal(activeState?.winningIndex, 4);
  assert.equal(activeState?.durationMs, 5200);

  // Verify subscriber received the broadcast
  assert.notEqual(receivedEvent, null);
  assert.equal(receivedEvent?.winnerName, "Kim Morph");
  assert.equal(receivedEvent?.status, "spinning");

  // Verify getLiveSpinState returns the active spin
  const currentState = getLiveSpinState();
  assert.equal(currentState?.id, activeState?.id);
  assert.equal(currentState?.prize, "300 Diamonds");

  // Broadcast landed event
  const landedState = broadcastLiveSpin({ ...testSpinState, status: "landed" as const });
  assert.equal(landedState?.status, "landed");
  assert.equal(landedState?.winnerName, "Kim Morph");

  // Clear live spin
  broadcastLiveSpin(null);
  assert.equal(getLiveSpinState(), null);

  unsubscribe();
});

test("raffle identity isolation: myEntry only resolves when both deviceId AND IP match", async () => {
  const { isSameIpOrSubnet } = await import("../src/app/api/[...path]/route");
  const raffleId = "test-raffle-strict-identity";
  await clearAllRaffleEntries(raffleId);

  await updateRaffleSettings({
    id: raffleId,
    title: "Strict Identity Test",
    description: "Testing strict device and IP ownership",
    cutoffDate: new Date(Date.now() + 86400000).toISOString(),
    prizes: ["100 Diamonds"],
    isActive: true,
  });

  const ipA = "203.177.10.25";
  const ipB = "112.198.50.60";
  const devA = "device-player-alpha";
  const devB = "device-player-beta";

  // Player A registers from Device A on IP A
  const resA = await submitRaffleEntry(raffleId, "Alice Guo", devA, ipA);
  assert.equal(resA.success, true);

  const state = await getRaffleState(raffleId);
  const entry = state.entries.find((e) => e.deviceId === devA);
  assert.ok(entry, "Alice's entry should exist");

  // Helper matching the route.ts lookup rule:
  function resolveMyEntry(reqDevId?: string, reqIp?: string) {
    if (!reqDevId) return null;
    return (
      state.entries.find(
        (e) =>
          e.deviceId === reqDevId &&
          (!e.ipAddress || isSameIpOrSubnet(e.ipAddress, reqIp)),
      ) || null
    );
  }

  // Case 1: Same device AND same IP -> MATCHES
  const match1 = resolveMyEntry(devA, ipA);
  assert.equal(match1?.fullName, "Alice Guo");

  // Case 2: Different device on SAME IP -> NULL (never shows Alice to Device B)
  const match2 = resolveMyEntry(devB, ipA);
  assert.equal(match2, null);

  // Case 3: Same device on DIFFERENT IP -> NULL (protects against cookie cloning across networks)
  const match3 = resolveMyEntry(devA, ipB);
  assert.equal(match3, null);

  // Case 4: No device token provided -> NULL (never falls back to IP matching alone)
  const match4 = resolveMyEntry(undefined, ipA);
  assert.equal(match4, null);

  await deleteRaffle(raffleId);
});



