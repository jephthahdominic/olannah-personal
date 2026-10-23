'use client';

import type { Ref } from 'react';
import styles from './PortalHosts.module.css';

// One portal host per layer, created by the shell, whose z-index is the layer TOKEN (SDD 9.7). Components render into a
// host by name and never set a z-index. The checkpoint layer is NOT here: it is a sibling of the canvas root, so the blocking scope can make everything else inert (see CheckpointHost).
export interface PortalTargets {
  setMoreMenu: Ref<HTMLDivElement>;
  setToast: Ref<HTMLDivElement>;
  /** The drawer layer (z-300): the assistant panel and the feedback form. */
  setDrawer: Ref<HTMLDivElement>;
}

export function PortalHosts({ setMoreMenu, setToast, setDrawer }: PortalTargets) {
  return (
    <>
      <div className={styles.moreMenu} ref={setMoreMenu} data-portal="more-menu" />
      <div className={styles.drawer} ref={setDrawer} data-portal="drawer" />
      <div className={styles.modal} data-portal="modal" />
      <div className={styles.toast} ref={setToast} data-portal="toast" />
      <div className={styles.onboarding} data-portal="onboarding" />
    </>
  );
}
