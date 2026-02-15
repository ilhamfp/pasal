/** A single step in the MCP demo animation sequence. */
export type DemoStep =
  | { type: "user"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool-call"; name: string; input: Record<string, unknown> }
  | { type: "tool-result"; name: string; data: Record<string, unknown> }
  | { type: "assistant"; text: string }
  | { type: "pause"; duration: number };

/** Timing configuration (milliseconds). */
export type DemoTiming = {
  /** Delay before each character when showing user typing. */
  userTypingSpeed: number;
  /** Delay before each word when streaming assistant response. */
  assistantWordSpeed: number;
  /** How long the "thinking" indicator shows before first tool call. */
  thinkingDuration: number;
  /** How long to show each tool call before expanding its result. */
  toolCallDuration: number;
  /** How long tool results stay visible before next step. */
  toolResultDuration: number;
  /** Pause after the full sequence before restarting. */
  restartDelay: number;
};

export const DEFAULT_TIMING: DemoTiming = {
  userTypingSpeed: 35,
  assistantWordSpeed: 30,
  thinkingDuration: 1500,
  toolCallDuration: 800,
  toolResultDuration: 1800,
  restartDelay: 4000,
};
