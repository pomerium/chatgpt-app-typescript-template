import { useEffect, useRef } from 'react';
import './styles.css';

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

    // Calculate animation duration based on speed
    const width = marqueeRef.current.scrollWidth / 2; // Divide by 2 because we duplicate the message
    const duration = width / speed;

    marqueeRef.current.style.setProperty('--marquee-duration', `${duration}s`);
  }, [message, speed]);

  // Duplicate message for seamless loop
  const displayMessage = `${message} • ${message} • ${message} • `;

  return (
    <div className="marquee-container" role="region" aria-label="Echo marquee">
      <div className="marquee-wrapper">
        <div ref={marqueeRef} className="marquee-content">
          <span className="marquee-text">{displayMessage}</span>
          <span className="marquee-text" aria-hidden="true">
            {displayMessage}
          </span>
        </div>
      </div>
    </div>
  );
}
