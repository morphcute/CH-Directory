import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterTournaments,
  registrationUrl,
  slotsLeft,
  tournamentStatus,
  canRegister,
  listedPlayers,
} from "../src/lib/tournaments";
import { INITIAL_SEPTEMBER_PLAYERS } from "../src/data/initialData";
import {
  parseCsvOrTsv,
  transformRowsToPlayers,
} from "../src/utils/sheetDetector";
import { playerSchema } from "../src/server/validation";
import { allowedRemote } from "../src/server/sheets";
import { createSession, verifySession, sameOrigin } from "../src/server/auth";
const player = INITIAL_SEPTEMBER_PLAYERS[0];
test("registration requires an active listing, open slots, and a safe form link", () => {
  assert.equal(canRegister(player), true);
  assert.equal(canRegister({ ...player, teamsRegistered: 16 }), false);
  assert.equal(canRegister({ ...player, teamsRegistered: 20 }), false);
  assert.equal(canRegister({ ...player, formStatus: "full" }), false);
  assert.equal(canRegister({ ...player, formStatus: "closed" }), false);
  assert.equal(canRegister({ ...player, active: false }), false);
  assert.equal(
    canRegister({
      ...player,
      registrationFormLink: "",
      tournamentPostingLink: "",
    }),
    false,
  );
  assert.deepEqual(
    listedPlayers({ players: [player], selectedNicknames: [] }),
    [],
  );
  assert.equal(
    listedPlayers({ players: [player], selectedNicknames: [player.chNickname] })
      .length,
    1,
  );
});
test("registration availability respects closed forms, capacity, and inactive listings", () => {
  assert.equal(tournamentStatus({ ...player, teamsRegistered: 0 }), "open");
  assert.equal(tournamentStatus({ ...player, teamsRegistered: 12 }), "closing");
  assert.equal(tournamentStatus({ ...player, teamsRegistered: 99 }), "full");
  assert.equal(slotsLeft({ ...player, teamsRegistered: 99 }), 0);
  assert.equal(
    tournamentStatus({ ...player, teamsRegistered: 1, formStatus: "closed" }),
    "closed",
  );
  assert.equal(tournamentStatus({ ...player, active: false }), "closed");
});
test("search and region filters compose without leaking inactive records", () => {
  const result = filterTournaments(
    INITIAL_SEPTEMBER_PLAYERS,
    "  MEG  ",
    "CALABARZON",
    "open",
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].chNickname, "Meg");
  assert.equal(
    filterTournaments(INITIAL_SEPTEMBER_PLAYERS, "Meg", "Metro Manila", "all")
      .length,
    0,
  );
  assert.ok(
    filterTournaments(
      INITIAL_SEPTEMBER_PLAYERS,
      "",
      "All regions",
      "all",
    ).every((p) => p.active),
  );
});
test("untrusted links and invalid capacity cannot be published", () => {
  assert.equal(
    registrationUrl({
      ...player,
      registrationFormLink: "javascript:alert(1)",
      tournamentPostingLink: "",
    }),
    "",
  );
  assert.equal(
    playerSchema.safeParse({ ...player, maxTeams: 0 }).success,
    false,
  );
  assert.equal(
    playerSchema.safeParse({
      ...player,
      facebookProfileUrl: "javascript:alert(1)",
    }).success,
    false,
  );
  assert.throws(() => allowedRemote("http://127.0.0.1/"));
  assert.throws(() => allowedRemote("https://docs.google.com.evil.example/"));
  assert.throws(() => allowedRemote("https://user:pass@docs.google.com/"));
  assert.throws(() => allowedRemote("https://docs.google.com:8080/"));
  assert.equal(allowedRemote("https://forms.gle/test").hostname, "forms.gle");
});
test("signed sessions reject tampering, expiry, and missing configuration", () => {
  const oldPassword = process.env.ADMIN_PASSWORD;
  const oldSecret = process.env.SESSION_SECRET;
  process.env.ADMIN_PASSWORD = "test-password-for-unit-tests";
  process.env.SESSION_SECRET = "test-session-signing-secret-32-characters";
  try {
    const token = createSession();
    assert.ok(verifySession(token));
    assert.equal(verifySession(token + "x"), false);
    assert.equal(verifySession("1.fake"), false);
    process.env.SESSION_SECRET = "";
    assert.equal(verifySession(token), false);
  } finally {
    if (oldPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = oldPassword;
    if (oldSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = oldSecret;
  }
});
test("same-origin checks use the public host and reject cross-site requests", () => {
  assert.equal(
    sameOrigin(
      new Request("http://0.0.0.0:3000/api/app-state", {
        headers: { host: "localhost:3000", origin: "http://localhost:3000" },
      }),
    ),
    true,
  );
  assert.equal(
    sameOrigin(
      new Request("http://0.0.0.0:3000/api/app-state", {
        headers: { host: "community.example", origin: "https://evil.example" },
      }),
    ),
    false,
  );
});
test("pasted sheet data preserves commas, escaped quotes, and multiline cells", () => {
  assert.deepEqual(
    parseCsvOrTsv('name,note\r\n"Hero, One","Line one\nLine ""two"""'),
    [
      ["name", "note"],
      ["Hero, One", 'Line one\nLine "two"'],
    ],
  );
  assert.deepEqual(parseCsvOrTsv("name\tnote\nHero\tHello"), [
    ["name", "note"],
    ["Hero", "Hello"],
  ]);
  const rows = [
    [
      "Active",
      "Area",
      "Full name",
      "Nickname",
      "Teams",
      "Registration link",
      "Response sheet",
    ],
    [
      "1",
      "Laguna",
      "Mary Franco",
      "Meg",
      "10/16",
      "https://forms.gle/example",
      "",
    ],
  ];
  const result = transformRowsToPlayers(rows);
  assert.equal(result[0].chNickname, "Meg");
  assert.equal(result[0].teamsRegistered, 10);
  assert.equal(result[0].isCalabarzon, true);
});
