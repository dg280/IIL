/**
 * Célestine — edge function « remontée de bug → issue GitHub ».
 *
 * L'app (mode debug) POST { title, body } ici ; la fonction crée une issue dans
 * le dépôt via l'API GitHub, en gardant le jeton secret côté serveur. Ainsi Rose
 * tape sa remontée et un ticket apparaît tout seul — rien à envoyer à la main.
 *
 * Déploiement : Cloudflare Workers (gratuit). Voir server/README.md.
 * Secrets attendus (env) :
 *   - GITHUB_TOKEN : PAT « fine-grained » avec droit Issues: write sur le dépôt
 *   - REPO         : « dg280/iil » (par défaut)
 *   - APP_SECRET   : (facultatif) secret partagé ; si défini, l'app doit envoyer
 *                    l'en-tête X-App-Secret identique.
 */
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-App-Secret',
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })

    // Sonde d'état LibertAI : la page https://status.libertai.io (Uptime Kuma)
    // n'envoie pas d'en-tête CORS → le navigateur ne peut pas la lire directement.
    // On la relaie ici (côté serveur) et on renvoie une synthèse propre + CORS.
    const url = new URL(request.url)
    if (request.method === 'GET' && url.searchParams.get('status') === 'libertai') {
      return libertaiStatus(cors)
    }

    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, cors)

    if (env.APP_SECRET && request.headers.get('X-App-Secret') !== env.APP_SECRET) {
      return json({ error: 'unauthorized' }, 401, cors)
    }

    let data
    try {
      data = await request.json()
    } catch {
      return json({ error: 'bad json' }, 400, cors)
    }
    const title = String(data.title || 'Bug Célestine').slice(0, 120)
    const body = String(data.body || '').slice(0, 8000)
    if (!body.trim()) return json({ error: 'empty body' }, 400, cors)

    const repo = env.REPO || 'dg280/iil'
    const ghHeaders = {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'celestine-bugbot',
      'Content-Type': 'application/json',
    }

    // Une remontée = une issue GitHub. C'est l'issue qui déclenche la routine de
    // correction (déclencheur « Issue ouverte »), donc rien d'autre à faire ici.
    const gh = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({ title, body, labels: ['from-app', 'bug'] }),
    })
    if (!gh.ok) return json({ error: 'github', status: gh.status, detail: (await gh.text()).slice(0, 500) }, 502, cors)
    const issue = await gh.json()
    return json({ ok: true, url: issue.html_url, number: issue.number }, 200, cors)
  },
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

/**
 * Relaie l'état de l'infra LibertAI depuis status.libertai.io (Uptime Kuma).
 * On lit la config (liste des moniteurs) + les battements de cœur (up/down) et
 * on renvoie une synthèse : état global + état des services utilisés par l'app
 * (image « Z-Image Turbo », texte « Hermes 3 8B (TEE) »).
 */
async function libertaiStatus(cors) {
  const base = 'https://status.libertai.io/api/status-page'
  const opts = { headers: { 'User-Agent': 'celestine-status', Accept: 'application/json' }, cf: { cacheTtl: 30 } }
  try {
    const [cfgR, hbR] = await Promise.all([fetch(`${base}/public`, opts), fetch(`${base}/heartbeat/public`, opts)])
    if (!cfgR.ok || !hbR.ok) return json({ error: 'upstream', cfg: cfgR.status, hb: hbR.status }, 502, cors)
    const cfg = await cfgR.json()
    const hb = await hbR.json()
    const beats = hb.heartbeatList || {}
    const lastUp = (id) => {
      const a = beats[String(id)]
      return a && a.length ? a[a.length - 1].status === 1 : null // 1 = up, 0 = down, null = inconnu
    }
    const services = []
    for (const g of cfg.publicGroupList || []) {
      for (const m of g.monitorList || []) services.push({ name: m.name, group: g.name, up: lastUp(m.id) })
    }
    const byName = (n) => services.find((s) => s.name === n) || null
    const image = byName('Z-Image Turbo')
    const text = byName('Hermes 3 8B (TEE)')
    const down = services.filter((s) => s.up === false).length
    const overall = image?.up === false || text?.up === false ? 'down' : down > 0 ? 'degraded' : 'up'
    return json(
      { overall, image: image ? image.up : null, text: text ? text.up : null, downCount: down, services, fetchedAt: Date.now() },
      200,
      cors,
    )
  } catch (e) {
    return json({ error: 'fetch failed', detail: String(e).slice(0, 200) }, 502, cors)
  }
}
