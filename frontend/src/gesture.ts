import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { Move } from './types'

type FingerState = 'extended' | 'curled' | 'unknown'

const fingers = [
  { mcp: 5, pip: 6, tip: 8 },
  { mcp: 9, pip: 10, tip: 12 },
  { mcp: 13, pip: 14, tip: 16 },
  { mcp: 17, pip: 18, tip: 20 },
]

function distance(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

function jointAngle(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark) {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z }
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z
  const magnitude = Math.hypot(ba.x, ba.y, ba.z) * Math.hypot(bc.x, bc.y, bc.z)
  return (Math.acos(Math.min(1, Math.max(-1, dot / magnitude))) * 180) / Math.PI
}

function readFinger(
  landmarks: NormalizedLandmark[],
  finger: (typeof fingers)[number],
): FingerState {
  const wrist = landmarks[0]
  const mcp = landmarks[finger.mcp]
  const pip = landmarks[finger.pip]
  const tip = landmarks[finger.tip]
  const angle = jointAngle(mcp, pip, tip)
  const tipDistance = distance(wrist, tip)
  const pipDistance = distance(wrist, pip)

  if (angle > 155 && tipDistance > pipDistance * 1.08) return 'extended'
  if (angle < 125 && tipDistance < pipDistance * 1.2) return 'curled'
  return 'unknown'
}

export function classifyGesture(landmarks: NormalizedLandmark[]): Move | null {
  if (landmarks.length !== 21) return null
  const states = fingers.map((finger) => readFinger(landmarks, finger))

  if (states.every((state) => state === 'extended')) return 'paper'
  if (states.every((state) => state === 'curled')) return 'rock'
  if (
    states[0] === 'extended' &&
    states[1] === 'extended' &&
    states[2] === 'curled' &&
    states[3] === 'curled'
  ) {
    return 'scissors'
  }
  return null
}
