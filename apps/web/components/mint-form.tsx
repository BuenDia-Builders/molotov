"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { useMint, MAX_EDITIONS, type MintState } from "@/hooks/use-mint";
import { truncateAddress } from "@/lib/stellar";
import { useI18n } from "@/lib/i18n";
import {
  CATEGORIES,
  LICENSES,
  MAX_ATTRIBUTES,
  MAX_TAGS,
  type AttributeInput,
} from "@/lib/metadata";

const MAX_BYTES = 30 * 1024 * 1024; // 30 MB
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** License codes carry dots (CC-BY-4.0), which the i18n dot-path reader would
 *  split — so codes map to dot-free label keys. */
const LICENSE_LABEL_KEY = {
  "all-rights-reserved": "mint.form.licenses.allRights",
  "CC-BY-4.0": "mint.form.licenses.ccBy",
  "CC-BY-SA-4.0": "mint.form.licenses.ccBySa",
  "CC-BY-NC-4.0": "mint.form.licenses.ccByNc",
  "CC-BY-NC-SA-4.0": "mint.form.licenses.ccByNcSa",
  "CC0-1.0": "mint.form.licenses.cc0",
} as const;

function ProgressView({
  state,
  progress,
}: {
  state: MintState;
  progress: { minted: number; total: number } | null;
}) {
  const { t } = useI18n();

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="font-[family-name:var(--font-display)] text-3xl leading-tight [font-variation-settings:'opsz'_72] md:text-4xl">
        {state === "uploading_image" ||
        state === "uploading_metadata" ||
        state === "signing" ||
        state === "confirming"
          ? t(`mint.progress.${state}`)
          : t("mint.progress.fallback")}
      </p>
      {progress && (
        <p className="mt-4 font-[family-name:var(--font-mono)] text-[13px] text-[var(--blue-light)]">
          {t("mint.form.editionsSigning")} {progress.minted + 1} {t("mint.form.editionsOf")}{" "}
          {progress.total}
        </p>
      )}
      <div className="relative mt-10 h-0.5 w-full max-w-sm overflow-hidden bg-white/12">
        <span className="progress-fill" />
      </div>
      <p className="mt-6 font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.18em] text-[var(--offwhite)]/40">
        {t("mint.progress.dontClose")}
      </p>
    </div>
  );
}

