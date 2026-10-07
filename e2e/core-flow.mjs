/** Isolated, real HTTP + browser smoke test. Never targets an existing deployment. */
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import net from 'node:net';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = path.resolve(process.env.JIANWAI_API_REPO || path.join(web, '../jianwai-api'));
const python = process.env.JIANWAI_API_PYTHON || path.join(api, '.venv/bin/python');
const temp = await mkdtemp(path.join(os.tmpdir(), 'jianwai-e2e-'));
const fixtureImage = path.join(temp, 'image.png');
const output = path.join(web, 'test-results/core-flow');
await mkdir(output, { recursive: true });
const origin = 'http://127.0.0.1:5175';
const backend = 'http://127.0.0.1:8015';
const password = randomBytes(24).toString('base64url');
const testEnv = { ...process.env, APP_ENV: 'test', DATABASE_URL: 'sqlite:///' + path.join(temp, 'test.db'),
  ALLOWED_ORIGINS: origin, PUBLIC_WEB_URL: origin, COOKIE_SECURE: 'false', MEDIA_DIR: path.join(temp, 'media'),
  OUTBOX_DIR: path.join(temp, 'outbox'), SMTP_HOST: '', SMTP_FROM: '', BOOTSTRAP_PASSWORD: password };
const children = [];
let browser;
const checks = [];
const record = label => { checks.push(label); process.stdout.write('PASS ' + label + '\n'); };
function command(args) {
  const r = spawnSync(python, args, { cwd: api, env: testEnv, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('API setup failed: ' + (r.stderr || r.stdout).slice(-2000));
}
function server(cmd, args, cwd, env) {
  const child = spawn(cmd, args, { cwd, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  child.diagnostic = '';
  for (const pipe of [child.stdout, child.stderr]) pipe.on('data', chunk => { child.diagnostic = (child.diagnostic + chunk).slice(-5000); });
  children.push(child); return child;
}
async function waitForServer(url, child) {
  const until = Date.now() + 45000;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error('Server exited: ' + child.diagnostic);
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Server not ready: ' + url + '\n' + child.diagnostic);
}
async function login(page, email) {
  await page.goto(origin + '/login');
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL('**/workspace');
}
async function outboxToken(email) {
  for (const name of await readdir(testEnv.OUTBOX_DIR)) {
    if (!name.endsWith('.json')) continue;
    const mail = JSON.parse(await readFile(path.join(testEnv.OUTBOX_DIR, name), 'utf8'));
    if (mail.to === email) return mail.token;
  }
  throw new Error('Local verification email missing');
}
async function apiRequest(context, endpoint, method = 'GET', body) {
  const session = await (await context.request.get(origin + '/api/v1/auth/session')).json();
  return context.request.fetch(origin + '/api/v1' + endpoint, { method, headers: { Origin: origin, 'X-CSRF-Token': session.csrf_token }, ...(body === undefined ? {} : { data: body }) });
}
async function requireUnusedPort(port) {
  await new Promise((resolve, reject) => {
    const probe = net.connect({ host: '127.0.0.1', port });
    probe.once('connect', () => { probe.destroy(); reject(new Error('Port ' + port + ' is already in use; refusing to target another service')); });
    probe.once('error', error => { if (error.code === 'ECONNREFUSED') resolve(); else reject(error); });
  });
}
try {
  await requireUnusedPort(8015);
  await requireUnusedPort(5175);
  // Every run gets its own file database, media and mail directory.
  command(['-m', 'alembic', 'upgrade', 'head']);
  command(['-m', 'app.cli', 'bootstrap', '--email', 'founder@example.com', '--display-name', '影像社团主', '--club-slug', 'film-club', '--club-name', '影像漫游']);
  command(['-c', 'from PIL import Image; import sys; Image.new("RGB", (2, 2), "white").save(sys.argv[1])', fixtureImage]);
  const apiProcess = server(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8015', '--no-access-log'], api, testEnv);
  await waitForServer(backend + '/api/v1/health', apiProcess);
  const webProcess = server('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5175', '--strictPort'], web, { ...process.env, VITE_API_PROXY_TARGET: backend });
  await waitForServer(origin, webProcess);
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  const founder = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const writer = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ownerPage = await founder.newPage(), page = await writer.newPage(), guestPage = await guest.newPage();
  const errors = [];
  for (const p of [ownerPage, page, guestPage]) p.on('pageerror', error => errors.push(error.message));
  await login(ownerPage, 'founder@example.com');
  const clubs = await (await apiRequest(founder, '/clubs')).json();
  const club = clubs.items[0]; assert.ok(club.id);
  await guestPage.goto(origin + '/clubs');
  await expect(guestPage.getByText('你还没有加入社团')).toBeVisible();
  await expect(guestPage.getByText(club.name)).toHaveCount(0);
  await ownerPage.goto(origin + '/clubs/' + club.id);
  await ownerPage.locator('summary').filter({ hasText: '邀请同好' }).click();
  await ownerPage.getByLabel('绑定邮箱', { exact: true }).fill('writer@example.com');
  const invited = ownerPage.waitForResponse(r => r.url().endsWith('/clubs/' + club.id + '/invites') && r.request().method() === 'POST');
  await ownerPage.getByRole('button', { name: '生成邀请码', exact: true }).click();
  const invitation = await (await invited).json(); assert.ok(invitation.code);
  await expect(ownerPage.locator('.code-once')).toBeVisible();
  record('owner creates a scoped, email-bound invitation in the UI');

  await page.goto(origin + '/register');
  await page.getByLabel('昵称', { exact: true }).fill('林间散步');
  await page.getByLabel('邮箱', { exact: true }).fill('writer@example.com');
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '注册并发送验证邮件', exact: true }).click();
  await page.waitForURL('**/verify');
  const token = await outboxToken('writer@example.com');
  await page.goto(origin + '/verify?token=' + encodeURIComponent(token));
  await page.getByRole('button', { name: '验证邮箱', exact: true }).click();
  await expect(page.getByText('邮箱验证完成', { exact: true })).toBeVisible();
  assert.equal(new URL(page.url()).search, '');
  record('real registration, one-use email verification, token removed from address bar');

  await page.goto(origin + '/join');
  await page.getByLabel('邀请码', { exact: true }).fill(invitation.code);
  await page.getByRole('button', { name: '预览邀请', exact: true }).click();
  await expect(page.getByRole('button', { name: '接受邀请', exact: true })).toBeVisible();
  const before = await (await apiRequest(founder, '/clubs/' + club.id + '/invites')).json();
  assert.equal(before.items.find(i => i.id === invitation.id).status, 'active');
  await page.getByRole('button', { name: '接受邀请', exact: true }).click();
  await page.waitForURL('**/clubs/' + club.id);
  await page.goto(origin + '/clubs');
  await expect(page.getByText(club.name).first()).toBeVisible();
  record('preview does not consume; acceptance joins the verified account');

  await page.goto(origin + '/workspace');
  const draftCreated = page.waitForResponse(r => r.url().endsWith('/drafts') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '新建草稿', exact: true }).click();
  const draft = await (await draftCreated).json(); assert.ok(draft.id);
  await page.waitForURL('**/write/' + draft.id);
  await page.getByLabel('文章标题', { exact: true }).fill('在城市缝隙里，记录一束迟到的光');
  const editor = page.getByLabel('富文本正文', { exact: true });
  await editor.fill('');
  await editor.pressSequentially('慢下来，才看得见日常里的光。');
  await editor.press('Shift+Enter');
  await editor.pressSequentially('这是一篇经过真实云草稿保存与审核的作品。');
  await editor.press('ControlOrMeta+A');
  const toolbar = page.getByRole('toolbar', { name: '正文格式', exact: true });
  await toolbar.getByRole('button', { name: '加粗', exact: true }).click();
  page.once('dialog', dialog => dialog.accept('https://example.com/photography'));
  await toolbar.getByRole('button', { name: '选区链接', exact: true }).click();
  await editor.press('ControlOrMeta+End');
  await editor.press('Enter');

  const uploaded = page.waitForResponse(r => r.url().endsWith('/drafts/' + draft.id + '/media') && r.request().method() === 'POST');
  await page.getByLabel('上传正文图片', { exact: true }).setInputFiles(fixtureImage);
  const assetResponse = await uploaded; assert.equal(assetResponse.status(), 201);
  const asset = await assetResponse.json();
  await page.getByLabel('图片图注', { exact: true }).fill('午后的窗边，光落在胶片与纸页上。');
  await page.getByLabel('图片替代文字', { exact: true }).fill('桌面上的相机、纸页与窗边光影');
  assert.equal((await apiRequest(guest, '/media/' + asset.id)).status(), 404);
  await page.getByRole('button', { name: '立即保存', exact: true }).click();
  await expect(page.getByText('已保存', { exact: false }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('文章标题', { exact: true })).toHaveValue('在城市缝隙里，记录一束迟到的光');
  await expect(page.getByLabel('富文本正文', { exact: true })).toContainText('慢下来');
  const roundtrip = await (await apiRequest(writer, '/drafts/' + draft.id)).json();
  const richJSON = JSON.stringify(roundtrip.body);
  assert.ok(richJSON.includes('https://example.com/photography'));
  assert.ok(richJSON.includes('hardBreak'));
  assert.ok(richJSON.includes('bold'));
  await expect(page.getByLabel('图片图注', { exact: true })).toHaveValue('午后的窗边，光落在胶片与纸页上。');
  record('real Tiptap link, marked soft break, image and caption survive cloud save and reload');
  await page.screenshot({ path: path.join(output, 'editor-desktop.png'), fullPage: true });

  await page.getByRole('button', { name: '发布', exact: true }).click();
  await page.getByLabel('所属社团', { exact: true }).selectOption(club.id);
  await page.getByLabel('阅读范围', { exact: true }).selectOption('public');
  await page.getByLabel('文章标签', { exact: true }).fill('摄影,日常');
  const published = page.waitForResponse(r => r.url().endsWith('/drafts/' + draft.id + '/publish') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '提交发布', exact: true }).click();
  const posted = await published; assert.equal(posted.status(), 201);
  const post = await posted.json(); assert.equal(post.status, 'pending');
  assert.equal((await apiRequest(guest, '/posts/' + post.id)).status(), 404);
  record('public submission is invisible to guests until review');

  await ownerPage.goto(origin + '/reviews');
  // The approval must expose the full fixed document before it is actionable.
  await expect(ownerPage.getByText('在城市缝隙里，记录一束迟到的光', { exact: false }).first()).toBeVisible();
  await ownerPage.getByRole('button', { name: '阅读完整投稿', exact: true }).first().click();
  await expect(ownerPage.getByText('慢下来，才看得见日常里的光。', { exact: false }).first()).toBeVisible();
  const approval = ownerPage.waitForResponse(r => r.url().endsWith('/posts/' + post.id + '/review') && r.request().method() === 'POST');
  await ownerPage.getByRole('button', { name: '通过并公开', exact: true }).first().click();
  assert.equal((await approval).status(), 200);
  await guestPage.goto(origin + '/posts/' + post.id);
  await expect(guestPage.getByRole('heading', { name: post.title, exact: true })).toBeVisible();
  await expect(guestPage.getByText('慢下来，才看得见日常里的光。', { exact: false }).first()).toBeVisible();
  const overflow = await guestPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false);
  assert.equal((await apiRequest(guest, '/media/' + asset.id)).status(), 200);
  await expect(guestPage.getByText('午后的窗边，光落在胶片与纸页上。', { exact: true })).toBeVisible();
  record('owner approves the fixed snapshot; guest reads text and authorized media at 390px without overflow');
  await guestPage.screenshot({ path: path.join(output, 'reader-mobile.png'), fullPage: true });

  await page.goto(origin + '/posts/' + post.id);
  await page.getByLabel('评论内容', { exact: true }).fill('喜欢这里对光的观察，期待下一篇。');
  await page.getByRole('button', { name: '发送评论', exact: true }).click();
  await expect(page.getByText('喜欢这里对光的观察，期待下一篇。', { exact: true })).toBeVisible();
  assert.equal((await apiRequest(guest, '/posts/' + post.id + '/comments', 'POST', { body: 'unauthorized' })).status(), 401);
  record('member can comment; guest cannot write a comment');
  // A private publication lets us verify logout invalidates already-rendered data,
  // not just that a fresh unauthenticated request is denied by the API.
  const privateDraft = await (await apiRequest(writer, '/drafts/' + draft.id)).json();
  const { id: privateDraftId, updated_at: privateUpdated, ...privateWrite } = privateDraft;
  const privateSaved = await (await apiRequest(writer, '/drafts/' + privateDraftId, 'PUT', {
    ...privateWrite, title: '只给社团成员的拍摄手记', summary: '仅社团可见的回顾', scope: 'club'
  })).json();
  const privatePost = await (await apiRequest(writer, '/drafts/' + privateDraftId + '/publish', 'POST', { revision: privateSaved.revision })).json();
  assert.equal(privatePost.scope, 'club');
  await page.goto(origin + '/');
  await expect(page.getByText('只给社团成员的拍摄手记', { exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '退出', exact: true }).click();
  await expect(page.getByRole('link', { name: '登录', exact: true }).first()).toBeVisible();
  await expect(page.getByText('只给社团成员的拍摄手记', { exact: true })).toHaveCount(0);
  assert.equal((await apiRequest(writer, '/posts/' + privatePost.id)).status(), 404);
  record('logout clears the private feed immediately and server still denies private detail');
  assert.deepEqual(errors, []);
  record('no uncaught browser errors across the real flow');
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ status: 'passed', checks, scope: 'isolated SQLite + Vite + FastAPI + Chromium; not a deployed production test' }, null, 2));
} catch (error) {
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ status: 'failed', checks, error: String(error) }, null, 2));
  throw error;
} finally {
  if (browser) await browser.close();
  for (const child of children.reverse()) {
    try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM'); else child.kill('SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  // Keep isolated data outside the repository to aid local failure diagnosis.
}
