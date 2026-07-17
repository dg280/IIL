// Aides e2e : Chromium headless + API LiberTai SIMULÉE (aucun appel réseau réel,
// aucune clé) + fixtures synthétiques dessinées dans le navigateur.
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const ARTIFACTS = fileURLToPath(new URL('./.artifacts/', import.meta.url))
mkdirSync(ARTIFACTS, { recursive: true })

/** Chromium : chemin fourni par la CI (CELESTINE_CHROMIUM) ou celui du sandbox. */
export function chromiumPath() {
  const p = process.env.CELESTINE_CHROMIUM ?? '/opt/pw-browsers/chromium'
  if (!existsSync(p)) {
    throw new Error(`Chromium introuvable (${p}) — définis CELESTINE_CHROMIUM vers un binaire Chrome/Chromium.`)
  }
  return p
}

export async function launchBrowser() {
  return chromium.launch({ executablePath: chromiumPath() })
}

/** PNG de portrait « habillé » (détouré) + décor 16:9, dessinés une fois. */
export async function makeFixtures(browser) {
  const pngPath = ARTIFACTS + 'fixture-portrait.png'
  const bgPath = ARTIFACTS + 'fixture-bg.png'
  if (existsSync(pngPath) && existsSync(bgPath)) {
    return { portrait: readFileSync(pngPath), bg: readFileSync(bgPath) }
  }
  const page = await browser.newPage()
  const [portraitB64, bgB64] = await page.evaluate(async () => {
    function drawPortrait(hue) {
      const W = 768, H = 1152
      const c = document.createElement('canvas'); c.width = W; c.height = H
      const g = c.getContext('2d')
      const bx = W / 2, top = H * 0.04, bh = H * 0.93
      const y = (f) => top + f * bh
      g.fillStyle = '#f3c9a2'
      g.beginPath(); g.ellipse(bx, y(0.075), bh * 0.052, bh * 0.062, 0, 0, 7); g.fill()
      g.fillStyle = `hsl(${hue}, 45%, 30%)`
      g.beginPath(); g.ellipse(bx, y(0.045), bh * 0.055, bh * 0.035, 0, Math.PI, 0); g.fill()
      g.fillStyle = '#f3c9a2'
      g.fillRect(bx - bh * 0.015, y(0.125), bh * 0.03, bh * 0.045)
      g.fillStyle = `hsl(${hue}, 60%, 45%)`
      g.fillRect(bx - bh * 0.08, y(0.16), bh * 0.16, bh * 0.36)
      g.fillStyle = `hsl(${(hue + 40) % 360}, 50%, 35%)`
      g.fillRect(bx - bh * 0.05, y(0.52), bh * 0.04, bh * 0.46)
      g.fillRect(bx + bh * 0.01, y(0.52), bh * 0.04, bh * 0.46)
      return c.toDataURL('image/png').split(',')[1]
    }
    function drawBg() {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 576
      const g = c.getContext('2d')
      const grad = g.createLinearGradient(0, 0, 0, 576)
      grad.addColorStop(0, '#bfe3ff'); grad.addColorStop(1, '#ffd9ec')
      g.fillStyle = grad; g.fillRect(0, 0, 1024, 576)
      g.fillStyle = '#7fbf7f'; g.fillRect(0, 430, 1024, 146)
      return c.toDataURL('image/png').split(',')[1]
    }
    return [drawPortrait(210), drawBg()]
  })
  await page.close()
  const portrait = Buffer.from(portraitB64, 'base64')
  const bg = Buffer.from(bgB64, 'base64')
  writeFileSync(pngPath, portrait)
  writeFileSync(bgPath, bg)
  return { portrait, bg }
}

/** Contexte navigateur : localStorage pré-rempli (clé factice + debug) + API simulée.
 *  `judgeQueue` scénarise les verdicts du juge de vision. */
export async function makeContext(browser, fixtures, { viewport, mobile = false, judgeQueue = [] } = {}) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    hasTouch: mobile,
    isMobile: mobile,
    userAgent: mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
  })
  await ctx.addInitScript(`(() => {
    try { void window.localStorage } catch { return }
    localStorage.setItem('celestine.ai_config', JSON.stringify({
      provider: 'libertai', apiKey: 'e2e-test-key', imageModel: 'z-image-turbo', videoModel: '',
      textModel: 'hermes-3-8b-tee', baseUrl: 'https://api.libertai.io', maxImagesPerDay: 40, maxVideosPerDay: 0,
    }))
    localStorage.setItem('celestine.debug', '1')
  })()`)
  const calls = { txt2img: [], chat: [], judge: [], edits: [], models: 0 }
  await ctx.route('**/api.libertai.io/**', async (route) => {
    const url = route.request().url()
    let body = null
    try {
      body = route.request().postDataJSON?.() ?? null
    } catch {
      /* multipart (edits) : pas du JSON */
    }
    if (url.includes('/v1/models')) {
      calls.models++
      return route.fulfill({
        json: { data: [{ id: 'z-image-turbo' }, { id: 'hermes-3-8b-tee' }, { id: 'gemma-4-31b-it' }, { id: 'qwen3.6-27b' }] },
      })
    }
    if (url.includes('/sdapi/v1/txt2img')) {
      calls.txt2img.push(body)
      const isBg = body && body.width > body.height
      const b64 = (isBg ? fixtures.bg : fixtures.portrait).toString('base64')
      await new Promise((r) => setTimeout(r, 120))
      return route.fulfill({ json: { images: [b64] } })
    }
    if (url.includes('/v1/images/edits')) {
      calls.edits.push(route.request().headers()['content-type'] ?? '')
      return route.fulfill({ json: { data: [{ b64_json: fixtures.portrait.toString('base64') }] } })
    }
    if (url.includes('/v1/chat/completions')) {
      const content = body?.messages?.[0]?.content
      const isJudge = Array.isArray(content) && content.some((p) => p.type === 'image_url')
      if (isJudge) {
        calls.judge.push(body)
        const reply = judgeQueue.length ? judgeQueue.shift() : 'DESC: clothed anime character standing VERDICT: SAFE'
        return route.fulfill({ json: { choices: [{ message: { content: reply } }] } })
      }
      calls.chat.push(body)
      return route.fulfill({ json: { choices: [{ message: { content: 'Idée : un pique-nique sous les cerisiers.' } }] } })
    }
    return route.fulfill({ status: 404, json: { error: 'route non simulée: ' + url } })
  })
  // le worker de bugs ne doit jamais être appelé pendant les tests
  await ctx.route('**/celestine-bugs.dg-66b.workers.dev/**', (route) => route.fulfill({ json: { ok: true } }))
  const errors = []
  ctx.on('page', (p) => {
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 300)}`) })
    p.on('pageerror', (e) => errors.push(`[pageerror] ${String(e).slice(0, 300)}`))
  })
  return { ctx, calls, errors }
}

/** Compteur simple ✓/✗ partagé par les suites. */
export function makeChecker() {
  let fails = 0
  return {
    check(label, ok, detail = '') {
      console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ' — ' + detail : ''}`)
      if (!ok) fails++
    },
    get fails() {
      return fails
    },
  }
}
