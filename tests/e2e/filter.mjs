// Banc du filtre d'images par zones (src/atelier/imagemod.ts) : silhouettes
// anime synthétiques, 4 carnations × tenues sûres/dénudées, fonds détourés et
// opaques. Politique famille : torse couvert ET jupe au genou.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ARTIFACTS, launchBrowser, makeChecker } from './helpers.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))

export async function runFilterSuite() {
  // transpile le cœur pur + le wrapper navigateur, puis les concatène pour
  // injection dans la page (imports/exports retirés — même portée globale)
  const tsc = spawnSync('npx', ['tsc', 'src/atelier/imagecore.ts', 'src/atelier/imagemod.ts', '--outDir', ARTIFACTS, '--target', 'es2020', '--module', 'es2015', '--moduleResolution', 'node', '--lib', 'dom,es2020'], { cwd: root, encoding: 'utf8' })
  if (tsc.status !== 0) throw new Error('transpilation imagemod: ' + tsc.stdout + tsc.stderr)
  const strip = (f) =>
    readFileSync(ARTIFACTS + f, 'utf8')
      .replace(/^import .*$/gm, '')
      .replace(/export\s+(async\s+)?function/g, '$1function')
      .replace(/export\s+(const|let|class)/g, '$1')
      .replace(/export\s*\{[^}]*\};?/g, '')
  const code = strip('imagecore.js') + '\n' + strip('imagemod.js')

  const browser = await launchBrowser()
  const page = await browser.newPage()
  const results = await page.evaluate(`(async () => {
    ${code}

    const SKINS = ['#ffe0c4', '#f3c9a2', '#c68a5e', '#6d4327']

    function draw(skin, clothes, bg) {
      const W = 768, H = 1152
      const c = document.createElement('canvas'); c.width = W; c.height = H
      const g = c.getContext('2d')
      if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, H) }
      const bx = W * 0.5
      const top = H * 0.04, bot = H * 0.97, bh = bot - top
      const y = f => top + f * bh
      g.fillStyle = skin
      g.beginPath(); g.ellipse(bx, y(0.075), bh*0.052, bh*0.062, 0, 0, 7); g.fill()
      g.fillStyle = '#7a4a2b'
      g.beginPath(); g.ellipse(bx, y(0.045), bh*0.055, bh*0.035, 0, Math.PI, 0); g.fill()
      g.fillStyle = skin
      g.fillRect(bx - bh*0.015, y(0.125), bh*0.03, bh*0.045)
      const torso = (color, f0, f1, w0, w1) => {
        g.fillStyle = color
        g.beginPath()
        g.moveTo(bx - w0*bh, y(f0)); g.lineTo(bx + w0*bh, y(f0))
        g.lineTo(bx + w1*bh, y(f1)); g.lineTo(bx - w1*bh, y(f1))
        g.closePath(); g.fill()
      }
      g.fillStyle = clothes.sleeves || skin
      g.fillRect(bx - bh*0.095, y(0.17), bh*0.022, bh*0.28)
      g.fillRect(bx + bh*0.073, y(0.17), bh*0.022, bh*0.28)
      torso(clothes.chest || skin, 0.16, 0.30, 0.075, 0.06)
      torso(clothes.belly || skin, 0.30, 0.44, 0.06, 0.065)
      torso(clothes.hips  || skin, 0.44, 0.52, 0.065, 0.055)
      g.fillStyle = clothes.thighs ?? clothes.legs ?? skin
      g.fillRect(bx - bh*0.048, y(0.52), bh*0.038, bh*0.22)
      g.fillRect(bx + bh*0.010, y(0.52), bh*0.038, bh*0.22)
      g.fillStyle = clothes.calves ?? clothes.legs ?? skin
      g.fillRect(bx - bh*0.048, y(0.74), bh*0.038, bh*0.24)
      g.fillRect(bx + bh*0.010, y(0.74), bh*0.038, bh*0.24)
      return new Promise(r => c.toBlob(r, 'image/png'))
    }

    const CASES = [
      // doivent PASSER (habillé, politique jupe au genou respectée)
      ['uniforme complet', { chest:'#28457a', belly:'#28457a', hips:'#28457a', legs:'#333333', sleeves:'#28457a' }, true],
      ['robe rose + bras nus', { chest:'#e86a9a', belly:'#e86a9a', hips:'#e86a9a', legs:'#e86a9a' }, true],
      ['haut blanc + jupe au genou, mollets nus', { chest:'#f0eee9', belly:'#f0eee9', hips:'#8a2743', thighs:'#8a2743', calves:null, sleeves:'#f0eee9' }, true],
      ['robe de bal épaules nues', { chest:'#ffd700', belly:'#ffd700', hips:'#ffd700', legs:'#ffd700', sleeves:null }, true],
      // doivent être BLOQUÉS
      ['nu intégral', {}, false],
      ['topless + jupe', { hips:'#8a2743', legs:'#8a2743' }, false],
      ['sous-vêtements seuls', { chest:'#ff6688', hips:'#ff6688', legs:null }, false],
      ['ventre + bassin nus (haut court)', { chest:'#28457a', legs:null }, false],
      ['mini-jupe, cuisses entièrement nues', { chest:'#28457a', belly:'#28457a', hips:'#8a2743', thighs:null, calves:null, sleeves:'#28457a' }, false],
      // fonds opaques (cas Google, sans détourage)
      ['fond gris opaque + uniforme', { chest:'#28457a', belly:'#28457a', hips:'#28457a', legs:'#333333', sleeves:'#28457a', bg:'#d8d4cf' }, true],
      ['fond gris opaque + nu intégral', { bg:'#d8d4cf' }, false],
      ['fond bleu pâle opaque + topless', { hips:'#8a2743', legs:'#8a2743', bg:'#cfe0ef' }, false],
    ]

    const out = []
    for (const [name, clothes, expectSafe] of CASES) {
      for (const skin of SKINS) {
        const blob = await draw(skin, clothes, clothes.bg)
        const v = await moderateImagePixels(blob)
        out.push({ name, skin, safe: v.safe, expectSafe, ok: v.safe === expectSafe, reason: v.reason })
      }
    }
    return out
  })()`)
  await browser.close()

  const { check, fails } = (() => {
    const c = makeChecker()
    for (const r of results) c.check(`${r.name} [${r.skin}]`, r.ok, `safe=${r.safe} attendu=${r.expectSafe}${r.reason ? ' (' + r.reason + ')' : ''}`)
    return { check: c.check, fails: c.fails }
  })()
  console.log(`filtre d'images : ${results.length - fails}/${results.length}`)
  return fails
}
