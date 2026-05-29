"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { en } from "./en";
import { es } from "./es";

export type Locale = "es" | "en";

const STORAGE_KEY = "molotov:locale";
const dictionaries = { es, en } as const;

type Dictionary = typeof es;

type DotPath<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${DotPath<T[K]>}`;
    }[keyof T & string];

type TranslationKey = DotPath<Dictionary>;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function isLocale(value: string | null): value is Locale {
  return value === "es" || value === "en";
}

function readPath(dictionary: Dictionary, key: TranslationKey): string {
  return key.split(".").reduce<unknown>((value, part) => {
    if (value && typeof value === "object" && part in value) {
      return (value as Record<string, unknown>)[part];
    }
    return undefined;
  }, dictionary) as string;
}

function upsertManifestLink(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    document.head.appendChild(link);
  }
  link.href = href;
}

function upsertMetaDescription(content: string) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "description";
    document.head.appendChild(meta);
  }
  meta.content = content;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("es");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) {
      window.requestAnimationFrame(() => setLocaleState(stored));
    }
  }, []);

  useEffect(() => {
    const meta = dictionaries[locale].meta;
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = meta.lang;
    document.title = meta.title;
    upsertMetaDescription(meta.description);
    upsertManifestLink(meta.manifest);
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
  }, []);

  const t = useCallback((key: TranslationKey) => readPath(dictionaries[locale], key), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
}
