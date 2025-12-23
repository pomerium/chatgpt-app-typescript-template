import { useEffect, useRef } from 'react';

export interface EchoMarqueeProps {
  /**
   * The message to display in the marquee
   */
  message: string;

  /**
   * Scroll speed in pixels per second (default: 50)
   */
  speed?: number;
}

/**
 * A scrolling marquee component that displays an echoed message
 *
 * Features:
 * - Smooth CSS animation
 * - Configurable speed
 * - Dark/light mode support
 * - Accessible with ARIA labels
 */
export function EchoMarquee({ message, speed = 50 }: EchoMarqueeProps) {
  const marqueeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!marqueeRef.current) return;

    const width = marqueeRef.current.scrollWidth / 2;
    const duration = width / speed;

    marqueeRef.current.style.setProperty('--marquee-duration', `${duration}s`);
  }, [message, speed]);

  const displayMessage = `${message}`;

  return (
    <div
      className="w-full overflow-hidden rounded-lg border shadow-sm bg-card"
      role="region"
      aria-label="Echo marquee"
    >
      <div className="relative w-full py-4">
        <div
          ref={marqueeRef}
          className="flex whitespace-nowrap hover:[animation-play-state:paused]"
          style={{
            animation:
              'marquee-scroll var(--marquee-duration, 20s) linear infinite',
          }}
        >
          <span className="inline-block text-2xl font-bold px-8 text-primary">
            {displayMessage}
          </span>
          <span
            className="inline-block text-2xl font-bold px-8 text-primary"
            aria-hidden="true"
          >
            {displayMessage}
          </span>
        </div>
      </div>
    </div>
  );
}
