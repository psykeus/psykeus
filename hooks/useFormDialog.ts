"use client";

import { useState, useCallback } from "react";

// =============================================================================
// Basic Form Dialog Hook
// =============================================================================

export interface UseFormDialogOptions<T> {
  /** Initial values for the form */
  initialValues: T;
  /** Called when dialog should close after success */
  onClose?: () => void;
}

export interface UseFormDialogReturn<T> {
  /** Whether dialog is open */
  open: boolean;
  /** Set dialog open state */
  setOpen: (open: boolean) => void;
  /** Open the dialog */
  openDialog: () => void;
  /** Current form values */
  values: T;
  /** Set form values */
  setValues: React.Dispatch<React.SetStateAction<T>>;
  /** Update a single field */
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
  /** Whether form is submitting */
  loading: boolean;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Current error message */
  error: string | null;
  /** Set error message */
  setError: (error: string | null) => void;
  /** Success message */
  success: string | null;
  /** Set success message */
  setSuccess: (success: string | null) => void;
  /** Reset form to initial values and clear errors */
  reset: () => void;
  /** Close dialog and reset form */
  close: () => void;
  /** Handle dialog open change (for Dialog component) */
  handleOpenChange: (open: boolean) => void;
}

/**
 * Hook for managing form dialog state
 *
 * Consolidates the common pattern of form dialogs with:
 * - Open/close state
 * - Form values
 * - Loading state
 * - Error/success messages
 * - Reset functionality
 *
 * @example
 * ```tsx
 * const dialog = useFormDialog({
 *   initialValues: { email: "", name: "", role: "user" },
 * });
 *
 * const handleSubmit = async (e: React.FormEvent) => {
 *   e.preventDefault();
 *   dialog.setLoading(true);
 *   dialog.setError(null);
 *
 *   try {
 *     await createUser(dialog.values);
 *     dialog.setSuccess("User created!");
 *     setTimeout(() => dialog.close(), 1500);
 *   } catch (err) {
 *     dialog.setError(err.message);
 *   } finally {
 *     dialog.setLoading(false);
 *   }
 * };
 *
 * return (
 *   <Dialog open={dialog.open} onOpenChange={dialog.handleOpenChange}>
 *     <DialogTrigger asChild>
 *       <Button onClick={dialog.openDialog}>Create User</Button>
 *     </DialogTrigger>
 *     <DialogContent>
 *       <form onSubmit={handleSubmit}>
 *         <Input
 *           value={dialog.values.email}
 *           onChange={(e) => dialog.updateField("email", e.target.value)}
 *         />
 *         {dialog.error && <ErrorMessage>{dialog.error}</ErrorMessage>}
 *         <Button disabled={dialog.loading}>
 *           {dialog.loading ? "Creating..." : "Create"}
 *         </Button>
 *       </form>
 *     </DialogContent>
 *   </Dialog>
 * );
 * ```
 */
export function useFormDialog<T extends Record<string, unknown>>(
  options: UseFormDialogOptions<T>
): UseFormDialogReturn<T> {
  const { initialValues, onClose } = options;

  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<T>(initialValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reset = useCallback(() => {
    setValues(initialValues);
    setError(null);
    setSuccess(null);
    setLoading(false);
  }, [initialValues]);

  const close = useCallback(() => {
    setOpen(false);
    reset();
    onClose?.();
  }, [reset, onClose]);

  const openDialog = useCallback(() => {
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      close();
    } else {
      setOpen(true);
    }
  }, [close]);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  return {
    open,
    setOpen,
    openDialog,
    values,
    setValues,
    updateField,
    loading,
    setLoading,
    error,
    setError,
    success,
    setSuccess,
    reset,
    close,
    handleOpenChange,
  };
}

// =============================================================================
// Async Form Dialog Hook
// =============================================================================

export interface UseAsyncFormDialogOptions<T, R = void> {
  /** Initial values for the form */
  initialValues: T;
  /** Submit handler - receives form values, returns result */
  onSubmit: (values: T) => Promise<R>;
  /** Called after successful submission */
  onSuccess?: (result: R) => void;
  /** Auto-close delay in ms after success (0 to disable) */
  autoCloseDelay?: number;
}

export interface UseAsyncFormDialogReturn<T, R> extends Omit<UseFormDialogReturn<T>, 'setLoading'> {
  /** Submit the form */
  submit: () => Promise<R | undefined>;
  /** Last successful result */
  result: R | undefined;
}

/**
 * Hook for async form dialogs with built-in submission handling
 *
 * Extends useFormDialog with automatic:
 * - Loading state management
 * - Error handling
 * - Success handling with optional auto-close
 *
 * @example
 * ```tsx
 * const dialog = useAsyncFormDialog({
 *   initialValues: { email: "" },
 *   onSubmit: async (values) => {
 *     const res = await fetch("/api/users", {
 *       method: "POST",
 *       body: JSON.stringify(values),
 *     });
 *     if (!res.ok) throw new Error("Failed");
 *     return res.json();
 *   },
 *   onSuccess: () => refreshUsers(),
 *   autoCloseDelay: 1500,
 * });
 *
 * return (
 *   <form onSubmit={(e) => { e.preventDefault(); dialog.submit(); }}>
 *     <Input
 *       value={dialog.values.email}
 *       onChange={(e) => dialog.updateField("email", e.target.value)}
 *     />
 *     <Button disabled={dialog.loading}>Submit</Button>
 *   </form>
 * );
 * ```
 */
export function useAsyncFormDialog<T extends Record<string, unknown>, R = void>(
  options: UseAsyncFormDialogOptions<T, R>
): UseAsyncFormDialogReturn<T, R> {
  const { initialValues, onSubmit, onSuccess, autoCloseDelay = 1500 } = options;

  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<T>(initialValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [result, setResult] = useState<R | undefined>(undefined);

  const reset = useCallback(() => {
    setValues(initialValues);
    setError(null);
    setSuccess(null);
    setLoading(false);
    setResult(undefined);
  }, [initialValues]);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  const openDialog = useCallback(() => {
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      close();
    } else {
      setOpen(true);
    }
  }, [close]);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const submit = useCallback(async (): Promise<R | undefined> => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await onSubmit(values);
      setResult(res);
      setSuccess("Success!");
      onSuccess?.(res);

      if (autoCloseDelay > 0) {
        setTimeout(() => close(), autoCloseDelay);
      }

      return res;
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [values, onSubmit, onSuccess, autoCloseDelay, close]);

  return {
    open,
    setOpen,
    openDialog,
    values,
    setValues,
    updateField,
    loading,
    error,
    setError,
    success,
    setSuccess,
    reset,
    close,
    handleOpenChange,
    submit,
    result,
  };
}