export function MintForm() {
  const router = useRouter();
  const { address } = useWallet();
  const { mint, state, errorKind, progress, reset } = useMint();
  const { locale, t } = useI18n();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [royalty, setRoyalty] = useState(10); // percent, 1..15 step .5
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [category, setCategory] = useState("");
  const [license, setLicense] = useState<string>("all-rights-reserved");
  const [nsfw, setNsfw] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [attributes, setAttributes] = useState<AttributeInput[]>([]);
  const [editions, setEditions] = useState(1);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = useCallback(() => {
    const clean = tagDraft.trim().toLowerCase();
    if (!clean) return;
    setTags((prev) => (prev.includes(clean) || prev.length >= MAX_TAGS ? prev : [...prev, clean]));
    setTagDraft("");
  }, [tagDraft]);

  const acceptFile = useCallback(
    (f: File) => {
      if (!ACCEPTED.includes(f.type)) {
        setFieldError(t("mint.errors.unsupportedFormat"));
        return;
      }
      if (f.size > MAX_BYTES) {
        setFieldError(t("mint.errors.tooLarge"));
        return;
      }
      setFieldError(null);
      setFile(f);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(f);
      });
    },
    [t],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) acceptFile(f);
    },
    [acceptFile],
  );

  const royaltyBps = Math.round(royalty * 100);
  const royaltyLabel =
    (locale === "es" ? royalty.toFixed(1).replace(".", ",") : royalty.toFixed(1)) + "%";
  const canSubmit = Boolean(file) && title.trim().length > 0;

  const getDisabledHint = () => {
    if (!file && !title.trim()) return t("mint.form.hintMissingBoth");
    if (!file) return t("mint.form.hintMissingImage");
    if (!title.trim()) return t("mint.form.hintMissingTitle");
    return "";
  };

  const handleRemoveImage = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setFieldError(null);
  }, [previewUrl]);

  const onSubmit = useCallback(async () => {
    if (!file || !address) return;
    try {
      const { tokenId } = await mint({
        imageFile: file,
        title: title.trim(),
        description: description.trim(),
        royaltyBps,
        royaltyRecipients: [{ address, shareBps: 10_000 }],
        tags,
        category: category || null,
        license,
        nsfw,
        flashing,
        attributes,
        editions,
      });
      router.push(`/my-work/${tokenId}?minted=1`);
    } catch {
      /* state + errorKind are set inside the hook; UI reacts below */
    }
  }, [
    file,
    address,
    mint,
    title,
    description,
    royaltyBps,
    tags,
    category,
    license,
    nsfw,
    flashing,
    attributes,
    editions,
    router,
  ]);

  // --- Progress + terminal states ---
  if (
    state === "uploading_image" ||
    state === "uploading_metadata" ||
    state === "signing" ||
    state === "confirming" ||
    state === "success"
  ) {
    return <ProgressView state={state} progress={progress} />;
  }

  if (state === "error") {
    const copy =
      errorKind === "upload"
        ? t("mint.errors.upload")
        : errorKind === "sign"
          ? t("mint.errors.sign")
          : t("mint.errors.chain");
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
        <p className="font-[family-name:var(--font-display)] text-3xl leading-tight [font-variation-settings:'opsz'_72] md:text-4xl">
          {copy}
        </p>
        {progress && progress.minted > 0 && (
          <p className="mt-6 max-w-md font-[family-name:var(--font-mono)] text-[12px] leading-relaxed text-[var(--blue-light)]">
            {progress.minted}/{progress.total} · {t("mint.form.editionsPartial")}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-10 inline-flex h-12 items-center justify-center bg-[var(--blue)] px-6 text-[15px] font-medium text-white transition-colors hover:bg-[var(--blue-light)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--offwhite)]"
        >
          {errorKind === "upload" ? t("mint.errors.retry") : t("mint.errors.backToForm")}
        </button>
      </div>
    );
  }

  // --- The form (idle) ---
  return (
    <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-24 lg:px-16">
      <h1 className="max-w-[16ch] font-[family-name:var(--font-display)] text-[clamp(2.5rem,7vw,5rem)] font-light leading-[0.95] tracking-[-0.02em] [font-variation-settings:'opsz'_144]">
        {t("mint.form.title")}
      </h1>

      <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Left: dropzone / preview */}
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) acceptFile(f);
            }}
          />
          {previewUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={t("mint.form.previewAlt")}
                className="w-full border border-white/12 object-contain"
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="absolute right-3 top-3 min-h-[44px] min-w-[44px] bg-black/60 px-4 py-2 font-[family-name:var(--font-mono)] text-[12px] text-[var(--offwhite)] backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)]"
              >
                {t("mint.form.changeImage")}
              </button>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="mt-3 font-[family-name:var(--font-mono)] text-[12px] text-[var(--offwhite)]/60 underline transition-colors hover:text-[var(--offwhite)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)]"
              >
                {t("mint.form.removeImage")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex aspect-[4/5] w-full flex-col items-center justify-center border border-dashed px-6 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)] ${
                dragging
                  ? "border-[var(--blue)] bg-[var(--blue)]/5"
                  : "border-white/20 hover:border-white/40"
              }`}
            >
              <span className="font-[family-name:var(--font-mono)] text-[13px] uppercase tracking-[0.18em] text-[var(--offwhite)]/60">
                {t("mint.form.drop")}
              </span>
              <span className="mt-2 text-sm text-[var(--offwhite)]/40">
                {t("mint.form.clickToChoose")}
              </span>
              <span className="mt-6 font-[family-name:var(--font-mono)] text-[11px] text-[var(--offwhite)]/40">
                {t("mint.form.formats")}
              </span>
            </button>
          )}
          {/* Limits said up front, not discovered on error */}
          <div className="mt-4 flex flex-col gap-2 border border-white/10 p-3">
            <div className="flex items-baseline gap-3">
              <span className="shrink-0 bg-[var(--blue)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.15em] text-white">
                {t("mint.form.limitSizeLabel")}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--offwhite)]/60">
                {t("mint.form.limitSizeValue")}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="shrink-0 bg-[var(--blue)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.15em] text-white">
                {t("mint.form.limitTypesLabel")}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--offwhite)]/60">
                {t("mint.form.limitTypesValue")}
              </span>
            </div>
          </div>
          {fieldError && <p className="mt-3 text-sm text-red-500">{fieldError}</p>}
        </div>

        {/* Right: fields */}
        <div className="flex flex-col gap-8">
          <div>
            <label
              htmlFor="title"
              className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.18em] text-[var(--offwhite)]/40"
            >
              {t("mint.form.titleLabel")}
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("mint.form.titlePlaceholder")}
              maxLength={120}
              className="mt-2 w-full border-b border-white/15 bg-transparent pb-2 font-[family-name:var(--font-display)] text-2xl text-[var(--offwhite)] placeholder:text-[var(--offwhite)]/30 focus:border-[var(--blue)] focus:outline-none [font-variation-settings:'opsz'_40] md:text-3xl"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.18em] text-[var(--offwhite)]/40"
            >
              {t("mint.form.descriptionLabel")}{" "}
              <span className="normal-case">{t("mint.form.optional")}</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              rows={4}
              placeholder={t("mint.form.descriptionPlaceholder")}
              className="mt-2 w-full resize-none border-b border-white/15 bg-transparent pb-2 text-base text-[var(--offwhite)] placeholder:text-[var(--offwhite)]/30 focus:border-[var(--blue)] focus:outline-none"
            />
            <p className="mt-1 text-right font-[family-name:var(--font-mono)] text-[12px] text-[var(--offwhite)]/40">
              {description.length}/1000
            </p>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="royalty"
                className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.18em] text-[var(--offwhite)]/40"
              >
                {t("mint.form.royaltyLabel")}
              </label>
              <span className="font-[family-name:var(--font-mono)] text-2xl text-[var(--blue)]">
                {royaltyLabel}
              </span>
            </div>
            <input
              id="royalty"
              type="range"
              min={1}
              max={15}
              step={0.5}
              value={royalty}
              onChange={(e) => setRoyalty(Number(e.target.value))}
              className="mt-4 w-full accent-[var(--blue)]"
            />
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--offwhite)]/60">
              {t("mint.form.royaltyNote")}
            </p>
          </div>

          <div>
            <p className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.18em] text-[var(--offwhite)]/40">
              {t("mint.form.receiverLabel")}
            </p>
            <p className="mt-2 font-[family-name:var(--font-mono)] text-sm text-[var(--offwhite)]/70">
              {address ? truncateAddress(address, 6, 6) : t("mint.form.walletFallback")} ·{" "}
              <span className="text-[var(--offwhite)]/40">{t("mint.form.walletReceives")}</span>
            </p>
          </div>

          {/* ── Etiquetas ── */}
          <div>
            <label
              htmlFor="tags"
              className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.18em] text-[var(--offwhite)]/40"
            >
              {t("mint.form.tagsLabel")}{" "}
              <span className="normal-case tracking-normal">{t("mint.form.optional")}</span>
            </label>
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTags((prev) => prev.filter((x) => x !== tag))}
                    aria-label={`${t("mint.form.tagRemove")}: ${tag}`}
                    className="inline-flex items-center gap-1.5 border border-white/15 px-2.5 py-1 font-[family-name:var(--font-mono)] text-[11px] text-[var(--offwhite)] hover:border-red-400/60"
                  >
                    {tag} <span className="text-[var(--offwhite)]/40">×</span>
                  </button>
                ))}
              </div>
            )}
            <input
              id="tags"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
              placeholder={t("mint.form.tagsPlaceholder")}
              disabled={tags.length >= MAX_TAGS}
              className="mt-2 w-full border-b border-white/15 bg-transparent pb-2 text-base text-[var(--offwhite)] placeholder:text-[var(--offwhite)]/30 focus:border-[var(--blue)] focus:outline-none"
            />
            <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] text-[var(--offwhite)]/40">
              {t("mint.form.tagsHelp")} · {tags.length}/{MAX_TAGS}
            </p>
          </div>

          {/* ── Categoría + Licencia ── */}
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <label
                htmlFor="category"
                className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.18em] text-[var(--offwhite)]/40"
              >
                {t("mint.form.categoryLabel")}{" "}
                <span className="normal-case tracking-normal">{t("mint.form.optional")}</span>
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-2 w-full border-b border-white/15 bg-transparent pb-2 text-base text-[var(--offwhite)] focus:border-[var(--blue)] focus:outline-none [&>option]:bg-[var(--black)]"
              >
                <option value="">{t("mint.form.categoryNone")}</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`mint.form.categories.${c}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="license"
                className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.18em] text-[var(--offwhite)]/40"
              >
                {t("mint.form.licenseLabel")}
              </label>
              <select
                id="license"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                className="mt-2 w-full border-b border-white/15 bg-transparent pb-2 text-base text-[var(--offwhite)] focus:border-[var(--blue)] focus:outline-none [&>option]:bg-[var(--black)]"
              >
                {LICENSES.map((code) => (
                  <option key={code} value={code}>
                    {t(LICENSE_LABEL_KEY[code])}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Cuidado del público: sensible + destellos ── */}
          {(
            [
              ["nsfw", nsfw, setNsfw, "mint.form.nsfwLabel", "mint.form.nsfwHelp"],
              [
                "flashing",
                flashing,
                setFlashing,
                "mint.form.flashingLabel",
                "mint.form.flashingHelp",
              ],
            ] as const
          ).map(([id, value, setValue, labelKey, helpKey]) => (
            <div key={id} className="flex items-start justify-between gap-6">
              <div>
                <p className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.18em] text-[var(--offwhite)]/40">
                  {t(labelKey)}
                </p>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-[var(--offwhite)]/60">
                  {t(helpKey)}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={value}
                onClick={() => setValue(!value)}
                className={`flex min-h-11 shrink-0 items-center gap-2 border px-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] transition-colors ${
                  value
                    ? "border-[var(--blue)] text-[var(--blue-light)]"
                    : "border-white/15 text-[var(--offwhite)]/50 hover:border-white/40"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${value ? "bg-[var(--blue)]" : "bg-white/25"}`}
                />
                {value ? t("mint.form.toggleYes") : t("mint.form.toggleNo")}
              </button>
            </div>
          ))}

          {/* ── Atributos ── */}
          <div>
            <p className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.18em] text-[var(--offwhite)]/40">
              {t("mint.form.attributesLabel")}{" "}
              <span className="normal-case tracking-normal">{t("mint.form.optional")}</span>
            </p>
            {attributes.map((attr, i) => (
              <div key={i} className="mt-3 flex items-center gap-3">
                <input
                  value={attr.name}
                  onChange={(e) =>
                    setAttributes((prev) =>
                      prev.map((a, j) => (j === i ? { ...a, name: e.target.value } : a)),
                    )
                  }
                  placeholder={t("mint.form.attributeName")}
                  className="w-1/2 border-b border-white/15 bg-transparent pb-2 text-sm text-[var(--offwhite)] placeholder:text-[var(--offwhite)]/30 focus:border-[var(--blue)] focus:outline-none"
                />
                <input
                  value={attr.value}
                  onChange={(e) =>
                    setAttributes((prev) =>
                      prev.map((a, j) => (j === i ? { ...a, value: e.target.value } : a)),
                    )
                  }
                  placeholder={t("mint.form.attributeValue")}
                  className="w-1/2 border-b border-white/15 bg-transparent pb-2 text-sm text-[var(--offwhite)] placeholder:text-[var(--offwhite)]/30 focus:border-[var(--blue)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setAttributes((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={t("mint.form.attributeRemove")}
                  className="min-h-11 min-w-8 text-[var(--offwhite)]/40 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            ))}
            {attributes.length < MAX_ATTRIBUTES && (
              <button
                type="button"
                onClick={() => setAttributes((prev) => [...prev, { name: "", value: "" }])}
                className="mt-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.15em] text-[var(--blue-light)] hover:text-[var(--blue)]"
              >
                {t("mint.form.attributeAdd")}
              </button>
            )}
            <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] text-[var(--offwhite)]/40">
              {t("mint.form.attributesHelp")}
            </p>
          </div>

          {/* ── Ediciones ── */}
          <div>
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="editions"
                className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.18em] text-[var(--offwhite)]/40"
              >
                {t("mint.form.editionsLabel")}
              </label>
              <span className="font-[family-name:var(--font-mono)] text-2xl text-[var(--blue)]">
                {editions}
              </span>
            </div>
            <input
              id="editions"
              type="range"
              min={1}
              max={MAX_EDITIONS}
              step={1}
              value={editions}
              onChange={(e) => setEditions(Number(e.target.value))}
              className="mt-4 w-full accent-[var(--blue)]"
            />
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--offwhite)]/60">
              {t("mint.form.editionsHelp")}
            </p>
          </div>

          <div>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={onSubmit}
              className="mt-2 inline-flex h-14 items-center justify-center bg-[var(--blue)] px-8 text-base font-medium text-white transition-colors hover:bg-[var(--blue-light)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--offwhite)] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-[var(--offwhite)]/40"
            >
              {t("mint.form.submit")}
            </button>
            {!canSubmit && (
              <p className="mt-3 font-[family-name:var(--font-mono)] text-[12px] text-[var(--offwhite)]/60">
                {getDisabledHint()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
