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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-App-Secret',
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
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
    const branch = env.BRANCH || 'claude/otome-game-builder-hqabza'
    const ghHeaders = {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'celestine-bugbot',
      'Content-Type': 'application/json',
    }

    // 1) issue GitHub (visibilité humaine)
    const gh = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({ title, body, labels: ['from-app', 'bug'] }),
    })
    const issue = gh.ok ? await gh.json() : null

    // 2) fichier « inbox » commité sur la branche de travail : c'est CE fichier que
    //    la routine planifiée lira (elle n'a que git, pas l'API REST GitHub).
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const fileMd =
      `# ${title}\n\n` + (issue ? `Issue: ${issue.html_url} (#${issue.number})\n\n` : '') + `${body}\n`
    let queued = false
    try {
      const put = await fetch(
        `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(`bug-reports/inbox/${id}.md`)}`,
        {
          method: 'PUT',
          headers: ghHeaders,
          body: JSON.stringify({
            message: `bug: ${title.slice(0, 60)}`,
            content: btoa(unescape(encodeURIComponent(fileMd))),
            branch,
          }),
        },
      )
      queued = put.ok
    } catch {
      /* best-effort */
    }

    if (!issue && !queued) return json({ error: 'github', status: gh.status, detail: (await gh.text()).slice(0, 500) }, 502, cors)
    return json({ ok: true, url: issue?.html_url, number: issue?.number, queued }, 200, cors)
  },
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
