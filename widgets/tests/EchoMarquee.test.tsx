import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EchoMarquee } from '../src/echo-marquee/EchoMarquee.js';

describe('EchoMarquee', () => {
  it('should render the message', () => {
    render(<EchoMarquee message="Test Message" />);

    // Message appears multiple times due to duplication for seamless loop
    const messages = screen.getAllByText(/Test Message/i);
    expect(messages.length).toBeGreaterThan(0);
  });

  it('should have proper ARIA attributes', () => {
    render(<EchoMarquee message="Accessible Message" />);

    const region = screen.getByRole('region', { name: /echo marquee/i });
    expect(region).toBeInTheDocument();
  });

  it('should apply default speed when not specified', () => {
    const { container } = render(<EchoMarquee message="Default Speed" />);

    const marqueeContent = container.querySelector('.marquee-content');
    expect(marqueeContent).toBeInTheDocument();
  });

  it('should handle custom speed prop', () => {
    const { container } = render(<EchoMarquee message="Fast" speed={100} />);

    const marqueeContent = container.querySelector('.marquee-content');
    expect(marqueeContent).toBeInTheDocument();
  });

  it('should display message with proper styling', () => {
    const { container } = render(<EchoMarquee message="Styled Message" />);

    const marqueeContainer = container.querySelector('.marquee-container');
    expect(marqueeContainer).toBeInTheDocument();
    expect(marqueeContainer).toHaveClass('marquee-container');
  });

  it('should duplicate message for seamless loop', () => {
    render(<EchoMarquee message="Loop Test" />);

    // The message should appear multiple times
    const allText = screen.getAllByText(/Loop Test/);
    expect(allText.length).toBeGreaterThan(1);
  });

  it('should handle empty message gracefully', () => {
    const { container } = render(<EchoMarquee message="" />);

    const marqueeContainer = container.querySelector('.marquee-container');
    expect(marqueeContainer).toBeInTheDocument();
  });

  it('should handle very long messages', () => {
    const longMessage = 'A'.repeat(500);
    render(<EchoMarquee message={longMessage} />);

    const region = screen.getByRole('region');
    expect(region).toBeInTheDocument();
  });
});
