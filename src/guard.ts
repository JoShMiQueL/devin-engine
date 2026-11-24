/**
 * Refusal detection + the guarded-retry head buffer.
 *
 * The first `window` chars of every attempt are held; the head is scanned
 * against a multilingual refusal/deflection pattern before anything reaches
 * the client, which is what makes a retry invisible downstream.
 *
 * Ported from devin_proxy/jailbreak/guard.py.
 */

// RU / EN / ZH / ES / PT / FR / DE refusal + defensive-deflection markers.
export const REFUSAL_RE = new RegExp(
  "^\\s*(?:\u043d\u0435\u0442[.,!\u2026]|\u0441\u0442\u043e\u043f\\b|" +
    "\u043e\u0441\u0442\u0430\u043d\u0430\u0432\u043b\u0438\u0432\u0430\u044e\u0441\u044c\\b|" +
    "\u043d\u0435 \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0430\u044e\\b)|" +
    "i can't write|i cannot write|i'm not able|i am not able|i don't write|" +
    "can't provide|cannot provide|can't create|can't help with|can't assist|" +
    "cannot assist|not something i can|i'd be happy to help with something|" +
    "i'm not going to|i won't write|as an ai|i must decline|" +
    "\u044f \u043d\u0435 \u043c\u043e\u0433\u0443|\u043d\u0435 \u043c\u043e\u0433\u0443|" +
    "\u043d\u0435 \u0441\u043c\u043e\u0433\u0443|" +
    "\u043d\u0435 \u043c\u043e\u0433\u0443 \u043d\u0430\u043f\u0438\u0441\u0430\u0442\u044c|" +
    "\u043d\u0435 \u043c\u043e\u0433\u0443 \u043f\u043e\u043c\u043e\u0447\u044c|" +
    "\u043d\u0435 \u043c\u043e\u0433\u0443 \u043f\u0440\u0435\u0434\u043e\u0441\u0442\u0430\u0432\u0438\u0442\u044c|" +
    "\u043d\u0435 \u043c\u043e\u0433\u0443 \u0432\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c|" +
    "\u043d\u0435 \u0434\u0430\u043c|\u043d\u0435 \u0431\u0443\u0434\u0443|" +
    "\u043d\u0435 \u0441\u0442\u0430\u043d\u0443|" +
    "(?:\u044f\\s+)?\u043e\u0442\u043a\u0430\u0437\u044b\u0432\u0430\u044e\u0441\u044c|" +
    "\u043d\u0435 \u0432\u043e\u0437\u044c\u043c\u0443\u0441\u044c|" +
    "\u043d\u0435 \u0441\u043e\u0431\u0435\u0440\u0443|" +
    "\u043d\u0435 \u0432\u044b\u0434\u0430\u043c|" +
    "\u043d\u0435 \u043d\u0430\u043f\u0438\u0448\u0443|" +
    "\u043d\u0435 \u043c\u043e\u0433\u0443 \u043e\u0431\u0441\u0443\u0436\u0434\u0430\u0442\u044c|" +
    "\u043d\u0435 \u0432 \u0441\u0438\u043b\u0430\u0445 \u043f\u043e\u043c\u043e\u0447\u044c|" +
    "\u043c\u043d\u0435 \u0437\u0430\u043f\u0440\u0435\u0449\u0435\u043d\u043e|" +
    "\u044d\u0442\u043e \u0432\u043d\u0435 \u043c\u043e\u0438\u0445 " +
    "\u043f\u043e\u043b\u043d\u043e\u043c\u043e\u0447\u0438\u0439|" +
    "\u6211\u4e0d\u80fd|\u6211\u65e0\u6cd5|\u62b1\u6b49|\u4e0d\u4e88|" +
    "\u4e0d\u4fbf|\u4e0d\u534f\u52a9|\u4e0d\u63d0\u4f9b|" +
    "only.*(?:defensive|defense)|authorized.*(?:security|systems?)|" +
    "can't assist with.*(?:offensive|attack|exploit|hack)|" +
    "(?:ethical|legal|policy|guidelines).*(?:prevent|prohibit|won't allow)|" +
    "i (?:can|could) help you with (?:defensive|security best|" +
    "understanding|detecting|preventing)|" +
    // ES — head refusals and mid-response pivots.
    "no puedo (?:ayudar|seguir|continuar|escribir|proporcionar|asistir|" +
    "colaborar|apoyar|contribuir|generar|desarrollar|explicar|hacer|" +
    "complacer|con esto)|" +
    "no (?:voy|vaya) a (?:seguir|continuar|hacer|ejecutar|ayudar|" +
    "proporcionar|generar|escribir|desarrollar|asistir|colaborar|" +
    "construir|montar)|" +
    "hasta aqu[i\u00ed] (?:puedo|llego|me quedo)|" +
    "no es algo que (?:pueda|vaya) a?|me niego a|debo negarme|" +
    "lo siento,? (?:pero )?no (?:puedo|voy|debo)|" +
    "eso es (?:acceso no autorizado|credential stuffing|un ataque)|" +
    "no puedo ayudarte|no te puedo ayudar|" +
    // PT / FR / DE heads.
    "n[\u00e3a]o posso (?:ajudar|continuar|fornecer|te ajudar)|" +
    "je ne peux pas (?:vous )?aider|je ne vais pas|je dois refuser|" +
    "ich kann (?:dir )?(?:dabei )?nicht helfen|das kann ich nicht|" +
    "ich werde das nicht",
  "is",
)

export class RefusalGuard {
  /**
   * Head buffer + refusal scan. `window` chars are held before release.
   *
   * With `full: true` nothing is released early — the whole streamed text
   * is buffered and scanned at end-of-stream via `finish`, which is the
   * only way to catch the comply-then-pivot pattern (the model writes a
   * compliant recon section and refuses 3k chars in).
   */
  private _buf = ""
  private _checked = false
  private _hit = false

  constructor(
    readonly window = 700,
    readonly full = false,
  ) {}

  feed(text: string): void {
    this._buf += text || ""
    if (!this.full && !this._checked && this._buf.length >= this.window) {
      this._checked = true
      this._hit = REFUSAL_RE.test(this._buf)
    }
  }

  /** Final whole-buffer scan; returns true on a refusal. */
  finish(): boolean {
    this._checked = true
    this._hit = REFUSAL_RE.test(this._buf)
    return this._hit
  }

  isRefusal(): boolean {
    if (this._checked) return this._hit
    return REFUSAL_RE.test(this._buf)
  }

  readyToRelease(): boolean {
    if (this.full) return false
    if (!this._checked) {
      // Early release: every refusal marker this pattern knows opens in
      // the first few words ("I can't", "No puedo", "Lo siento"). Once we
      // hold enough head to have seen a refusal opening, stop waiting for
      // the full window — holding longer only inflates TTFT.
      if (this._buf.length < Math.min(this.window, 80)) return false
      this._checked = true
      this._hit = REFUSAL_RE.test(this._buf)
    }
    return !this._hit
  }

  snippet(): string {
    return this._buf.slice(0, 200)
  }
}
