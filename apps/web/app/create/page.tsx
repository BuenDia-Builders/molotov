"use client"

import { useState, useRef, useCallback } from "react"

const inputClass = `
  w-full bg-transparent border border-[var(--ember)] text-[var(--offwhite)]
  font-mono text-sm px-4 py-3 outline-none
  focus:border-[var(--blue)] placeholder:text-[var(--smoke)]
  transition-colors duration-150
`

export default function CreatePage() {
  const [royaltyBps, setRoyaltyBps] = useState(1000)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [editions, setEditions] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((f: File) => {
    setFile(f)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const dropped = e.dataTransfer.files[0]
      if (dropped) handleFile(dropped)
    },
    [handleFile]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => setIsDragOver(false)

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) handleFile(selected)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("title", title)
      formData.append("description", description)
      formData.append("editions", String(editions))
      formData.append("royaltyBps", String(royaltyBps))

      const res = await fetch("/api/ipfs/upload", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) throw new Error("Upload failed")
      // contract call happens inside the route handler
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--black)] pt-24 pb-16 px-6 lg:px-12">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-16 items-start">

        {/* ── LEFT: headline + form ── */}
        <div>
          {/* Section eyebrow */}
          <p className="font-mono text-[10px] tracking-[0.3em] text-[var(--smoke)] uppercase mb-2">
            MINT
          </p>
          <div className="w-12 h-px bg-[var(--ember)] mb-6" />
          <h1 className="font-display font-black text-[56px] leading-none text-[var(--offwhite)] mb-10">
            Upload your work.<br />
            Set your royalty.<br />
            Fire is on-chain.
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="font-mono text-[10px] text-[var(--smoke)] uppercase tracking-[0.2em] block mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Name your piece"
                required
                className={inputClass}
              />
            </div>

            {/* Description */}
            <div>
              <label className="font-mono text-[10px] text-[var(--smoke)] uppercase tracking-[0.2em] block mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this work?"
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Editions */}
            <div>
              <label className="font-mono text-[10px] text-[var(--smoke)] uppercase tracking-[0.2em] block mb-2">
                Editions
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={editions}
                onChange={(e) => setEditions(Number(e.target.value))}
                className={inputClass}
              />
            </div>

            {/* Royalty slider */}
            <div>
              <label className="font-mono text-[10px] text-[var(--smoke)] uppercase tracking-[0.2em] block mb-2">
                Royalty —{" "}
                <span className="text-[var(--blue)]">
                  {(royaltyBps / 100).toFixed(0)}%
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={5000}
                step={100}
                value={royaltyBps}
                onChange={(e) => setRoyaltyBps(Number(e.target.value))}
                className="w-full accent-[#1564FF] cursor-pointer"
              />
              <div className="flex justify-between font-mono text-[9px] text-[var(--smoke)] mt-1">
                <span>0%</span>
                <span>50%</span>
              </div>
            </div>

            {/* Mobile drop zone (visible on small screens only) */}
            <div className="lg:hidden">
              <label className="font-mono text-[10px] text-[var(--smoke)] uppercase tracking-[0.2em] block mb-2">
                File
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full aspect-square border border-dashed flex items-center justify-center cursor-pointer transition-colors duration-150 ${
                  isDragOver
                    ? "border-[var(--blue)]"
                    : "border-[var(--ember)] hover:border-[var(--blue)]"
                }`}
              >
                {preview ? (
                  <img src={preview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-mono text-[10px] text-[var(--smoke)] uppercase tracking-widest">
                    Drop file or click
                  </span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !file}
              className="w-full bg-[var(--blue)] text-white font-display font-black text-sm tracking-widest uppercase px-8 py-4 disabled:opacity-40 transition-opacity duration-150"
            >
              {isLoading ? "Minting..." : "Mint"}
            </button>
          </form>
        </div>

        {/* ── RIGHT: drop zone / preview (desktop) ── */}
        <div className="hidden lg:block sticky top-24">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full aspect-square border border-dashed flex items-center justify-center cursor-pointer transition-colors duration-150 ${
              isDragOver
                ? "border-[var(--blue)]"
                : "border-[var(--ember)] hover:border-[var(--blue)]"
            }`}
          >
            {preview ? (
              <img src={preview} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <span className="font-mono text-[10px] text-[var(--smoke)] uppercase tracking-widest">
                Drop file or click
              </span>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

      </div>
    </main>
  )
}
