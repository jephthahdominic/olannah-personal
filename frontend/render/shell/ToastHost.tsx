'use client';

import { createPortal } from 'react-dom';
import { Toast } from '@/components';
import { toastStore, useToasts } from '@/runtime/toasts';
import { messages } from '../messages';

export function ToastHost({ target, durationMs }: { target: HTMLElement | null; durationMs?: number }) {
  const toasts = useToasts();
  if (!target || toasts.length === 0) return null;
  return createPortal(
    toasts.map((t) => (
      <Toast key={t.id} message={t.message} tone={t.tone} durationMs={durationMs} dismissLabel={messages.shell.toastDismiss} onDismiss={() => toastStore.dismiss(t.id)} />
    )),
    target,
  );
}
