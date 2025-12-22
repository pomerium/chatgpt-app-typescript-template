import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Logger } from 'pino';

/**
 * Session data for an MCP server instance
 */
export interface SessionData {
  server: Server;
  transport: StreamableHTTPServerTransport;
  createdAt: Date;
}

/**
 * Manages MCP server sessions with cleanup capabilities
 */
export class SessionManager {
  private sessions: Map<string, SessionData>;
  private logger: Logger;

  constructor(logger: Logger) {
    this.sessions = new Map();
    this.logger = logger;
  }

  /**
   * Create a new session
   */
  create(sessionId: string, server: Server, transport: StreamableHTTPServerTransport): SessionData {
    const sessionData: SessionData = {
      server,
      transport,
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, sessionData);

    this.logger.info({ sessionId, sessionCount: this.sessions.size }, 'Session created');

    return sessionData;
  }

  /**
   * Get a session by ID
   */
  get(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Delete a session
   */
  delete(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);

    if (deleted) {
      this.logger.info({ sessionId, sessionCount: this.sessions.size }, 'Session deleted');
    }

    return deleted;
  }

  /**
   * Cleanup stale sessions older than maxAge (in milliseconds)
   */
  cleanup(maxAge: number): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now - session.createdAt.getTime();

      if (age > maxAge) {
        this.sessions.delete(sessionId);
        cleaned++;

        this.logger.info({ sessionId, age }, 'Cleaned up stale session');
      }
    }

    if (cleaned > 0) {
      this.logger.info({ cleaned, remaining: this.sessions.size }, 'Session cleanup complete');
    }

    return cleaned;
  }

  /**
   * Get current session count
   */
  count(): number {
    return this.sessions.size;
  }

  /**
   * Close all sessions and clean up
   */
  async closeAll(): Promise<void> {
    this.logger.info({ count: this.sessions.size }, 'Closing all sessions');

    for (const [sessionId, session] of this.sessions.entries()) {
      try {
        await session.transport.close();
        this.logger.debug({ sessionId }, 'Transport closed');
      } catch (err) {
        this.logger.error({ err, sessionId }, 'Error closing transport');
      }
    }

    this.sessions.clear();
    this.logger.info('All sessions closed');
  }
}
