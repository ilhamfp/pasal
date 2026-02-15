"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { DemoStep, DemoTiming } from "./types";
import { DEFAULT_TIMING } from "./types";
import { stripLinkSyntax } from "./parse-links";

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

/** Strip link syntax from text before splitting into words. */
function getPlainWords(text: string): string[] {
  return stripLinkSyntax(text).split(/\s+/);
}

/**
 * Orchestrates the MCP demo animation sequence.
 *
 * Usage:
 * ```tsx
 * const { state, start, stop, pause, resume, reset } = useAnimation(DEMO_SCRIPT);
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
  /** When paused during a text step, stores the word index to resume from. -1 = not in a text step. */
  const pausedAtWordRef = useRef(-1);
  /** When paused during a non-text step, stores the remaining duration. */
  const pausedRemainingRef = useRef(-1);
  /** Timestamp when a non-text step timeout was started (for computing remaining time). */
  const stepStartTimeRef = useRef(0);
  /** Duration of the current non-text step timeout. */
  const stepDurationRef = useRef(0);

  const clearPending = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  /**
   * Get the total duration (ms) to display a step before moving on.
   * Text steps use word count x speed; other steps use fixed durations.
   */
  const getStepDuration = useCallback(
    (step: DemoStep): number => {
      switch (step.type) {
        case "user":
          return stripLinkSyntax(step.text).length * timing.userTypingSpeed + 600;
        case "assistant":
          return getPlainWords(step.text).length * timing.assistantWordSpeed + 1200;
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
   * Start revealing words from a given index within the current text step.
   * Used by both advanceStep (from 0) and resume (from pausedAtWordRef).
   */
  const revealWordsFrom = useCallback(
    (words: string[], startWord: number, speed: number, step: DemoStep) => {
      let wordIndex = startWord;

      const revealNextWord = () => {
        if (!isPlayingRef.current) return;
        wordIndex++;
        setState((s) => ({ ...s, revealedWords: wordIndex }));
        if (wordIndex < words.length) {
          timeoutRef.current = setTimeout(revealNextWord, speed);
        } else {
          // All words revealed — wait, then advance
          const postDelay = step.type === "user" ? 600 : 1200;
          stepStartTimeRef.current = Date.now();
          stepDurationRef.current = postDelay;
          pausedAtWordRef.current = -1;
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          timeoutRef.current = setTimeout(advanceStep, postDelay);
        }
      };
      timeoutRef.current = setTimeout(revealNextWord, speed);
    },
    // advanceStep added below via the dependency array pattern
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      stepStartTimeRef.current = Date.now();
      stepDurationRef.current = 300;
      pausedAtWordRef.current = -1;
      timeoutRef.current = setTimeout(advanceStep, 300);
      return;
    }

    indexRef.current = nextIndex;
    const step = script[nextIndex];

    // Calculate word count for text steps (strip link syntax)
    const words =
      step.type === "user" || step.type === "assistant" || step.type === "thinking"
        ? getPlainWords(step.text)
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
      pausedAtWordRef.current = 0;
      revealWordsFrom(words, 0, speed, step);
    } else {
      // Non-text step — wait fixed duration, then advance
      const duration = getStepDuration(step);
      stepStartTimeRef.current = Date.now();
      stepDurationRef.current = duration;
      pausedAtWordRef.current = -1;
      timeoutRef.current = setTimeout(advanceStep, duration);
    }
  }, [script, timing, getStepDuration, revealWordsFrom]);

  const start = useCallback(() => {
    clearPending();
    isPlayingRef.current = true;
    indexRef.current = -1;
    pausedAtWordRef.current = -1;
    pausedRemainingRef.current = -1;
    setState({
      visibleSteps: [],
      activeIndex: -1,
      revealedWords: 0,
      totalWords: 0,
      isPlaying: true,
    });
    stepStartTimeRef.current = Date.now();
    stepDurationRef.current = 500;
    timeoutRef.current = setTimeout(advanceStep, 500);
  }, [advanceStep, clearPending]);

  const stop = useCallback(() => {
    clearPending();
    isPlayingRef.current = false;
    pausedAtWordRef.current = -1;
    pausedRemainingRef.current = -1;
    setState((s) => ({ ...s, isPlaying: false }));
  }, [clearPending]);

  const pause = useCallback(() => {
    if (!isPlayingRef.current) return;
    clearPending();
    isPlayingRef.current = false;

    // Snapshot where we are for resume
    const currentIndex = indexRef.current;
    if (currentIndex >= 0 && currentIndex < script.length) {
      const step = script[currentIndex];
      if (
        (step.type === "user" || step.type === "assistant" || step.type === "thinking") &&
        pausedAtWordRef.current >= 0
      ) {
        // We're mid-text: pausedAtWordRef already tracks word position via setState
        // Read the latest revealedWords from state snapshot
        setState((s) => {
          pausedAtWordRef.current = s.revealedWords;
          return { ...s, isPlaying: false };
        });
        return;
      }
    }

    // Non-text step: compute remaining time
    const elapsed = Date.now() - stepStartTimeRef.current;
    pausedRemainingRef.current = Math.max(0, stepDurationRef.current - elapsed);
    setState((s) => ({ ...s, isPlaying: false }));
  }, [clearPending, script]);

  const resume = useCallback(() => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    setState((s) => ({ ...s, isPlaying: true }));

    const currentIndex = indexRef.current;

    // Not started yet — just start
    if (currentIndex < 0) {
      stepStartTimeRef.current = Date.now();
      stepDurationRef.current = 500;
      timeoutRef.current = setTimeout(advanceStep, 500);
      return;
    }

    const step = script[currentIndex];

    // Resume mid-text step
    if (
      (step.type === "user" || step.type === "assistant" || step.type === "thinking") &&
      pausedAtWordRef.current >= 0
    ) {
      const words = getPlainWords(step.text);
      const fromWord = pausedAtWordRef.current;

      if (fromWord >= words.length) {
        // Text was fully revealed — just wait the post-text delay then advance
        const postDelay = step.type === "user" ? 600 : 1200;
        stepStartTimeRef.current = Date.now();
        stepDurationRef.current = postDelay;
        pausedAtWordRef.current = -1;
        timeoutRef.current = setTimeout(advanceStep, postDelay);
      } else {
        const speed =
          step.type === "user" ? timing.userTypingSpeed * 4 : timing.assistantWordSpeed;
        revealWordsFrom(words, fromWord, speed, step);
      }
      return;
    }

    // Resume non-text step with remaining time
    const remaining = pausedRemainingRef.current > 0 ? pausedRemainingRef.current : 0;
    stepStartTimeRef.current = Date.now();
    stepDurationRef.current = remaining;
    pausedRemainingRef.current = -1;
    timeoutRef.current = setTimeout(advanceStep, remaining);
  }, [advanceStep, script, timing, revealWordsFrom]);

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

  return { state, start, stop, pause, resume, reset };
}
