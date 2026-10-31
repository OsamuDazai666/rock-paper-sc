import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision'
import { classifyGesture } from './gesture'
import type { Move } from './types'

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export type CameraStatus = 'idle' | 'loading' | 'ready' | 'error'

export function useHandLandmarker() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const frameRef = useRef<number | null>(null)
  const generationRef = useRef(0)
  const startingRef = useRef(false)
  const candidateRef = useRef<Move | null>(null)
  const candidateFramesRef = useRef(0)
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [gesture, setGesture] = useState<Move | null>(null)
  const [stableGesture, setStableGesture] = useState<Move | null>(null)
  const [handPresent, setHandPresent] = useState(false)

  const releaseResources = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    landmarkerRef.current?.close()
    landmarkerRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    const canvas = canvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  const resetDetection = useCallback(() => {
    candidateRef.current = null
    candidateFramesRef.current = 0
    setGesture(null)
    setStableGesture(null)
    setHandPresent(false)
  }, [])

  const stopCamera = useCallback(() => {
    generationRef.current += 1
    startingRef.current = false
    releaseResources()
    resetDetection()
    setCameraStatus('idle')
    setCameraError(null)
  }, [releaseResources, resetDetection])

  const startCamera = useCallback(async () => {
    if (startingRef.current || cameraStatus === 'ready') return
    startingRef.current = true
    const generation = ++generationRef.current
    releaseResources()
    resetDetection()
    setCameraStatus('loading')
    setCameraError(null)
    let stream: MediaStream | null = null
    let landmarker: HandLandmarker | null = null

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not support webcam access. Use manual mode instead.')
      }

      const vision = await FilesetResolver.forVisionTasks(WASM_URL)
      ;[landmarker, stream] = await Promise.all([
        HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        }),
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        }),
      ])

      if (generation !== generationRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        landmarker.close()
        return
      }

      const video = videoRef.current
      if (!video) throw new Error('The camera preview is not available.')
      const activeLandmarker = landmarker
      streamRef.current = stream
      landmarkerRef.current = activeLandmarker
      video.srcObject = stream
      await video.play()
      setCameraStatus('ready')

      let lastVideoTime = -1
      let lastDetectionTime = 0

      const detect = (now: number) => {
        if (generation !== generationRef.current) return
        frameRef.current = requestAnimationFrame(detect)
        if (video.readyState < 2 || video.currentTime === lastVideoTime) return
        if (now - lastDetectionTime < 55) return
        lastDetectionTime = now
        lastVideoTime = video.currentTime

        const result: HandLandmarkerResult = activeLandmarker.detectForVideo(video, now)
        const landmarks = result.landmarks[0]
        const canvas = canvasRef.current
        const context = canvas?.getContext('2d')
        if (canvas && context) {
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
          }
          context.clearRect(0, 0, canvas.width, canvas.height)
        }

        setHandPresent(Boolean(landmarks))
        if (!landmarks) {
          candidateRef.current = null
          candidateFramesRef.current = 0
          setGesture(null)
          setStableGesture(null)
          return
        }

        if (canvas && context) {
          const toCanvasPoint = (point: { x: number; y: number }) => ({
            x: point.x * canvas.width,
            y: point.y * canvas.height,
          })
          context.strokeStyle = 'rgba(202, 255, 91, 0.78)'
          context.lineWidth = Math.max(2, canvas.width / 320)
          for (const connection of HandLandmarker.HAND_CONNECTIONS) {
            const start = toCanvasPoint(landmarks[connection.start])
            const end = toCanvasPoint(landmarks[connection.end])
            context.beginPath()
            context.moveTo(start.x, start.y)
            context.lineTo(end.x, end.y)
            context.stroke()
          }
          context.fillStyle = '#f4ffd9'
          for (const landmark of landmarks) {
            const point = toCanvasPoint(landmark)
            context.beginPath()
            context.arc(point.x, point.y, Math.max(2.5, canvas.width / 230), 0, Math.PI * 2)
            context.fill()
          }
        }

        const move = classifyGesture(landmarks)
        setGesture(move)
        if (!move) {
          candidateRef.current = null
          candidateFramesRef.current = 0
          setStableGesture(null)
          return
        }
        if (candidateRef.current === move) candidateFramesRef.current += 1
        else {
          candidateRef.current = move
          candidateFramesRef.current = 1
          setStableGesture(null)
        }
        if (candidateFramesRef.current >= 5) setStableGesture(move)
      }

      frameRef.current = requestAnimationFrame(detect)
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop())
      landmarker?.close()
      if (generation !== generationRef.current) return
      releaseResources()
      const denied = error instanceof DOMException && error.name === 'NotAllowedError'
      setCameraError(
        denied
          ? 'Camera permission was denied. Allow access in your browser or use manual mode.'
          : error instanceof Error
            ? error.message
            : 'The camera or hand model could not be started.',
      )
      setCameraStatus('error')
    } finally {
      if (generation === generationRef.current) startingRef.current = false
    }
  }, [cameraStatus, releaseResources, resetDetection])

  useEffect(
    () => () => {
      generationRef.current += 1
      releaseResources()
    },
    [releaseResources],
  )

  return {
    videoRef,
    canvasRef,
    cameraStatus,
    cameraError,
    gesture,
    stableGesture,
    handPresent,
    startCamera,
    stopCamera,
  }
}
