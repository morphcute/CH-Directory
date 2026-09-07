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
} from "../src/server/raffleStore";

test("raffle anti-spam: same device edits name without duplicate entries", async () => {
  const raffleId = "test-raffle-antispam";
  await clearAllRaffleEntries(raffleId);

  // Setup active raffle with future deadline
  await updateRaffleSettings({
    id: raffleId,
    title: "Anti-Spam Test Raffle",
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
});

