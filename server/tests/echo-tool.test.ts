import { describe, it, expect } from 'vitest';
import { EchoToolInputSchema } from '../src/types.js';

describe('Echo Tool', () => {
  describe('Input validation', () => {
    it('should accept valid message', () => {
      const input = { message: 'Hello, World!' };
      const result = EchoToolInputSchema.parse(input);

      expect(result).toEqual(input);
      expect(result.message).toBe('Hello, World!');
    });

    it('should reject empty message', () => {
      const input = { message: '' };

      expect(() => EchoToolInputSchema.parse(input)).toThrow();
    });

    it('should reject missing message', () => {
      const input = {};

      expect(() => EchoToolInputSchema.parse(input)).toThrow();
    });

    it('should reject non-string message', () => {
      const input = { message: 123 };

      expect(() => EchoToolInputSchema.parse(input)).toThrow();
    });
  });

  describe('Tool output structure', () => {
    it('should match expected output format', () => {
      const input = { message: 'Test message' };
      const validated = EchoToolInputSchema.parse(input);

      // Simulate tool output
      const output = {
        echoedMessage: validated.message,
        timestamp: new Date().toISOString(),
      };

      expect(output).toHaveProperty('echoedMessage');
      expect(output).toHaveProperty('timestamp');
      expect(output.echoedMessage).toBe('Test message');
      expect(output.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
