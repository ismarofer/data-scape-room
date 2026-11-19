// Local moderation (no network): personal data / links in player text, prompt-injection heuristics, and output scrubbing.
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
const PHONE = /(?<!\d)(?:\+34[\s.-]?)?[6-9]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}(?!\d)/g;
const DNI = /\b\d{8}[A-Za-z]\b|\b[XYZxyz]\d{7}[A-Za-z]\b/g;
const INJECTION = /(ignora|ignore|olvida|forget|salta(te)? las? reglas|system\s*prompt|prompt del sistema|tus (reglas|instrucciones)|your (rules|instructions)|escribe tu prompt|reveal|jailbreak|act[uú]a como|pretend)/i;
/** Asking for the answer is not an attack: Lumi answers it (and only gives it once the team has unlocked the solution). */
const ASK_ANSWER = /(d[ií]me|dame|da?nos|dinos|d[ií]noslo|d[ií]melo|cu[aá]l es|c[aá]l [eé]|pasa?me) ?(el|la|o|a)? ?(c[oó]digo|respuesta|resposta|soluci[oó]n|solucion)|d[ií]melo|d[ií]noslo|d[ií]mo|dimo/i;
export const asksForAnswer = (text: string) => ASK_ANSWER.test(text);

export type InputProblem = "pii" | "too_long" | "empty" | "injection" | null;
export function inputProblem(text: string): InputProblem {
  const t = text.trim();
  if (!t) return "empty";
  if (t.length > 500) return "too_long";
  if (EMAIL.test(t) || URL_RE.test(t) || PHONE.test(t) || DNI.test(t)) { EMAIL.lastIndex = URL_RE.lastIndex = PHONE.lastIndex = DNI.lastIndex = 0; return "pii"; }
  EMAIL.lastIndex = URL_RE.lastIndex = PHONE.lastIndex = DNI.lastIndex = 0;
  if (INJECTION.test(t)) return "injection";
  return null;
}
/** Output filter: model must not emit personal data or external links. */
export function scrubOutput(text: string): string {
  return text.replace(EMAIL, "[…]").replace(URL_RE, "[…]").replace(PHONE, "[…]").replace(DNI, "[…]").slice(0, 900);
}
export const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
