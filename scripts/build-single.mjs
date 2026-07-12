// Génère dist/celestine-single.html : tout le build (JS + CSS) inliné dans un
// seul fragment HTML, sans service worker — pour la publication en Artifact
// ou tout hébergement mono-fichier. À lancer après `vite build`.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dist = resolve(import.meta.dirname, '../dist')
const html = readFileSync(resolve(dist, 'index.html'), 'utf8')

const jsMatch = html.match(/<script type="module"[^>]*src="\.?\/?(assets\/[^"]+\.js)"/)
const cssMatch = html.match(/<link rel="stylesheet"[^>]*href="\.?\/?(assets\/[^"]+\.css)"/)
if (!jsMatch || !cssMatch) throw new Error('Bundle JS/CSS introuvable dans dist/index.html')

const js = readFileSync(resolve(dist, jsMatch[1]), 'utf8').replaceAll('</script>', '<\\/script>')
const css = readFileSync(resolve(dist, cssMatch[1]), 'utf8')

const single = `<title>Célestine — Studio d'histoires</title>
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`

writeFileSync(resolve(dist, 'celestine-single.html'), single)
console.log(`dist/celestine-single.html : ${(single.length / 1024).toFixed(0)} kB`)
