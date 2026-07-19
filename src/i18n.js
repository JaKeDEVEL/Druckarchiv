import de from "./locales/de.js";
import en from "./locales/en.js";

export const DEFAULT_LOCALE = "de";
export const SUPPORTED_LOCALES = Object.freeze(["de", "en"]);
export const LOCALE_STORAGE_KEY = "druckarchiv.locale.v1";
export const localeResources = Object.freeze({ de, en });

function lookup(resource, key) {
  return key.split(".").reduce((value, segment) => value?.[segment], resource);
}

export function resolveLocale(requestedLocales = []) {
  const candidates = Array.isArray(requestedLocales) ? requestedLocales : [requestedLocales];
  for (const candidate of candidates) {
    const language = String(candidate || "").toLowerCase().split(/[-_]/)[0];
    if (SUPPORTED_LOCALES.includes(language)) return language;
  }
  return DEFAULT_LOCALE;
}

function savedLocale() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch (_) {
    return null;
  }
}

const systemLocales = typeof navigator === "undefined" ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language]);
let currentLocale = resolveLocale([savedLocale(), ...systemLocales]);
let numberFormatter;
let dateFormatter;
const listeners = new Set();

function rebuildFormatters() {
  numberFormatter = new Intl.NumberFormat(currentLocale);
  dateFormatter = new Intl.DateTimeFormat(currentLocale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

rebuildFormatters();

export function getLocale() {
  return currentLocale;
}

export function formatNumber(value) {
  return numberFormatter.format(value);
}

export function formatDateValue(value) {
  return dateFormatter.format(value);
}

export function t(key, params = {}) {
  let value = lookup(localeResources[currentLocale], key);
  if (value === undefined) value = lookup(localeResources[DEFAULT_LOCALE], key);
  if (value && typeof value === "object") {
    const rule = new Intl.PluralRules(currentLocale).select(Number(params.count));
    value = value[rule] ?? value.other ?? value.one;
  }
  if (typeof value !== "string") return key;
  return value.replace(/\{(\w+)\}/g, (_, name) => {
    const replacement = params[name];
    if (replacement === undefined || replacement === null) return `{${name}}`;
    return typeof replacement === "number" ? formatNumber(replacement) : String(replacement);
  });
}

export function setLocale(locale, { persist = true } = {}) {
  const nextLocale = resolveLocale(locale);
  if (nextLocale === currentLocale) return false;
  currentLocale = nextLocale;
  rebuildFormatters();
  if (persist) {
    try { localStorage.setItem(LOCALE_STORAGE_KEY, currentLocale); } catch (_) { /* storage can be unavailable */ }
  }
  if (typeof document !== "undefined") document.documentElement.lang = currentLocale;
  listeners.forEach(listener => listener(currentLocale));
  return true;
}

export function onLocaleChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyTranslations(root = typeof document === "undefined" ? null : document) {
  if (!root) return;
  root.querySelectorAll("[data-i18n]").forEach(element => { element.textContent = t(element.dataset.i18n); });
  root.querySelectorAll("[data-i18n-placeholder]").forEach(element => { element.placeholder = t(element.dataset.i18nPlaceholder); });
  root.querySelectorAll("[data-i18n-aria-label]").forEach(element => { element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel)); });
  document.documentElement.lang = currentLocale;
  document.title = t("app.title");
}

export function flattenedLocaleKeys(resource) {
  const keys = [];
  const visit = (value, prefix) => {
    if (value && typeof value === "object" && !(Object.hasOwn(value, "one") || Object.hasOwn(value, "other"))) {
      Object.entries(value).forEach(([key, child]) => visit(child, prefix ? `${prefix}.${key}` : key));
    } else {
      keys.push(prefix);
    }
  };
  visit(resource, "");
  return keys.sort();
}
