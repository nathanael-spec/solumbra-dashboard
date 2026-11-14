/**
 * The guided setup. Asks where your money and your pipeline live, checks each
 * key against the real tool, makes the sheet tabs, and writes .env.local.
 * Run it again any time; existing answers are offered as defaults.
 *
 *   npm run setup            the questions
 *   npm run setup -- --sheets   only make the missing tabs in the configured sheets
 *
 * Nothing is sent anywhere except to the tool the key belongs to.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { existsSync, readFileSync, copyFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { loadEnv, saveEnv, ENV_PATH } from './env';
import { checkAll, printRows } from './check';

const env = loadEnv();
const rl = createInterface({ input: stdin, output: stdout });
const answers: Record<string, string> = {};

const say = (t = '') => console.log(t);
const head = (t: string) => say(`\n\x1b[1m${t}\x1b[0m`);
async function ask(q: string, fallback = ''): Promise<string> {
  const a = (await rl.question(`  ${q}${fallback ? ` [${mask(fallback)}]` : ''}: `)).trim();
  return a || fallback;
}
async function yes(q: string, fallback = true): Promise<boolean> {
  const a = (await rl.question(`  ${q} (${fallback ? 'Y/n' : 'y/N'}): `)).trim().toLowerCase();
  return a ? a.startsWith('y') : fallback;
}
async function pick(q: string, options: string[], fallback = 0): Promise<number> {
  say(`  ${q}`);
  options.forEach((o, i) => say(`    ${i + 1}. ${o}`));
  const a = Number(await rl.question(`  Type a number [${fallback + 1}]: `)) || fallback + 1;
  return Math.min(Math.max(1, a), options.length) - 1;
}
/** Secrets are shown as their first and last characters only. */
const mask = (v: string) => (v.length > 12 && /[A-Za-z0-9]{12,}/.test(v) && !v.includes(' ') ? `${v.slice(0, 4)}…${v.slice(-3)}` : v.length > 60 ? v.slice(0, 40) + '…' : v);
const sheetId = (v: string) => v.match(/\/d\/([A-Za-z0-9_-]{20,})/)?.[1] ?? v.trim();
const set = (k: string, v: string) => { answers[k] = v; process.env[k] = v; };

async function get(url: string, headers: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'solumbra-dashboard-setup/1.0', ...headers } });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

async function tryKey(name: string, test: () => Promise<string>): Promise<boolean> {
  try {
    say(`  ok, ${await test()}`);
    return true;
  } catch (e) {
    say(`  ${name} did not accept that: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

async function google(): Promise<boolean> {
  head('1. Google Sheets, where the money lives');
  say('  The dashboard reads your P&L from a Google Sheet through a service account:');
  say('  a robot Google user with its own email address. You share the sheet with it.');
  say('  Steps (once, five minutes), also in docs/keys.md:');
  say('    1. console.cloud.google.com, top left, New project, any name, Create.');
  say('    2. APIs and services, Library, search "Google Sheets API", Enable.');
  say('    3. APIs and services, Credentials, Create credentials, Service account, any name, Done.');
  say('    4. Click the account, Keys tab, Add key, Create new key, JSON. A file downloads.');
  say('  Keep that file private. It is a password.');
  const { serviceAccount } = await import('../lib/sources/sheets');
  const have = env.GOOGLE_SERVICE_ACCOUNT_JSON || (env.GOOGLE_SHEETS_REFRESH_TOKEN ? 'refresh token' : '');
  if (have && await yes(`Google is already connected (${have === 'refresh token' ? 'your own account' : 'service account'}). Keep it?`)) return true;
  for (;;) {
    const p = await ask('Drag the downloaded JSON file here, or paste its path (blank to skip Google)');
    if (!p) return false;
    const path = resolve(p.replace(/^['"]|['"]$/g, '').replace(/\\ /g, ' '));
    if (!existsSync(path)) { say('  No file there. Try again.'); continue; }
    const text = readFileSync(path, 'utf8');
    set('GOOGLE_SERVICE_ACCOUNT_JSON', JSON.stringify(JSON.parse(text)));
    try {
      const a = serviceAccount();
      const { accessToken } = await import('../lib/sources/sheets');
      await accessToken();
      say(`  ok. The robot's email is ${a?.client_email}`);
      say('  Share every sheet the dashboard should read with that email, as Editor.');
      return true;
    } catch (e) {
      say(`  Google did not accept it: ${e instanceof Error ? e.message : e}`);
    }
  }
}

