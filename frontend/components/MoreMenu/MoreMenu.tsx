'use client';

import { useEffect, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from '../Icon/Icon';
import { NavItem, type NavItemModel } from '../NavItem/NavItem';
import { useFocusReturn } from '../utils/useFocusReturn';
import styles from './MoreMenu.module.css';

export interface MoreAction {
  id: string;
  icon: IconName;
  title: string;
  description: string;
}

export interface MoreMenuProps {
  /** The composing layer owns the authoritative open state; the menu renders it and asks to close (BRD 1.2 5.15.1). */
  open: boolean;
  /** The three fixed actions (Ask Olannah, Feedback, Settings). Never varied by role. */
  actions: readonly MoreAction[];
  /** Role destinations that did not fit in the tab bar, rendered as supplied. */
  overflowDestinations?: readonly NavItemModel[];
  onCloseRequest: () => void;
  onActionSelect: (id: string) => void;
  onDestinationSelect: (id: string) => void;
  /** Portal host at the more-menu layer (z-250). If absent the menu renders in place. */
  portalTarget?: HTMLElement | null;
}

// Mobile-only. Floating actions rise above the tab bar over a dim overlay (Dark Neutral Overlay token, a system-surface
// treatment, not a Surface background). Esc and a tap on the overlay close it. Focus moves to the first item, stays
// inside while open, and returns to the opener on close.
export function MoreMenu({ open, actions, overflowDestinations = [], onCloseRequest, onActionSelect, onDestinationSelect, portalTarget }: MoreMenuProps) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusReturn(open);

  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>('button')?.focus();
  }, [open]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCloseRequest();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = panel.current?.querySelectorAll<HTMLElement>('button');
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const menu = (
    <div className={styles.root} onKeyDown={onKeyDown}>
      <div className={styles.overlay} onClick={onCloseRequest} aria-hidden="true" data-testid="more-overlay" />
      <div className={styles.panel} ref={panel} role="menu">
        {overflowDestinations.length > 0 && (
          <ul className={styles.overflow}>
            {overflowDestinations.map((item) => (
              <li key={item.id}>
                <NavItem {...item} layout="rail" onActivate={onDestinationSelect} />
              </li>
            ))}
          </ul>
        )}
        {actions.map((action) => (
          <button key={action.id} type="button" role="menuitem" className={styles.action} onClick={() => onActionSelect(action.id)}>
            <span className={`${styles.card} `}>
              <span className="type-heading-sm">{action.title}</span>
              <span className={`${styles.desc} type-caption`}>{action.description}</span>
            </span>
            <span className={styles.circle}>
              <Icon name={action.icon} size="md" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  return portalTarget ? createPortal(menu, portalTarget) : menu;
}
