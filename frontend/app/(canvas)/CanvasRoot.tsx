'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUpstream } from '@/clients/upstream';
import { useBoot } from '@/runtime/boot/useBoot';
import { purgeSession } from '@/runtime/purgeSession';
import { CanvasStage } from './CanvasStage';
import {
  ContextDegradedNotice,
  SessionExpiredScreen,
  SessionLoadingScreen,
  UnknownRoleScreen,
  WorkspaceRecoveryScreen,
} from '@/render/screens';

const LOGIN_PATH = '/login';

async function signOutAndLeave(): Promise<void> {
  // purgeSession() is the only exit path. Then the identity provider session ends and the page navigates, which also
  // discards every in-memory reference.
  await purgeSession();
  await getUpstream().auth.signOut();
  window.location.assign(LOGIN_PATH);
}

export function CanvasRoot() {
  const router = useRouter();
  const { state, config, retry } = useBoot();
  const supportHref = config.support.contactHref;

  // No SSO session: the worker has to sign in.
  useEffect(() => {
    if (state.phase === 'noSession') router.replace(LOGIN_PATH);
  }, [state.phase, router]);

  // Session expired: show the expired screen briefly, then route to sign in automatically.
  useEffect(() => {
    if (state.phase !== 'sessionExpired') return;
    const timer = setTimeout(() => window.location.assign(`${LOGIN_PATH}?reason=expired`), config.session.expiredRedirectMs);
    return () => clearTimeout(timer);
  }, [state.phase, config.session.expiredRedirectMs]);

  switch (state.phase) {
    case 'awaitingSession':
      return <SessionLoadingScreen slow={state.slow} />;
    // While redirecting, keep the loading screen: never a blank page.
    case 'noSession':
      return <SessionLoadingScreen slow={false} />;
    case 'awaitingContext':
      return <SessionLoadingScreen slow={false} />;
    case 'contextDegraded':
      return <ContextDegradedNotice />;
    case 'contextHardTimeout':
    case 'fallbackSchema':
    case 'fallbackMalformed':
      return <WorkspaceRecoveryScreen onRetry={retry} supportHref={supportHref} />;
    case 'fallbackUnknownRole':
      return <UnknownRoleScreen onRetry={retry} supportHref={supportHref} />;
    case 'sessionExpired':
      return <SessionExpiredScreen onLogIn={() => window.location.assign(LOGIN_PATH)} />;
    case 'assembled':
    case 'settled':
      return <CanvasStage context={state.context} layout={state.layout} session={state.session} config={config} signOut={() => void signOutAndLeave()} />;
  }
}
