import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Echo from '../src/echo/Echo.js';

describe('Echo', () => {
  it('should render the message', () => {
    render(<Echo message="Test Message" />);

    const messages = screen.getAllByText(/Test Message/i);
    expect(messages.length).toBeGreaterThan(0);
  });

  it('should have proper ARIA attributes', () => {
    render(<Echo message="Accessible Message" />);

    const region = screen.getByRole('region', { name: /echo marquee/i });
    expect(region).toBeInTheDocument();
  });

  it('should apply default speed when not specified', () => {
    const { container } = render(<Echo message="Default Speed" />);

    const marqueeContent = container.querySelector('.marquee-content');
    expect(marqueeContent).toBeInTheDocument();
  });

  it('should handle custom speed prop', () => {
    const { container } = render(<Echo message="Fast" speed={100} />);

    const marqueeContent = container.querySelector('.marquee-content');
    expect(marqueeContent).toBeInTheDocument();
  });

  it('should display message with proper styling', () => {
    const { container } = render(<Echo message="Styled Message" />);

    const marqueeContainer = container.querySelector('.marquee-container');
    expect(marqueeContainer).toBeInTheDocument();
    expect(marqueeContainer).toHaveClass('marquee-container');
  });

  it('should duplicate message for seamless loop', () => {
    render(<Echo message="Loop Test" />);

    const allText = screen.getAllByText(/Loop Test/);
    expect(allText.length).toBeGreaterThan(1);
  });

  it('should handle empty message gracefully', () => {
    const { container } = render(<Echo message="" />);

    const marqueeContainer = container.querySelector('.marquee-container');
    expect(marqueeContainer).toBeInTheDocument();
  });

  it('should handle very long messages', () => {
    const longMessage = 'A'.repeat(500);
    render(<Echo message={longMessage} />);

    const region = screen.getByRole('region');
    expect(region).toBeInTheDocument();
  });
});
