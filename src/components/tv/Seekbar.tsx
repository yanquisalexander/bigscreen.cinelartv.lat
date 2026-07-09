import { useRef, useEffect } from 'react';
import { formatTime } from '@/utils/helpers';

const ACCENT = '#FFFFFF';

/* ─── Seekbar ───────────────────────────────────────────────────────────
   Se actualiza directo por DOM en cada frame (requestAnimationFrame),
   leyendo video.currentTime / video.buffered sin pasar por React state.
   Esto es lo que más impacto tiene en WebView de Android TV: evita que el
   componente padre (y con él, todo el rail de episodios) se re-renderice
   varias veces por segundo solo para mover una barra de progreso. */

export function Seekbar({
    videoRef,
    duration,
    chapterMarks = [],
}: {
    videoRef: React.RefObject<HTMLVideoElement>;
    duration: number;
    chapterMarks?: number[];
}) {
    const fillRef = useRef<HTMLDivElement>(null);
    const bufferedRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLDivElement>(null);
    const currentTimeLabelRef = useRef<HTMLSpanElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        let rafId: number;
        let lastWrite = 0;
        let lastPct = -1;
        // ~10fps es más que suficiente para una barra de progreso y libera
        // el Main Thread (decisivo en Chromium viejo / CPU limitada).
        const FRAME_MS = 100;

        const update = (ts: number) => {
            if (ts - lastWrite >= FRAME_MS) {
                lastWrite = ts;
                const dur = video.duration || 0;
                const ct = video.currentTime;
                const pct = dur > 0 ? (ct / dur) * 100 : 0;

                // Solo tocar el DOM si el valor cambió de forma visible.
                if (Math.abs(pct - lastPct) > 0.5) {
                    lastPct = pct;
                    let bufferedEnd = 0;
                    if (video.buffered.length > 0) {
                        bufferedEnd = video.buffered.end(video.buffered.length - 1);
                    }
                    const bufferedPct = dur > 0 ? (bufferedEnd / dur) * 100 : 0;

                    if (fillRef.current) fillRef.current.style.width = `${pct}%`;
                    if (bufferedRef.current) bufferedRef.current.style.width = `${bufferedPct}%`;
                    if (thumbRef.current) thumbRef.current.style.left = `${pct}%`;
                    if (currentTimeLabelRef.current) currentTimeLabelRef.current.textContent = formatTime(ct);
                }
            }
            rafId = requestAnimationFrame(update);
        };

        rafId = requestAnimationFrame(update);
        return () => cancelAnimationFrame(rafId);
    }, [videoRef]);

    return (
        <div className="seekbar-group flex items-center gap-4 h-full">
            <span ref={currentTimeLabelRef} className="text-white/90 text-sm font-medium w-14 text-right tabular-nums">
                0:00
            </span>

            <div
                ref={trackRef}
                className="seekbar-track relative flex-1 h-10 flex items-center cursor-pointer group"
            >
                <div className="relative z-0 h-[4px] w-full rounded-full bg-white/[0.16] transition-all duration-200 ease-out group-hover:h-[6px]">
                    <div ref={bufferedRef} className="absolute inset-y-0 left-0 bg-white/[0.12] rounded-full" style={{ width: '0%' }} />
                    <div ref={fillRef} className="absolute inset-y-0 left-0 rounded-full" style={{ width: '0%', backgroundColor: ACCENT, boxShadow: `0 0 10px ${ACCENT}55` }} />

                    {chapterMarks.map((pct, i) => (
                        <div
                            key={i}
                            className="absolute top-1/2 -translate-y-1/2 w-[2px] h-3 bg-black/50 rounded-full"
                            style={{ left: `${pct}%` }}
                        />
                    ))}
                </div>

                <div
                    ref={thumbRef}
                    className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 w-[14px] h-[14px] rounded-full border-2 border-white bg-white opacity-0 transition-all duration-200 ease-out group-hover:opacity-100"
                    style={{ left: '-7px' }}
                />
            </div>

            <span className="text-white/40 text-sm font-medium w-14 tabular-nums">
                {formatTime(duration)}
            </span>
        </div>
    );
}