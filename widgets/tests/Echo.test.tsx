import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Echo from '../src/echo/Echo.js';
import { createMockApp } from '../src/mocks/mock-app.js';
import type { EchoToolOutput } from 'chatgpt-app-server/types';

describe('Echo', () => {
  it('should render the echoed message', async () => {
    render(
      <Echo
        app={createMockApp<EchoToolOutput>({
          toolOutput: {
            echoedMessage: 'Test Message',
            timestamp: new Date().toISOString(),
          },
        })}
      />
    );

    expect(await screen.findByText(/Test Message/i)).toBeTruthy();
  });

  it('should show a fallback message when empty', async () => {
    render(<Echo app={createMockApp<EchoToolOutput>({ toolOutput: null })} />);

    expect(await screen.findByText(/No message yet/i)).toBeTruthy();
  });

  it('should render action buttons', async () => {
    render(
      <Echo
        app={createMockApp<EchoToolOutput>({
          toolOutput: {
            echoedMessage: 'Action Test',
            timestamp: new Date().toISOString(),
          },
        })}
      />
    );

    expect(
      await screen.findByRole('button', { name: /call echo tool/i })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /^clear$/i })
    ).toBeTruthy();
  });
});
