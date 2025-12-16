"use client";

import { useState, useCallback } from "react";

/**
 * Hook for managing async action state (loading, error, execution)
 *
 * Consolidates the common fetch/loading/error pattern used across components.
 *
 * @example
 * ```tsx
 * const { loading, error, execute, setError } = useAsyncAction<ResponseData>();
 *
 * const handleSubmit = async () => {
 *   const result = await execute(async () => {
 *     const res = await fetch('/api/endpoint', { method: 'POST' });
 *     if (!res.ok) throw new Error('Failed');
 *     return res.json();
 *   });
 *   // result is typed as ResponseData
 * };
 * ```
 */
export function useAsyncAction<T = void>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (fn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return { loading, error, execute, setError, reset };
}

/**
 * Hook for managing async action with success callback
 *
 * Extended version that includes onSuccess callback for common patterns
 * like refreshing data or closing modals after successful operations.
 *
 * @example
 * ```tsx
 * const { loading, error, execute } = useAsyncActionWithCallback({
 *   onSuccess: () => {
 *     router.refresh();
 *     closeModal();
 *   },
 *   onError: (err) => console.error(err),
 * });
 * ```
 */
export function useAsyncActionWithCallback<T = void>(options?: {
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (fn: () => Promise<T>): Promise<T | undefined> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      options?.onSuccess?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("An error occurred");
      setError(error.message);
      options?.onError?.(error);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [options]);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return { loading, error, execute, setError, reset };
}
