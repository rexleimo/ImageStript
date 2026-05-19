import { i18n } from "@lingui/core";

export type Locale = "en" | "zh-CN" | "zh-TW" | "ja" | "ko" | "fr" | "de" | "es" | "pt" | "ru";

export const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
  { value: "pt", label: "Português" },
  { value: "ru", label: "Русский" },
];

async function loadCatalog(locale: string) {
  const { messages } = await import(`./locales/${locale}/messages.po`);
  return messages;
}

function detectLocale(): Locale {
  const stored = localStorage.getItem("imagestript-locale") as Locale | null;
  if (stored && LOCALES.some(l => l.value === stored)) return stored;
  const nav = navigator.language;
  if (nav.startsWith("zh-TW") || nav.startsWith("zh-HK") || nav.startsWith("zh-MO")) return "zh-TW";
  if (nav.startsWith("zh")) return "zh-CN";
  if (nav.startsWith("ja")) return "ja";
  if (nav.startsWith("ko")) return "ko";
  if (nav.startsWith("fr")) return "fr";
  if (nav.startsWith("de")) return "de";
  if (nav.startsWith("es")) return "es";
  if (nav.startsWith("pt")) return "pt";
  if (nav.startsWith("ru")) return "ru";
  return "en";
}

export async function setupI18n(): Promise<Locale> {
  const locale = detectLocale();
  const messages = await loadCatalog(locale);
  i18n.load(locale, messages);
  i18n.activate(locale);
  return locale;
}

export async function switchLocale(locale: Locale): Promise<void> {
  const messages = await loadCatalog(locale);
  i18n.load(locale, messages);
  i18n.activate(locale);
  localStorage.setItem("imagestript-locale", locale);
}

export function getLocale(): Locale {
  return i18n.locale as Locale;
}

export { i18n };
