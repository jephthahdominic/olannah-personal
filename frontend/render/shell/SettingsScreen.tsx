'use client';

import { Button, KeyValue, SectionHeader } from '@/components';
import { useShell } from '../layout/ShellContext';
import { messages } from '../messages';

// Shell-owned Settings (a universal destination). Account details are supplied by the context object.
export function SettingsScreen() {
  const { worker, signOut } = useShell();
  return (
    <>
      <SectionHeader id="settings-title" text={messages.settings.title} level={2} size="lg" />
      <KeyValue label={messages.settings.name} value={worker.name} />
      <KeyValue label={messages.settings.role} value={worker.role_label} />
      <Button label={messages.workspace.signOut} variant="ghost" onActivate={signOut} />
    </>
  );
}