async function sheets(): Promise<void> {
  head('2. Your P&L sheet');
  say('  The Ledger tab is the only place money is counted. Columns: Date, In or Out, Channel,');
  say('  Category, Who, Amount, How paid, Status, Notes, Source id. If you have no P&L yet,');
  say('  make a blank Google Sheet, share it with the robot email, and paste its link.');
  const { ensureTabs, sheetInfo } = await import('../lib/sources/sheetsAdmin');
  for (;;) {
    const link = await ask('Link or id of your P&L sheet', env.PNL_SHEET_ID ?? '');
    if (!link) { say('  Without a sheet the Money and Today pages stay empty. You can add it later with npm run setup.'); return; }
    const id = sheetId(link);
    try {
      const info = await sheetInfo(id);
      say(`  ok, "${info.title}" with tabs: ${info.tabs.join(', ')}`);
      set('PNL_SHEET_ID', id);
      const wanted = ['Ledger', 'Recurring'];
      const missing = wanted.filter((t) => !info.tabs.includes(t));
      if (missing.length && await yes(`It has no ${missing.join(' or ')} tab. Add ${missing.length > 1 ? 'them' : 'it'} with the right headings?`)) {
        for (const d of await ensureTabs(id, wanted)) say(`  ${d}`);
      }
      break;
    } catch (e) {
      say(`  ${e instanceof Error ? e.message : e}`);
    }
  }
  head('3. The dashboard\'s own tabs');
  say('  Stage log (every pipeline move), Notes, and Cold email runs. They can live in the');
  say('  P&L sheet as extra tabs, or in a second sheet if you want the books kept clean.');
  const where = await pick('Where should they go?', ['In the P&L sheet, as extra tabs', 'In a second sheet (paste its link next)'], env.DASHBOARD_SHEET_ID && env.DASHBOARD_SHEET_ID !== env.PNL_SHEET_ID ? 1 : 0);
  let dash = answers.PNL_SHEET_ID;
  if (where === 1) {
    for (;;) {
      const link = await ask('Link or id of the second sheet', env.DASHBOARD_SHEET_ID ?? '');
      try { const info = await sheetInfo(sheetId(link)); say(`  ok, "${info.title}"`); dash = sheetId(link); break; } catch (e) { say(`  ${e instanceof Error ? e.message : e}`); }
    }
  }
  set('DASHBOARD_SHEET_ID', dash);
  for (const d of await ensureTabs(dash, ['Stage log', 'Notes', 'Cold email runs'])) say(`  ${d}`);
  say('  tabs ready');
}

