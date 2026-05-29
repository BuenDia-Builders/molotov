"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { useMint, type MintState } from "@/hooks/use-mint";
import { truncateAddress } from "@/lib/stellar";
import { useI18n } from "@/lib/i18n";

const MAX_BYTES = 30 * 1024 * 1024; // 30 MB
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function ProgressView({ state }: { state: MintState }) {
  const { t } = useI18n();

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="font-[family-name:var(--font-fraunces)] text-3xl leading-tight [font-variation-settings:'opsz'_72] md:text-4xl">
        {state === "uploading_image" ||
        state === "uploading_metadata" ||
        state === "signing" ||
        state === "confirming"
          ? t(`mint.progress.${state}`)
          : t("mint.progress.fallback")}
      </p>
      <div className="relative mt-10 h-0.5 w-full max-w-sm overflow-hidden bg-white/12">
        <span className="progress-fill" />
      </div>
      <p className="mt-6 font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.18em] text-[#F5F4ED]/40">
        {t("mint.progress.dontClose")}
      </p>
    </div>
  );
}

export function MintForm() {
  const router = useRouter();
  const { address } = useWallet();
  const { mint, state, errorKind, reset } = useMint();
  const { locale, t } = useI18n();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [royalty, setRoyalty] = useState(10); // percent, 1..15 step .5
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const onSubmit = useCallback(async () => {
    if (!file || !address) return;
    try {
      const { tokenId } = await mint({
        imageFile: file,
        title: title.trim(),
        description: description.trim(),
        royaltyBps,
        royaltyRecipients: [{ address, shareBps: 10_000 }],
      });
      router.push(`/mi-obra/${tokenId}`);
    } catch {
      /* state + errorKind are set inside the hook; UI reacts below */
    }
  }, [file, address, mint, title, description, royaltyBps, router]);

  // --- Progress + terminal states ---
  if (
    state === "uploading_image" ||
    state === "uploading_metadata" ||
    state === "signing" ||
    state === "confirming" ||
    state === "success"
  ) {
    return <ProgressView state={state} />;
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
        <p className="font-[family-name:var(--font-fraunces)] text-3xl leading-tight [font-variation-settings:'opsz'_72] md:text-4xl">
          {copy}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-10 inline-flex h-12 items-center justify-center rounded-md bg-[#0178DE] px-6 text-[15px] font-medium text-white transition-colors hover:bg-[#3493E5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F4ED]"
        >
          {errorKind === "upload" ? t("mint.errors.retry") : t("mint.errors.backToForm")}
        </button>
      </div>
    );
  }

  // --- The form (idle) ---
  return (
    <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-24 lg:px-16">
      <h1 className="max-w-[16ch] font-[family-name:var(--font-fraunces)] text-[clamp(2.5rem,7vw,5rem)] font-light leading-[0.95] tracking-[-0.02em] [font-variation-settings:'opsz'_144]">
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
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={t("mint.form.previewAlt")}
              className="w-full rounded-lg border border-white/12 object-contain"
              onClick={() => inputRef.current?.click()}
            />
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
              className={`flex aspect-[4/5] w-full flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0178DE] ${
                dragging
                  ? "border-[#0178DE] bg-[#0178DE]/5"
                  : "border-white/20 hover:border-white/40"
              }`}
            >
              <span className="font-[family-name:var(--font-geist-mono)] text-[13px] uppercase tracking-[0.18em] text-[#F5F4ED]/60">
                {t("mint.form.drop")}
              </span>
              <span className="mt-2 text-sm text-[#F5F4ED]/40">{t("mint.form.clickToChoose")}</span>
              <span className="mt-6 font-[family-name:var(--font-geist-mono)] text-[11px] text-[#F5F4ED]/40">
                {t("mint.form.formats")}
              </span>
            </button>
          )}
          {fieldError && <p className="mt-3 text-sm text-[#DC2626]">{fieldError}</p>}
        </div>

        {/* Right: fields */}
        <div className="flex flex-col gap-8">
          <div>
            <label
              htmlFor="title"
              className="font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.18em] text-[#F5F4ED]/40"
            >
              {t("mint.form.titleLabel")}
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("mint.form.titlePlaceholder")}
              maxLength={120}
              className="mt-2 w-full border-b border-white/15 bg-transparent pb-2 font-[family-name:var(--font-fraunces)] text-2xl text-[#F5F4ED] placeholder:text-[#F5F4ED]/30 focus:border-[#0178DE] focus:outline-none [font-variation-settings:'opsz'_40] md:text-3xl"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.18em] text-[#F5F4ED]/40"
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
              className="mt-2 w-full resize-none border-b border-white/15 bg-transparent pb-2 text-base text-[#F5F4ED] placeholder:text-[#F5F4ED]/30 focus:border-[#0178DE] focus:outline-none"
            />
            <p className="mt-1 text-right font-[family-name:var(--font-geist-mono)] text-[12px] text-[#F5F4ED]/40">
              {description.length}/1000
            </p>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="royalty"
                className="font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.18em] text-[#F5F4ED]/40"
              >
                {t("mint.form.royaltyLabel")}
              </label>
              <span className="font-[family-name:var(--font-geist-mono)] text-2xl text-[#0178DE]">
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
              className="mt-4 w-full accent-[#0178DE]"
            />
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#F5F4ED]/60">
              {t("mint.form.royaltyNote")}
            </p>
          </div>

          <div>
            <p className="font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.18em] text-[#F5F4ED]/40">
              {t("mint.form.receiverLabel")}
            </p>
            <p className="mt-2 font-[family-name:var(--font-geist-mono)] text-sm text-[#F5F4ED]/70">
              {address ? truncateAddress(address, 6, 6) : t("mint.form.walletFallback")} ·{" "}
              <span className="text-[#F5F4ED]/40">{t("mint.form.walletReceives")}</span>
            </p>
          </div>

          <button
            type="button"
            disabled={!canSubmit}
            onClick={onSubmit}
            className="mt-2 inline-flex h-14 items-center justify-center rounded-md bg-[#0178DE] px-8 text-base font-medium text-white transition-colors hover:bg-[#3493E5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F4ED] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-[#F5F4ED]/40"
          >
            {t("mint.form.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
