import type { Move } from './types'

interface MoveGlyphProps {
  move: Move
  size?: number
  title?: string
}

export function MoveGlyph({ move, size = 64, title }: MoveGlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
    >
      {move === 'rock' && (
        <>
          <path d="M17 31V20a5 5 0 0 1 10 0v8-11a5 5 0 0 1 10 0v11-8a5 5 0 0 1 10 0v14-6a5 5 0 0 1 10 0v17c0 10-7 15-17 15H30C19 60 13 53 12 43l-2-12a5 5 0 0 1 7-5Z" />
          <path d="M17 36h30M27 28v13M37 28v13M47 34v7M20 47c6-3 17-3 24 1" />
        </>
      )}
      {move === 'paper' && (
        <>
          <path d="M17 34V12a4 4 0 0 1 8 0v19-23a4 4 0 0 1 8 0v23-21a4 4 0 0 1 8 0v23-17a4 4 0 0 1 8 0v28c0 11-7 16-18 16h-3c-8 0-13-4-17-11L5 35a5 5 0 0 1 8-5l4 4Z" />
          <path d="M25 31v7M33 31v8M41 32v7M17 44c8-3 19-2 25 3" />
        </>
      )}
      {move === 'scissors' && (
        <>
          <path d="m18 34-5-23a4 4 0 0 1 7-3l11 22L43 7a4 4 0 0 1 7 3L40 37l5-5a5 5 0 0 1 8 5l-4 8c-4 10-11 15-22 15-11 0-17-6-18-16L7 33a5 5 0 0 1 9-4l2 5Z" />
          <path d="m18 34 7 5M31 30l-3 12M39 38l-5 5M17 48c7-3 16-2 22 2" />
        </>
      )}
    </svg>
  )
}
