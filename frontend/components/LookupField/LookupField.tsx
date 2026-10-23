"use client"

import { useId, useState } from 'react';
import { Skeleton } from '../Skeleton/Skeleton';
import styles from './LookupField.module.css';

export interface LookupResult {
  id: string;
  label: string;
  /** Supplied supporting text, for example a site or an identifier. */
  detail?: string;
}

export interface LookupFieldProps {
  /** id of the visible label, set by FormField. Placeholder is never the label. */
  id: string;
  /** Controlled: the composing layer owns the query. After a selection it normally supplies the chosen label here. */
  query: string;
  /** `query-change`: the current query text. Timing, cancellation and stale-response handling are owned OUTSIDE this
   *  component (BRD 1.2 5.7.1 Feature 2B). */
  onQueryChange: (query: string) => void;
  /** SUPPLIED in order. The field renders it and never ranks, filters or resolves results for correctness. */
  results: readonly LookupResult[];
  /** Data dimension, supplied. */
  data: 'idle' | 'loading' | 'ready' | 'empty';
  /** Supplied text. `emptyMessage` explains why there are no results; `loadingMessage` and `resultsMessage` are announced. */
  emptyMessage: string;
  loadingMessage: string;
  /** Optional supplied announcement for a delivered result set (for example "3 results"). Never computed here. */
  resultsMessage?: string;
  /** `result-select`: emitted upward. The field keeps no authoritative copy of the selection. */
  onSelect: (id: string) => void;
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

// Searches and selects a record rather than manual entry (BRD 1.2 5.7). An ARIA combobox: the input keeps focus and the list
// is driven with aria-activedescendant. The open list and the highlighted option are presentation state only.
export function LookupField({ id, query, onQueryChange, results, data, emptyMessage, loadingMessage, resultsMessage, onSelect, disabled, onFocus, onBlur }: LookupFieldProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const showList = open && data !== 'idle';
  const optionId = (index: number) => `${listId}-option-${index}`;

  const choose = (index: number) => {
    const result = results[index];
    if (!result) return;
    onSelect(result.id);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div className={styles.wrap}>
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
        className={`${styles.input} type-body`}
        value={query}
        disabled={disabled}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => {
          setOpen(true);
          onFocus?.();
        }}
        onBlur={() => {
          setOpen(false);
          onBlur?.();
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActive((i) => (results.length === 0 ? -1 : (i + 1) % results.length));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            setActive((i) => (results.length === 0 ? -1 : i <= 0 ? results.length - 1 : i - 1));
          } else if (event.key === 'Enter' && showList && active >= 0) {
            event.preventDefault();
            choose(active);
          } else if (event.key === 'Escape' && showList) {
            event.preventDefault();
            setOpen(false);
          }
        }}
      />
      <div className="visually-hidden" role="status">
        {data === 'loading' ? loadingMessage : data === 'empty' ? emptyMessage : resultsMessage}
      </div>
      {showList && (
        <div className={styles.popup}>
          {data === 'loading' && (
            <div className={styles.loading} aria-hidden="true">
              <Skeleton shape="body" />
              <Skeleton shape="body-short" />
            </div>
          )}
          {data === 'empty' && <p className={`${styles.empty} type-body-sm`}>{emptyMessage}</p>}
          <ul id={listId} role="listbox" className={styles.list} hidden={data !== 'ready'}>
            {results.map((result, index) => (
              <li
                key={result.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                className={styles.option}
                data-active={index === active || undefined}
                // mousedown, not click: the input must not blur (and close the list) before the choice lands.
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(index);
                }}
              >
                <span className="type-body">{result.label}</span>
                {result.detail && <span className={`${styles.detail} type-body-sm`}>{result.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
