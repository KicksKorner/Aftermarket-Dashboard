"use client"

import { useEffect, useRef, useState } from "react"

type Props = {
  label: "Front" | "Back"
  onCapture: (dataUrl: string) => void
}

export default function CardScanner({ label, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let stream: MediaStream | null = null

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
          audio: false,
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setReady(true)
        }
      } catch (err) {
        setError("Unable to access camera.")
      }
    }

    startCamera()

    return () => {
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const handleCapture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95)
    onCapture(dataUrl)
  }

  return (
    <div className="rounded-2xl border p-4 shadow-sm space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{label} Scan</h3>
        <p className="text-sm text-gray-500">
          Align the card inside the frame. Avoid sleeves, glare, and dark backgrounds.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            className="w-full h-auto"
            playsInline
            muted
            autoPlay
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[70%] w-[46%] rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        </div>
      )}

      <button
        onClick={handleCapture}
        disabled={!ready}
        className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        Capture {label}
      </button>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}