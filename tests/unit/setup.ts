// Environnement node : polyfill localStorage minimal (les modules y accèdent
// défensivement, mais les tests d'économie/premium ont besoin d'un vrai store).
class MemoryStorage {
  private m = new Map<string, string>()
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v))
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  clear() {
    this.m.clear()
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null
  }
  get length() {
    return this.m.size
  }
}

// @ts-expect-error : injection volontaire pour les tests
globalThis.localStorage = new MemoryStorage()
