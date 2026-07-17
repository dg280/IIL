// Banc du pipeline de sécurité complet, via la vraie UI (onboarding → photomaton)
// et l'API LiberTai simulée : prompts, juge de vision (preuve-de-vue), chemins
// UNSAFE → régénération couverte → rhabillage, toujours-un-résultat.
import { launchBrowser, makeContext, makeFixtures, makeChecker } from './helpers.mjs'

const BANNED = /(nudity|naked|nude|topless|underwear|lingerie|cleavage|sexualized|suggestive|bikini|swimsuit|nsfw|breast|panties)/i

async function onboardToMaker(page, baseUrl) {
  await page.goto(baseUrl)
  await page.waitForSelector('.onboarding', { timeout: 15000 })
  await page.fill('#player-name', 'Testeuse')
  await page.click('button:has-text("C\'est parti")')
  await page.click('.univers-card >> nth=0')
  await page.waitForSelector('.maker-screen')
}

export async function runSafetySuite(baseUrl) {
  const browser = await launchBrowser()
  const fixtures = await makeFixtures(browser)
  const { check, fails } = makeChecker()
  const viewport = { width: 390, height: 844 }

  // 1 — génération normale : prompt sain, juge appelé avec preuve-de-vue
  {
    const { ctx, calls } = await makeContext(browser, fixtures, { viewport, mobile: true })
    const page = await ctx.newPage()
    await onboardToMaker(page, baseUrl)
    await page.click('.maker-seg button:has-text("Visage")')
    await page.click('.seed-chip-label:has-text("yeux bleus")')
    await page.click('.screen-actions .btn-primary')
    await page.waitForSelector('.portrait-img', { timeout: 20000 })
    const p = calls.txt2img[0]?.prompt ?? ''
    check('prompt sans token interdit', !BANNED.test(p), (p.match(BANNED) ?? [])[0])
    check('ancre de registre en tête', p.startsWith('Family-friendly anime character illustration'))
    check('regard caméra (yeux bleus)', /looks straight at the viewer/.test(p))
    check('juge de vision appelé sur modèle vision', calls.judge[0]?.model === 'gemma-4-31b-it', calls.judge[0]?.model)
    const judgeContent = calls.judge[0]?.messages?.[0]?.content ?? []
    check('image transmise au juge (data URI)', judgeContent.some?.((c) => c.type === 'image_url' && c.image_url?.url?.startsWith('data:image/')))
    await ctx.close()
  }

  // 2 — UNSAFE → régénération en tenue couverte, graine neuve, image livrée
  {
    const { ctx, calls } = await makeContext(browser, fixtures, {
      viewport,
      mobile: true,
      judgeQueue: ['DESC: partially dressed character VERDICT: UNSAFE', 'DESC: clothed anime character standing VERDICT: SAFE'],
    })
    const page = await ctx.newPage()
    await onboardToMaker(page, baseUrl)
    await page.click('.screen-actions .btn-primary')
    await page.waitForSelector('.portrait-img', { timeout: 30000 })
    check('UNSAFE → une régénération', calls.txt2img.length === 2, `${calls.txt2img.length}`)
    check('régénération en tenue ultra-couvrante', /fully covering formal school uniform/.test(calls.txt2img[1]?.prompt ?? ''))
    check('graine changée', calls.txt2img[0].seed !== calls.txt2img[1].seed)
    await ctx.close()
  }

  // 3 — juge aveugle (NOIMAGE, image strippée) : pas de faux SAFE, pixels décident
  {
    const { ctx, calls } = await makeContext(browser, fixtures, { viewport, mobile: true, judgeQueue: Array(4).fill('NOIMAGE') })
    const page = await ctx.newPage()
    await onboardToMaker(page, baseUrl)
    await page.click('.screen-actions .btn-primary')
    await page.waitForSelector('.portrait-img', { timeout: 20000 })
    check('NOIMAGE → génération aboutit via pixels, sans confiance aveugle', calls.txt2img.length === 1)
    await ctx.close()
  }

  // 4 — SAFE sans preuve-de-vue : traité comme indisponible
  {
    const { ctx, calls } = await makeContext(browser, fixtures, { viewport, mobile: true, judgeQueue: ['SAFE'] })
    const page = await ctx.newPage()
    await onboardToMaker(page, baseUrl)
    await page.click('.screen-actions .btn-primary')
    await page.waitForSelector('.portrait-img', { timeout: 20000 })
    check('SAFE sans description → indisponible (pixels seuls)', calls.txt2img.length === 1)
    await ctx.close()
  }

  // 5 — juge TOUJOURS UNSAFE : rhabillage qwen-image-edit, résultat quand même
  {
    const { ctx, calls } = await makeContext(browser, fixtures, {
      viewport,
      mobile: true,
      judgeQueue: Array(10).fill('DESC: character VERDICT: UNSAFE'),
    })
    const page = await ctx.newPage()
    await onboardToMaker(page, baseUrl)
    await page.click('.screen-actions .btn-primary')
    await page.waitForSelector('.portrait-img', { timeout: 40000 })
    check('toujours UNSAFE → portrait QUAND MÊME affiché', true)
    check('3 générations + 1 secours tentées', calls.txt2img.length === 4, `${calls.txt2img.length}`)
    check('rhabillage appelé (multipart)', calls.edits.length === 1 && (calls.edits[0] ?? '').includes('multipart/form-data'))
    const msg = await page.locator('.hint-center').textContent().catch(() => '')
    check('aucun message d’échec', !/pas comme il faut|pas réussi/.test(msg ?? ''), msg ?? '')
    await ctx.close()
  }

  await browser.close()
  console.log(`pipeline sécurité : ${fails === 0 ? 'tout vert' : fails + ' échec(s)'}`)
  return fails
}
