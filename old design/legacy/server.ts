import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { INITIAL_SEPTEMBER_PLAYERS, INITIAL_TABS } from './src/data/initialData';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'app-state.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create data directory:', e);
  }
}

interface ServerAppState {
  players: any[];
  bannerSettings: any;
  selectedNicknames: string[];
  activeTabName: string;
  spreadsheetUrl: string;
  rawTabsList: string[];
  lastUpdated: number;
}

function getDefaultAppState(): ServerAppState {
  return {
    players: INITIAL_SEPTEMBER_PLAYERS,
    bannerSettings: {
      type: 'preset',
      presetId: 'official-ch-banner',
      title: 'COMMUNITY HEROES PH',
      subtitle: 'Official Tournament Directory • Calabarzon & NCR',
      description:
        'Official registration portal for the Community Heroes MLBB Tournament series. Select your local Community Head below to register your team.',
      avatarType: 'icon',
      overlayDarkness: 0.45,
      bannerHeight: 'standard',
      bannerFit: 'cover',
    },
    selectedNicknames: INITIAL_SEPTEMBER_PLAYERS.filter((p) => p.active).map((p) => p.chNickname),
    activeTabName: 'September 5, 2026',
    spreadsheetUrl:
      'https://docs.google.com/spreadsheets/d/1nL3HRMjrrE-W_jUhVWsWDqc2h2koBR2Mj_5CRARfDEU/edit?usp=sharing',
    rawTabsList: INITIAL_TABS,
    lastUpdated: Date.now(),
  };
}

let inMemoryAppState: ServerAppState = getDefaultAppState();

// Load persisted state from disk
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.players) && parsed.players.length > 0) {
      inMemoryAppState = {
        ...getDefaultAppState(),
        ...parsed,
      };
      console.log(`Loaded ${inMemoryAppState.players.length} players from server disk storage.`);
    }
  } else {
    // Write initial default state
    fs.writeFileSync(DATA_FILE, JSON.stringify(inMemoryAppState, null, 2), 'utf-8');
  }
} catch (err) {
  console.error('Error loading app-state.json:', err);
}

function persistAppState(state: ServerAppState) {
  try {
    inMemoryAppState = {
      ...state,
      lastUpdated: Date.now(),
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(inMemoryAppState, null, 2), 'utf-8');
    return inMemoryAppState;
  } catch (err) {
    console.error('Error writing app-state.json:', err);
    return inMemoryAppState;
  }
}

/**
 * Inspects a Google Form URL (handles TinyURL, Bitly, forms.gle redirects)
 * and detects if it is accepting responses or closed.
 */
async function inspectFormUrl(formUrl: string): Promise<{
  status: 'open' | 'closed' | 'full' | 'error';
  detail: string;
  resolvedUrl: string;
}> {
  if (!formUrl) {
    return { status: 'error', detail: 'No registration link provided', resolvedUrl: '' };
  }

  try {
    const res = await fetch(formUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,fil-PH,fil;q=0.9,en;q=0.8',
      },
    });

    const finalUrl = res.url || formUrl;
    if (res.status === 404) {
      return { status: 'error', detail: 'Link not found (404)', resolvedUrl: finalUrl };
    }

    const html = await res.text();
    const lower = html.toLowerCase();

    // Specific Google Forms closed indicators
    const isClosed =
      lower.includes('no longer accepting responses') ||
      lower.includes('hindi na tumatanggap ng mga tugon') ||
      lower.includes('freebirdformviewerresponseconfirmcontentcontainer') ||
      lower.includes('freebirdformviewerviewresponseconfirmcontentcontainer') ||
      lower.includes('is no longer accepting responses') ||
      lower.includes('this form is no longer accepting responses');

    if (isClosed) {
      return {
        status: 'closed',
        detail: 'Closed by form owner (Responses turned off)',
        resolvedUrl: finalUrl,
      };
    }

    return {
      status: 'open',
      detail: 'Accepting responses',
      resolvedUrl: finalUrl,
    };
  } catch (err: any) {
    return {
      status: 'error',
      detail: err.message || 'Failed to inspect link',
      resolvedUrl: formUrl,
    };
  }
}

/**
 * Inspects a Google Form response sheet (handles TinyURL, Bitly redirects)
 * and counts the registered teams.
 */