async function pipeline(): Promise<void> {
  head('4. Your pipeline, the CRM');
  say('  Meetings booked, proposals sent and deals closed come from here.');
  const current = env.PIPELINE_SOURCE === 'sheet' ? 1 : env.PIPELINE_SOURCE === 'none' ? 2 : 0;
  const choice = await pick('Where is it?', ['ClickUp, one list with a status per stage', 'A Pipeline tab in the Google Sheet, one row per lead', 'Nowhere yet. I will use the Add button on the dashboard'], current);
  if (choice === 2) { set('PIPELINE_SOURCE', 'none'); return; }
  if (choice === 1) {
    set('PIPELINE_SOURCE', 'sheet');
    if (!answers.DASHBOARD_SHEET_ID) { say('  That needs the Google sheet from step 2. Run setup again once you have one.'); return; }
    const { ensureTabs } = await import('../lib/sources/sheetsAdmin');
    for (const d of await ensureTabs(answers.DASHBOARD_SHEET_ID, ['Pipeline'])) say(`  ${d}`);
    say('  One row per lead. Fill "Meeting booked on", "Proposal sent on" and "Closed on" with dates;');
    say('  those dates are what the funnel counts. Stage is free text: "Call booked", "Won", "Lost".');
    return;
  }
  set('PIPELINE_SOURCE', 'clickup');
  say('  ClickUp token: ClickUp, your avatar bottom left, Settings, Apps, API Token, Generate. Starts with pk_.');
  for (;;) {
    const token = await ask('ClickUp API token', env.CLICKUP_API_TOKEN ?? '');
    if (!token) { say('  Skipped. The pipeline page stays off until you add it.'); set('PIPELINE_SOURCE', 'none'); return; }
    const h = { Authorization: token };
    try {
      const teams = (await get('https://api.clickup.com/api/v2/team', h) as { teams: { id: string; name: string }[] }).teams;
      set('CLICKUP_API_TOKEN', token);
      const lists: { id: string; name: string; team: string; path: string }[] = [];
      for (const t of teams) {
        const spaces = (await get(`https://api.clickup.com/api/v2/team/${t.id}/space?archived=false`, h) as { spaces: { id: string; name: string }[] }).spaces;
        for (const s of spaces) {
          const folders = (await get(`https://api.clickup.com/api/v2/space/${s.id}/folder?archived=false`, h) as { folders: { name: string; lists: { id: string; name: string }[] }[] }).folders;
          for (const f of folders) for (const l of f.lists) lists.push({ id: l.id, name: l.name, team: t.id, path: `${t.name} / ${s.name} / ${f.name} / ${l.name}` });
          const loose = (await get(`https://api.clickup.com/api/v2/space/${s.id}/list?archived=false`, h) as { lists: { id: string; name: string }[] }).lists;
          for (const l of loose) lists.push({ id: l.id, name: l.name, team: t.id, path: `${t.name} / ${s.name} / ${l.name}` });
        }
      }
      say(`  ok, ${teams.length} workspace${teams.length === 1 ? '' : 's'}, ${lists.length} lists`);
      const current = lists.findIndex((l) => l.id === env.CLICKUP_LIST_ID);
      const i = await pick('Which list is the sales pipeline?', lists.map((l) => `${l.path}  (${l.id})`), current < 0 ? 0 : current);
      set('CLICKUP_LIST_ID', lists[i].id);
      set('CLICKUP_TEAM_ID', lists[i].team);
      const { stageOf } = await import('../lib/stages');
      const detail = await get(`https://api.clickup.com/api/v2/list/${lists[i].id}`, h) as { statuses: { status: string }[] };
      say('  Its statuses, and the stage each one counts as:');
      for (const s of detail.statuses) say(`    ${s.status.padEnd(24)} ${stageOf(s.status)}`);
      say('  If a mapping is wrong, rename the status in ClickUp to contain "meeting", "proposal", "won" or "lost".');
      say('  The stage history is written by a webhook that npm run deploy creates once the page is live.');
      return;
    } catch (e) {
      say(`  ClickUp did not accept that: ${e instanceof Error ? e.message : e}`);
    }
  }
}

