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
  analyzeTabs,
} from "../src/utils/sheetDetector";
import { playerSchema } from "../src/server/validation";
import { allowedRemote, findTeamColumnIndex } from "../src/server/sheets";
import { createSession, verifySession, sameOrigin } from "../src/server/auth";
import type { CHPlayer } from "../src/types";

const player: CHPlayer = {
  id: "row-1-Meg",
  active: true,
  area: "CALABARZON",
  isCalabarzon: true,
  fullName: "Mary Franco",
  chNickname: "Meg",
  facebookProfileUrl: "https://www.facebook.com/meg",
  registrationFormLink: "https://forms.gle/test",
  tournamentPostingLink: "https://facebook.com/post",
  tournamentResponseSheet: "https://docs.google.com/spreadsheets/d/test",
  teamsRegistered: 0,
  maxTeams: 16,
  rowIndex: 2,
};
const testPlayers = [
  player,
  {
    ...player,
    id: "row-2-Hanyel",
    chNickname: "Hanyel",
    area: "Ilocos",
    isCalabarzon: false,
    active: false,
  },
];
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
    listedPlayers({ players: [player], selectedNicknames: [] } as any),
    [player],
  );
  assert.equal(
    listedPlayers({ players: [player], selectedNicknames: [player.chNickname] } as any)
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
    testPlayers,
    "  MEG  ",
    "CALABARZON",
    "open",
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].chNickname, "Meg");
  assert.equal(
    filterTournaments(testPlayers, "Meg", "Metro Manila", "all")
      .length,
    0,
  );
  assert.ok(
    filterTournaments(
      testPlayers,
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

test("listedPlayers orders heroes strictly according to selection sequence (1 by 1)", () => {
  const p1: CHPlayer = { ...player, id: "ch-1", chNickname: "Lester", active: true };
  const p2: CHPlayer = { ...player, id: "ch-2", chNickname: "Meg", active: true };
  const p3: CHPlayer = { ...player, id: "ch-3", chNickname: "Vien", active: true };
  const p4: CHPlayer = { ...player, id: "ch-4", chNickname: "Hanyel", active: false };
  const p5: CHPlayer = { ...player, id: "ch-5", chNickname: "Jio", active: true };

  // Initial order in array is [Lester, Meg, Vien, Hanyel, Jio]
  const allPlayers = [p1, p2, p3, p4, p5];

  // If selected Vien first, Lester second, Meg third (and Jio is not selected):
  const selectionOrder = ["Vien", "Lester", "Meg"];
  const ordered = listedPlayers({
    players: allPlayers,
    selectedNicknames: selectionOrder,
  } as any);

  assert.equal(ordered.length, 3);
  assert.equal(ordered[0].chNickname, "Vien", "1st selection should be #1 in directory");
  assert.equal(ordered[1].chNickname, "Lester", "2nd selection should be #2 in directory");
  assert.equal(ordered[2].chNickname, "Meg", "3rd selection should be #3 in directory");

  // Inactive hero Hanyel must never appear in listedPlayers
  assert.ok(!ordered.some((p) => p.chNickname === "Hanyel"));
  // Active but unselected hero Jio must never appear in listedPlayers
  assert.ok(!ordered.some((p) => p.chNickname === "Jio"), "Unselected hero must not appear in directory");

  // If deselect all (selectedNicknames is empty), active heroes fall back to array order
  const emptySelection = listedPlayers({
    players: allPlayers,
    selectedNicknames: [],
  } as any);
  assert.equal(emptySelection.length, 4);
  assert.equal(emptySelection[0].chNickname, "Lester");
  assert.equal(emptySelection[1].chNickname, "Meg");
  assert.equal(emptySelection[2].chNickname, "Vien");
  assert.equal(emptySelection[3].chNickname, "Jio");

  // If Meg is deselected, then re-selected after Vien and Lester:
  const reselectedOrder = ["Lester", "Vien", "Meg"];
  const reselected = listedPlayers({
    players: allPlayers,
    selectedNicknames: reselectedOrder,
  } as any);
  assert.equal(reselected[0].chNickname, "Lester");
  assert.equal(reselected[1].chNickname, "Vien");
  assert.equal(reselected[2].chNickname, "Meg");
});

test("analyzeTabs automatically detects next month tournament when present in sheet", () => {
  const tabsInSheet = [
    "Sheet13",
    "MARCH 7, 2026",
    "JULY 4, 2026",
    "UNIFORMED DIY GUIDE",
    "September 5, 2026",
    "October 10, 2026",
    "Copy of AUG 8, 2026",
    "AUG 8, 2026",
    "JUNE 6, 2026",
    "May 2, 2026",
    "APRIL 11, 2026",
    "January 24, 2026",
    " February 07, 2026",
  ];

  // When current date is September 28, 2026 (September 5 tournament is ended)
  const currentDate = new Date("2026-09-28T21:00:00+08:00");
  const result = analyzeTabs(tabsInSheet, currentDate);

  assert.ok(result.autoDetectedTab, "Should auto-detect a tournament tab");
  assert.equal(
    result.autoDetectedTab.name,
    "October 10, 2026",
    "Must auto-detect upcoming October tournament even when current date is still September",
  );
});

test("transformRowsToPlayers activates heroes with links even when Column A is unpopulated in preparation sheets", () => {
  const rows = [
    [
      "",
      "AREA",
      "CH Full Name",
      "CH Nickname",
      "Tournament Posting Link",
      "Registration Form Link",
      "Tournament Response Sheet",
    ],
    // Row without links and without Column A
    ["", "Ilocos", "Jannielle Angelou Mata", "Hanyel", "", "", ""],
    // Row with links but Column A is blank (organizers preparing sheet before typing 1s)
    [
      "",
      "Quezon Province",
      "Kim Lester L. Evangelista",
      "Lester",
      "https://tinyurl.com/3r8z3amj",
      "https://tinyurl.com/2b5u3m4z",
      "https://tinyurl.com/4kxevt6u",
    ],
  ];

  const players = transformRowsToPlayers(rows);
  assert.equal(players.length, 2);

  const hanyel = players.find((p) => p.chNickname === "Hanyel");
  const lester = players.find((p) => p.chNickname === "Lester");

  assert.ok(hanyel && !hanyel.active, "Hanyel without links should be inactive");
  assert.ok(
    lester && lester.active,
    "Lester with registration/posting links should be active even if Col A is blank",
  );
});

test("findTeamColumnIndex reliably detects team name column and avoids captain/player columns", () => {
  // Lester's form style: "Your Team Name" is Col C (idx 2)
  const headerLester = [
    "Timestamp",
    "Email Address",
    "Your Team Name",
    "1st Player's (Team Captain) Name",
    "1st Player's Age",
  ];
  assert.equal(findTeamColumnIndex(headerLester), 2);

  // Form with "Pangalan ng Team"
  const headerTagalog = [
    "Timestamp",
    "Pangalan ng Team",
    "Pangalan ng Team Captain",
    "Contact Number",
  ];
  assert.equal(findTeamColumnIndex(headerTagalog), 1);

  // Form with "Squad Name"
  const headerSquad = [
    "Timestamp",
    "Email",
    "Squad Name",
    "Leader In-Game Name",
  ];
  assert.equal(findTeamColumnIndex(headerSquad), 2);

  // Form with "Team Captain" first, then "Team Name"
  const headerReversed = [
    "Timestamp",
    "Team Captain Name",
    "Team Name",
    "Facebook Link",
  ];
  assert.equal(findTeamColumnIndex(headerReversed), 2);
});

