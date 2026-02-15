"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { DemoStep, DemoTiming } from "./types";
import { DEFAULT_TIMING } from "./types";

export type AnimationState = {
  /** Steps that are currently visible (accumulated, not replaced). */
  visibleSteps: DemoStep[];
  /** Index of the step currently being "typed" or animated. */
  activeIndex: number;
  /** For typing effects: how much of the current text to show (word count). */
  revealedWords: number;
  /** Total word count of the current text step (for progress calculation). */
  totalWords: number;
  /** Whether the animation is currently running. */
  isPlaying: boolean;
};

/**
 * Orchestrates the MCP demo animation sequence.
 *
 * Usage:
 * ```tsx
 * const { state, start, reset } = useAnimation(DEMO_SCRIPT);
 * ```
 *
 * The hook accumulates visible steps over time, advancing through
 * the script with appropriate delays for each step type. Text steps
 * ("user" and "assistant") reveal word-by-word.
 */
export function useAnimation(
  script: DemoStep[],
  timing: DemoTiming = DEFAULT_TIMING,
) {
  const [state, setState] = useState<AnimationState>({
    visibleSteps: [],
    activeIndex: -1,
    revealedWords: 0,
    totalWords: 0,
    isPlaying: false,
  });

  // Refs to avoid stale closures in timeouts
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const indexRef = useRef(-1);
  const isPlayingRef = useRef(false);

  const clearPending = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  /**
   * Get the total duration (ms) to display a step before moving on.
   * Text steps use word count × speed; other steps use fixed durations.
   */
  const getStepDuration = useCallback(
    (step: DemoStep): number => {
      switch (step.type) {
        case "user":
          return step.text.length * timing.userTypingSpeed + 600;
        case "assistant":
          return step.text.split(/\s+/).length * timing.assistantWordSpeed + 1200;
        case "thinking":
          return timing.thinkingDuration;
        case "tool-call":
          return timing.toolCallDuration;
        case "tool-result":
          return timing.toolResultDuration;
        case "pause":
          return step.duration;
      }
    },
    [timing],
  );

  /**
   * Advance to the next step in the script.
   * Called recursively via setTimeout to create the animation loop.
   */
  const advanceStep = useCallback(() => {
    if (!isPlayingRef.current) return;

    const nextIndex = indexRef.current + 1;

    // Loop: restart from beginning
    if (nextIndex >= script.length) {
      setState((s) => ({ ...s, visibleSteps: [], activeIndex: -1 }));
      indexRef.current = -1;
      timeoutRef.current = setTimeout(advanceStep, 300);
      return;
    }

    indexRef.current = nextIndex;
    const step = script[nextIndex];

    // Calculate word count for text steps
    const words =
      step.type === "user" || step.type === "assistant" || step.type === "thinking"
        ? step.text.split(/\s+/)
        : [];

    setState((s) => ({
      ...s,
      visibleSteps: [...s.visibleSteps, step],
      activeIndex: nextIndex,
      revealedWords: 0,
      totalWords: words.length,
    }));

    // For text steps, animate word-by-word reveal
    if (words.length > 0) {
      const speed =
        step.type === "user" ? timing.userTypingSpeed * 4 : timing.assistantWordSpeed;
      let wordIndex = 0;

      const revealNextWord = () => {
        if (!isPlayingRef.current) return;
        wordIndex++;
        setState((s) => ({ ...s, revealedWords: wordIndex }));
        if (wordIndex < words.length) {
          timeoutRef.current = setTimeout(revealNextWord, speed);
        } else {
          // All words revealed — wait, then advance
          timeoutRef.current = setTimeout(advanceStep, step.type === "user" ? 600 : 1200);
        }
      };
      timeoutRef.current = setTimeout(revealNextWord, speed);
    } else {
      // Non-text step — wait fixed duration, then advance
      timeoutRef.current = setTimeout(advanceStep, getStepDuration(step));
    }
  }, [script, timing, getStepDuration]);

  const start = useCallback(() => {
    clearPending();
    isPlayingRef.current = true;
    indexRef.current = -1;
    setState({
      visibleSteps: [],
      activeIndex: -1,
      revealedWords: 0,
      totalWords: 0,
      isPlaying: true,
    });
    timeoutRef.current = setTimeout(advanceStep, 500);
  }, [advanceStep, clearPending]);

  const stop = useCallback(() => {
    clearPending();
    isPlayingRef.current = false;
    setState((s) => ({ ...s, isPlaying: false }));
  }, [clearPending]);

  const reset = useCallback(() => {
    stop();
    setState({
      visibleSteps: [],
      activeIndex: -1,
      revealedWords: 0,
      totalWords: 0,
      isPlaying: false,
    });
  }, [stop]);

  // Cleanup on unmount
  useEffect(() => clearPending, [clearPending]);

  return { state, start, stop, reset };
}
