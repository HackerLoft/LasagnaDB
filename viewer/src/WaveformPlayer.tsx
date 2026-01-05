import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'

interface WaveformPlayerProps {
    uuid: string;
    audioUrl: string;
    onPlay?: () => void;
    onPause?: () => void;
}

export function WaveformPlayer({ uuid, audioUrl, onPlay, onPause }: WaveformPlayerProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const wavesurferRef = useRef<WaveSurfer | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)

    useEffect(() => {
        if (!containerRef.current) return

        const wavesurfer = WaveSurfer.create({
            container: containerRef.current,
            waveColor: '#4F4A85',
            progressColor: '#383351',
            url: audioUrl,
            height: 60,
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
        })

        wavesurfer.on('play', () => {
            setIsPlaying(true)
            onPlay?.()
        })
        wavesurfer.on('pause', () => {
            setIsPlaying(false)
            onPause?.()
        })
        wavesurfer.on('finish', () => setIsPlaying(false))

        // Auto-play when loaded? The user said "on plying audio we have to show wave show player at the same row", 
        // implying clicking play triggers this view. So maybe auto-play is good.
        wavesurfer.on('ready', () => {
            wavesurfer.play()
        })

        wavesurferRef.current = wavesurfer

        return () => {
            wavesurfer.destroy()
        }
    }, [audioUrl])

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation()
        wavesurferRef.current?.playPause()
    }

    return (
        <div className="waveform-player" onClick={(e) => e.stopPropagation()}>
            <button className="play-btn" onClick={togglePlay}>
                {isPlaying ? '⏸' : '▶'}
            </button>
            <div className="waveform-container" ref={containerRef} />
        </div>
    )
}
