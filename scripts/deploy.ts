/**
 * Puts the dashboard on the web with Vercel, the hosting service.
 *
 *   npm run deploy
 *
 * What it does: checks the Vercel command exists, links this folder to a
 * Vercel project (asking the first time), copies every value in .env.local to
 * the project, deploys to production, and if the pipeline is ClickUp, creates
 * the webhook that writes stage changes to the Stage log tab.
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { loadEnv, saveEnv, ENV_NAMES } from './env';

const env = loadEnv();
const say = (t = '') => console.log(t);
const run = (cmd: string, input?: string) => execSync(cmd, { input, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' }).trim();

async function main(): Promise<void> {
  if (!env.DASHBOARD_PASSWORD) throw new Error('No .env.local yet. Run npm run setup first.');
  try { run('vercel --version'); } catch {
    throw new Error('The Vercel command is missing. Install it with: npm install -g vercel   then run: vercel login   and try again.');
  }
  say('\n1. Vercel project');
  if (!existsSync('.vercel/project.json')) {
    say('   Linking this folder to a Vercel project. Answer the questions; the defaults are fine.');
    const r = spawnSync('vercel', ['link'], { stdio: 'inherit', shell: process.platform === 'win32' });
    if (r.status !== 0) throw new Error('Linking did not finish.');
  }
  const project = JSON.parse(readFileSync('.vercel/project.json', 'utf8')) as { projectName: string };
  say(`   ${project.projectName}`);

  say('2. Copying the keys to Vercel');
  let n = 0;
  for (const name of ENV_NAMES) {
    const v = env[name];
    if (!v) continue;
    try { run(`vercel env add ${name} production --force`, v); } catch {
      try { run(`vercel env rm ${name} production --yes`); } catch { /* was not there */ }
      run(`vercel env add ${name} production`, v);
    }
    n++;
  }
  say(`   ${n} values`);

  say('3. Deploying');
  const out = run('vercel deploy --prod --yes');
  const deployUrl = out.match(/https:\/\/[^\s"]+\.vercel\.app/)?.[0] ?? '(see the Vercel dashboard)';
  const live = `https://${project.projectName}.vercel.app`;
  say(`   ${deployUrl}`);

  if (env.PIPELINE_SOURCE === 'clickup' && env.CLICKUP_API_TOKEN && env.CLICKUP_TEAM_ID && env.CLICKUP_LIST_ID) {
    say('4. ClickUp webhook');
    const h = { Authorization: env.CLICKUP_API_TOKEN, 'Content-Type': 'application/json' };
    const listUrl = `https://api.clickup.com/api/v2/team/${env.CLICKUP_TEAM_ID}/webhook`;
    const have = (await (await fetch(listUrl, { headers: h })).json()) as { webhooks?: { id: string; endpoint: string; list_id?: number }[] };
    const mine = (have.webhooks ?? []).find((w) => w.endpoint === `${live}/api/hooks/clickup`);
    if (mine && env.CLICKUP_WEBHOOK_SECRET) say('   already there');
    else {
      if (mine) {
        await fetch(`https://api.clickup.com/api/v2/webhook/${mine.id}`, { method: 'DELETE', headers: h });
        say('   removed an old webhook whose secret was lost');
      }
      const res = await fetch(listUrl, { method: 'POST', headers: h, body: JSON.stringify({ endpoint: `${live}/api/hooks/clickup`, events: ['taskStatusUpdated', 'taskCreated'], list_id: Number(env.CLICKUP_LIST_ID) }) });
      if (!res.ok) throw new Error(`ClickUp would not create the webhook (${res.status}): ${(await res.text()).slice(0, 160)}`);
      const made = (await res.json()) as { webhook: { secret: string } };
      saveEnv({ CLICKUP_WEBHOOK_SECRET: made.webhook.secret });
      run('vercel env add CLICKUP_WEBHOOK_SECRET production --force', made.webhook.secret);
      say('   created. Deploying once more so the page knows its secret.');
      run('vercel deploy --prod --yes');
    }
  }

  say('5. Checking the live page');
  const code = (await fetch(`${live}/api/data`)).status;
  say(code === 401 ? '   /api/data refuses without a login, good' : `   /api/data answered ${code}, expected 401`);
  say(`\nLive at ${live}\nLog in with the password from .env.local.\n`);
}

main().catch((e) => { console.error(`\n${e instanceof Error ? e.message : e}\n`); process.exit(1); });