async function inspectResponseSheet(
  sheetUrl: string,
  authHeader?: string
): Promise<{
  count: number | null;
  resolvedUrl: string;
  status: string;
}> {
  if (!sheetUrl) {
    return { count: null, resolvedUrl: '', status: 'no_url' };
  }

  try {
    let targetUrl = sheetUrl;
    // Follow redirect if shortened URL (tinyurl / bit.ly / forms.gle)
    if (
      targetUrl.includes('tinyurl.com') ||
      targetUrl.includes('bit.ly') ||
      targetUrl.includes('forms.gle') ||
      !targetUrl.includes('/spreadsheets/d/')
    ) {
      try {
        const headRes = await fetch(targetUrl, {
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        if (headRes.url) {
          targetUrl = headRes.url;
        }
      } catch (e) {
        // Continue with original URL if redirect check failed
      }
    }

    // Extract spreadsheet ID
    const match = targetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
      return { count: null, resolvedUrl: targetUrl, status: 'not_a_spreadsheet' };
    }

    const sheetId = match[1];

    // If OAuth Bearer token provided in header, use official Sheets API
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const apiRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:A`,
          { headers: { Authorization: authHeader } }
        );
        if (apiRes.ok) {
          const json = await apiRes.json();
          const rows = json.values || [];
          const count = rows.length > 1 ? rows.length - 1 : 0;
          return { count, resolvedUrl: targetUrl, status: 'ok' };
        }
      } catch (e) {}
    }

    // Query via GViz JSON
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
    const gRes = await fetch(gvizUrl);
    if (gRes.ok) {
      const text = await gRes.text();
      if (!text.includes('accounts.google.com/ServiceLogin')) {
        const jsonStr = text.replace(/^[/*\w\s.]*\(/, '').replace(/\);?\s*$/, '');
        try {
          const data = JSON.parse(jsonStr);
          const rows = data.table?.rows || [];
          const filledRows = rows.filter(
            (r: any) =>
              r.c && r.c.some((cell: any) => cell && cell.v !== null && cell.v !== '')
          );
          return { count: filledRows.length, resolvedUrl: targetUrl, status: 'ok' };
        } catch (e) {}
      }
    }

    // CSV fallback
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      const cRes = await fetch(csvUrl);
      if (cRes.ok) {
        const csvText = await cRes.text();
        if (!csvText.includes('accounts.google.com/ServiceLogin')) {
          const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
          const count = lines.length > 1 ? lines.length - 1 : 0;
          return { count, resolvedUrl: targetUrl, status: 'ok' };
        }
      }
    } catch (e) {}

    return { count: null, resolvedUrl: targetUrl, status: 'sheet_private' };
  } catch (err: any) {
    return { count: null, resolvedUrl: sheetUrl, status: 'error' };
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Process error handlers to prevent crash in deployment
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception in server:', err);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection in server:', reason);
  });

  // Support up to 25MB JSON for base64 uploaded banner pictures
  app.use(express.json({ limit: '25mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 1. App State Read (Realtime sync across all devices)
  app.get('/api/app-state', (req, res) => {
    res.json(inMemoryAppState);
  });

  // 2. App State Save (Admin updates saved to disk and broadcasted to other devices)
  app.post('/api/app-state', (req, res) => {
    try {
      const body = req.body;
      if (!body) {
        return res.status(400).json({ error: 'Missing state body' });
      }
      const updated = persistAppState({
        ...inMemoryAppState,
        ...body,
        players: body.players || inMemoryAppState.players,
      });
      return res.json({
        success: true,
        lastUpdated: updated.lastUpdated,
        count: updated.players.length,
      });
    } catch (err: any) {
      console.error('Error saving app-state:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // 3. Lightweight check for client polling
  app.get('/api/app-state/sync', (req, res) => {
    res.json({
      lastUpdated: inMemoryAppState.lastUpdated,
      count: inMemoryAppState.players.length,
    });
  });

  // 4. Comprehensive Tournament Detection (Response Sheet counts 16/16 AND Registration Form closed status)
  app.post('/api/detect-tournament-status', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const targetPlayers = Array.isArray(req.body?.players) && req.body.players.length > 0
        ? req.body.players
        : inMemoryAppState.players;

      const phtTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(new Date()) + ' PHT';

      const results = await Promise.all(
        targetPlayers.map(async (player: any) => {
          const maxTeams = player.maxTeams || 16;
          let teamsRegistered = player.teamsRegistered || 0;
          let formStatus = player.formStatus || 'open';
          let formStatusDetail = player.formStatusDetail || 'Accepting responses';
          let resolvedSheet = player.resolvedResponseSheetUrl;
          let resolvedForm = player.resolvedFormUrl;

          // Step 1: Detect response sheet registered teams
          if (player.tournamentResponseSheet) {
            const sheetInspection = await inspectResponseSheet(
              player.tournamentResponseSheet,
              authHeader
            );
            if (sheetInspection.resolvedUrl) {
              resolvedSheet = sheetInspection.resolvedUrl;
            }
            if (sheetInspection.count !== null) {
              teamsRegistered = sheetInspection.count;
            }
          }

          // Step 2: Detect registration form link & check if closed
          const regLink = player.registrationFormLink || player.tournamentPostingLink;
          if (regLink) {
            const formInspection = await inspectFormUrl(regLink);
            if (formInspection.resolvedUrl) {
              resolvedForm = formInspection.resolvedUrl;
            }
            if (formInspection.status === 'closed') {
              formStatus = 'closed';
              formStatusDetail = formInspection.detail;
            } else if (formInspection.status === 'error') {
              formStatus = 'error';
              formStatusDetail = formInspection.detail;
            } else {
              formStatus = 'open';
              formStatusDetail = formInspection.detail;
            }
          }

          // Step 3: If teamsRegistered >= maxTeams, capacity is FULL (e.g. 16/16)
          if (teamsRegistered >= maxTeams) {
            formStatus = 'full';
            formStatusDetail = `${teamsRegistered}/${maxTeams} Teams Full (Registration Closed)`;
          } else if (formStatus === 'open') {
            const slotsLeft = Math.max(0, maxTeams - teamsRegistered);
            formStatusDetail = `${teamsRegistered}/${maxTeams} Registered • ${slotsLeft} slots left`;
          }

          return {
            ...player,
            teamsRegistered,
            formStatus,
            formStatusDetail,
            resolvedResponseSheetUrl: resolvedSheet,
            resolvedFormUrl: resolvedForm,
            lastDetectedAt: phtTime,
          };
        })
      );

      // Update in-memory state and persist to disk
      persistAppState({
        ...inMemoryAppState,
        players: results,
      });

      return res.json({
        success: true,
        timestamp: phtTime,
        players: results,
        lastUpdated: inMemoryAppState.lastUpdated,
      });
    } catch (err: any) {
      console.error('Error in detect-tournament-status:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Proxy endpoint to detect tabs from public Google Spreadsheet
  app.get('/api/sheets/detect-tabs', async (req, res) => {
    try {
      const urlOrId = String(req.query.url || req.query.id || '');
      if (!urlOrId) {
        return res.status(400).json({ error: 'Missing url or id parameter' });
      }

      // Extract spreadsheet ID
      let sheetId = urlOrId;
      const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        sheetId = match[1];
      }

      // Fetch public sheet HTML to extract tab names
      const htmlUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`;
      const response = await fetch(htmlUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        return res.status(response.status).json({
          error: `Could not fetch Google Sheet HTML: HTTP ${response.status}`,
          sheetId,
        });
      }

      const html = await response.text();

      // Extract title
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const rawTitle = titleMatch ? titleMatch[1].replace(' - Google Sheets', '').replace(' - Google Drive', '').trim() : '';

      // Extract sheet tab names:
      // Google Sheets htmlview renders tabs in <ul id="sheet-menu"> <li id="sheet-button-..."> <a ...>TabName</a>
      const tabs: string[] = [];
      const tabRegex = /<li[^>]*id="sheet-button-[^"]*"[^>]*>\s*<a[^>]*>(.*?)<\/a>/gi;
      let m;
      while ((m = tabRegex.exec(html)) !== null) {
        const name = m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        if (name && !tabs.includes(name)) {
          tabs.push(name);
        }
      }

      // If htmlview didn't match, check JSON bootstrap cache chunks
      if (tabs.length === 0) {
        const chunkRegex = /\[\d+,\s*"(.*?)",\s*\d+,\s*"(.*?)",/g;
        // Search for tab names like "September 5, 2026", "August 5, 2026"
        const monthPattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s*|\s+)\d{4}/gi;
        const matches = html.match(monthPattern);
        if (matches) {
          matches.forEach((t) => {
            const clean = t.trim();
            if (!tabs.includes(clean)) tabs.push(clean);
          });
        }
      }

      return res.json({
        sheetId,
        title: rawTitle || 'Google Spreadsheet',
        tabs,
      });
    } catch (error: any) {
      console.error('Error detecting Google Sheets tabs:', error);
      return res.status(500).json({ error: error.message || 'Failed to detect tabs' });
    }
  });

  // Proxy endpoint to read Google Sheets tab data via gviz
  app.get('/api/sheets/data', async (req, res) => {
    try {
      const urlOrId = String(req.query.url || req.query.id || '');
      const sheetName = String(req.query.sheet || '');

      let sheetId = urlOrId;
      const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        sheetId = match[1];
      }

      if (!sheetId) {
        return res.status(400).json({ error: 'Missing spreadsheet ID or URL' });
      }

      let gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
      if (sheetName) {
        gvizUrl += `&sheet=${encodeURIComponent(sheetName)}`;
      }

      const gvizRes = await fetch(gvizUrl);
      const text = await gvizRes.text();

      // Check if Google returned a login redirect (Private Sheet)
      if (
        text.includes('accounts.google.com/ServiceLogin') ||
        text.includes('document-root show-login-page') ||
        text.includes('Sign in to your Google account') ||
        text.includes('登入您的 Google 帳戶')
      ) {
        return res.status(403).json({
          error: 'PRIVATE_SHEET',
          message:
            'This Google Sheet is currently Restricted / Private. To allow the app to sync automatically without requiring everyone to log in, open the Sheet, click "Share", and set General access to "Anyone with the link can view". Alternatively, you can use the Direct Paste box below.',
        });
      }

      if (!gvizRes.ok) {
        return res.status(gvizRes.status).json({
          error: `Google Sheets returned HTTP ${gvizRes.status}`,
        });
      }

      res.setHeader('Content-Type', 'application/json');
      res.send(text);
    } catch (error: any) {
      console.error('Error fetching sheet data:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch sheet data' });
    }
  });

  // Endpoint to detect tournament response sheet registered teams
  app.post('/api/sheets/detect-responses', async (req, res) => {
    try {
      const { items } = req.body as { items: Array<{ id: string; nickname: string; responseSheetUrl: string }> };
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Expected items array' });
      }

      const results = await Promise.all(
        items.map(async (item) => {
          if (!item.responseSheetUrl) {
            return { id: item.id, nickname: item.nickname, count: null, status: 'no_url' };
          }

          try {
            // Follow redirect if shortened url (tinyurl / bit.ly)
            let targetUrl = item.responseSheetUrl;
            if (targetUrl.includes('tinyurl.com') || targetUrl.includes('bit.ly')) {
              try {
                const headRes = await fetch(targetUrl, { method: 'HEAD', redirect: 'follow' });
                if (headRes.url) {
                  targetUrl = headRes.url;
                }
              } catch (e) {
                // Ignore redirect failure
              }
            }

            // If Google Spreadsheet URL, extract sheetId
            const match = targetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            if (match && match[1]) {
              const sheetId = match[1];
              const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
              const gRes = await fetch(gvizUrl);
              if (gRes.ok) {
                const text = await gRes.text();
                const jsonStr = text.replace(/^[/*\w\s.]*\(/, '').replace(/\);?\s*$/, '');
                const data = JSON.parse(jsonStr);
                const rows = data.table?.rows || [];
                // Filter rows with content
                const filledRows = rows.filter((r: any) => r.c && r.c.some((cell: any) => cell && cell.v !== null && cell.v !== ''));
                return {
                  id: item.id,
                  nickname: item.nickname,
                  count: filledRows.length,
                  resolvedUrl: targetUrl,
                  status: 'ok',
                };
              }
            }

            return {
              id: item.id,
              nickname: item.nickname,
              count: null,
              resolvedUrl: targetUrl,
              status: 'sheet_private_or_redirect',
            };
          } catch (err: any) {
            return {
              id: item.id,
              nickname: item.nickname,
              count: null,
              status: 'error',
            };
          }
        })
      );

      return res.json({
        timestamp: new Date().toISOString(),
        results,
      });
    } catch (error: any) {
      console.error('Error in detect-responses:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development vs static production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Resolve dist path reliably
    let distPath = path.resolve(process.cwd(), 'dist');
    if (!fs.existsSync(path.join(distPath, 'index.html'))) {
      // Fallback relative to __dirname
      const fallbackPath = path.resolve(__dirname, 'dist');
      if (fs.existsSync(path.join(fallbackPath, 'index.html'))) {
        distPath = fallbackPath;
      }
    }

    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Application build in progress. Please refresh momentarily.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Community Heroes Tournament Directory server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