async function optional(): Promise<void> {
  head('5. Optional tools. Press Enter to skip any of them.');
  say('  Cal.com, the booking page. Settings, Developer, API keys, Add. Starts with cal_.');
  for (;;) {
    const k = await ask('Cal.com API key', env.CALCOM_API_KEY ?? '');
    if (!k) { set('CALCOM_API_KEY', ''); break; }
    if (await tryKey('Cal.com', async () => { const b = await get('https://api.cal.com/v2/bookings?take=1', { Authorization: `Bearer ${k}`, 'cal-api-version': '2024-08-13' }) as { data?: unknown[] }; return `${b.data ? 'bookings readable' : 'connected'}`; })) { set('CALCOM_API_KEY', k); break; }
  }
  say('  Instantly, the cold email sender. Settings, Integrations, API keys, Create. Needs the all scopes key.');
  for (;;) {
    const k = await ask('Instantly API key', env.INSTANTLY_API_KEY ?? '');
    if (!k) { set('INSTANTLY_API_KEY', ''); break; }
    if (await tryKey('Instantly', async () => { const b = await get('https://api.instantly.ai/api/v2/campaigns?limit=100', { Authorization: `Bearer ${k}` }) as { items: unknown[] }; return `${b.items.length} campaigns`; })) {
      set('INSTANTLY_API_KEY', k);
      set('INSTANTLY_TIMEZONE', await ask('Timezone your campaign schedules are set in', env.INSTANTLY_TIMEZONE || answers.TIMEZONE));
      break;
    }
  }
  say('  Vollna, the only readable source of Upwork proposal results (viewed, interviewed, hired).');
  say('  vollna.com, Settings, API, copy the token. Own data is free; the dashboard never reads job posts.');
  for (;;) {
    const k = await ask('Vollna API token', env.VOLLNA_API_TOKEN ?? '');
    if (!k) { set('VOLLNA_API_TOKEN', ''); break; }
    try {
      const b = await get('https://api.vollna.com/v1/profiles', { 'X-API-TOKEN': k }) as { data: { id: number; label: string }[] };
      set('VOLLNA_API_TOKEN', k);
      if (!b.data.length) { say('  ok, but no Upwork profile is connected in Vollna yet'); break; }
      const i = b.data.length === 1 ? 0 : await pick('Which Upwork profile?', b.data.map((p) => `${p.label} (${p.id})`), Math.max(0, b.data.findIndex((p) => String(p.id) === env.VOLLNA_PROFILE_ID)));
      set('VOLLNA_PROFILE_ID', String(b.data[i].id));
      say(`  ok, ${b.data[i].label}`);
      break;
    } catch (e) { say(`  Vollna did not accept that: ${e instanceof Error ? e.message : e}`); }
  }
  say('  Stripe, balance only. Developers, API keys, Create restricted key, Balance: Read. Starts with rk_live_.');
  for (;;) {
    const k = await ask('Stripe restricted key', env.STRIPE_API_KEY ?? '');
    if (!k) { set('STRIPE_API_KEY', ''); break; }
    if (await tryKey('Stripe', async () => { await get('https://api.stripe.com/v1/balance', { Authorization: `Bearer ${k}` }); return 'balance readable'; })) { set('STRIPE_API_KEY', k); break; }
  }
  say('  Beehiiv, the newsletter tool. Settings, API, Create new API key. Shown once.');
  say('  The publication id is on the same page, under API V2. It starts with pub_.');
  for (;;) {
    const k = await ask('Beehiiv API key', env.BEEHIIV_API_KEY ?? '');
    if (!k) { set('BEEHIIV_API_KEY', ''); break; }
    const id = await ask('Beehiiv publication id', env.BEEHIIV_PUBLICATION_ID ?? '');
    if (await tryKey('Beehiiv', async () => { const b = await get(`https://api.beehiiv.com/v2/publications/${encodeURIComponent(id)}`, { Authorization: `Bearer ${k}` }) as { data?: { name?: string } }; return b.data?.name ? `newsletter "${b.data.name}"` : 'connected'; })) {
      set('BEEHIIV_API_KEY', k);
      set('BEEHIIV_PUBLICATION_ID', id);
      set('NEWSLETTER_START_AT', await ask('How many subscribers before the weekly email starts', env.NEWSLETTER_START_AT || '50'));
      set('NEWSLETTER_IGNORE_EMAILS', await ask('Your own test addresses to leave out of every count, comma separated, optional', env.NEWSLETTER_IGNORE_EMAILS ?? ''));
      break;
    }
  }
}

