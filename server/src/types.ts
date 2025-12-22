import { z } from 'zod';

/**
 * Echo tool input schema (Zod)
 */
export const EchoToolInputSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
});

export type EchoToolInput = z.infer<typeof EchoToolInputSchema>;

/**
 * Echo tool structured content output
 */
export interface EchoToolOutput {
  echoedMessage: string;
  timestamp: string;
}

/**
 * Widget descriptor for tool metadata
 */
export interface WidgetDescriptor {
  id: string;
  title: string;
  uri: string;
}