async function business(): Promise<void> {
  head('Your business');
  set('BUSINESS_NAME', await ask('Business name, shown top left', env.BUSINESS_NAME || 'My agency'));
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  set('TIMEZONE', await ask('Timezone, for "today" and the week boundaries', env.TIMEZONE || zone));
  set('CURRENCY', (await ask('Currency code', env.CURRENCY || 'USD')).toUpperCase());
  const logo = await ask('Path to a square logo PNG, optional', '');
  if (logo) {
    const path = resolve(logo.replace(/^['"]|['"]$/g, '').replace(/\\ /g, ' '));
    if (existsSync(path)) { copyFileSync(path, resolve('public/logo.png')); set('LOGO_URL', '/logo.png'); say('  copied to public/logo.png'); } else say('  no file there, skipped');
  } else if (env.LOGO_URL) set('LOGO_URL', env.LOGO_URL);
}

async function channels(): Promise<void> {
  head('6. Channels and categories');
  say('  A channel is a way clients find you. Every Ledger row carries one, plus Overhead for costs');
  say('  that are about nothing in particular. The Money page compares them side by side.');
  const suggested = env.CHANNELS || [answers.VOLLNA_API_TOKEN ? 'Upwork' : '', answers.INSTANTLY_API_KEY ? 'Cold email' : '', 'Network', 'Website'].filter(Boolean).join(', ');
  set('CHANNELS', await ask('Channels, comma separated', suggested));
  set('CATEGORIES', await ask('What money comes in for, comma separated', env.CATEGORIES || 'Consultation, Build, Maintenance, Training, Other'));
  set('TAX_RATE', await ask('Share of profit to set aside for tax, 0.28 means 28%, 0 to hide', env.TAX_RATE || '0.28'));
}

async function password(): Promise<void> {
  head('7. The password');
  const current = env.DASHBOARD_PASSWORD;
  const p = await ask(current ? 'New password, or Enter to keep the current one' : 'Password for the page, or Enter to have one made', '');
  const value = p || current || randomBytes(9).toString('base64url');
  set('DASHBOARD_PASSWORD', value);
  if (!p && !current) say(`  Made one: ${value}   (write it down, it is in .env.local too)`);
  set('DASHBOARD_SESSION_SECRET', env.DASHBOARD_SESSION_SECRET || randomBytes(32).toString('hex'));
}

async function main(): Promise<void> {
  if (process.argv.includes('--sheets')) {
    const { ensureTabs } = await import('../lib/sources/sheetsAdmin');
    const dash = env.DASHBOARD_SHEET_ID || env.PNL_SHEET_ID;
    if (!dash) throw new Error('No sheet configured yet. Run npm run setup first.');
    if (env.PNL_SHEET_ID) for (const d of await ensureTabs(env.PNL_SHEET_ID, ['Ledger', 'Recurring'])) say(d);
    for (const d of await ensureTabs(dash, ['Stage log', 'Notes', 'Cold email runs', ...(env.PIPELINE_SOURCE === 'sheet' ? ['Pipeline'] : [])])) say(d);
    say('tabs ready');
    rl.close();
    return;
  }
  say('\nSolumbra dashboard, setup.');
  say(`Answers go to ${ENV_PATH}. Nothing else leaves this computer. Press Ctrl+C to stop at any time.`);
  await business();
  const g = await google();
  if (g) await sheets(); else say('  Skipped Google. Run npm run setup again when you have the JSON file.');
  await pipeline();
  await optional();
  await channels();
  await password();
  saveEnv(answers);
  head('Saved. Checking every connection once.');
  Object.assign(process.env, answers);
  const rows = await checkAll();
  printRows(rows);
  head('Next');
  say('  npm run dev      the dashboard on http://localhost:3000, log in with the password');
  say('  npm run deploy   put it on the web with Vercel (free account), then share the address with nobody');
  rl.close();
}

main().catch((e) => { console.error(`\n${e instanceof Error ? e.message : e}\n`); rl.close(); process.exit(1); });
