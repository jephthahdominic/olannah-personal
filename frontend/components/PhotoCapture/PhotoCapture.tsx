"use client"
import { useRef } from 'react';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import styles from './PhotoCapture.module.css';

export interface CapturedPhoto {
  id: string;
  /** Supplied preview address (for example a blob URL the composing layer made). Rendered, never fetched or stored here. */
  previewUrl: string;
  /** Supplied accessible description of the photo. */
  label: string;
}

export interface PhotoCaptureProps {
  /** Supplied prompt text, for example "Photograph the data plate". */
  prompt: string;
  /** Supplied outcome-named label for the capture button. */
  captureLabel: string;
  /** Supplied text shown when the photo is required (for example "Required"). Shown only when `required` is true. */
  requiredLabel: string;
  required?: boolean;
  /** SUPPLIED references to photos already captured. The prompt renders them and owns no capture or upload session. */
  captured: readonly CapturedPhoto[];
  emptyMessage: string;
  disabled?: boolean;
  /** `capture-request`: the worker asked to capture. */
  onCaptureRequest?: () => void;
  /** `capture-complete`: the device returned image files. They are handed upward untouched and are not stored here. The
   *  canvas (or a future CaptureSession surface) owns camera, upload and retry state (BRD 1.2 5.7.1 Feature 7). */
  onCaptureComplete: (files: readonly File[]) => void;
}

// An entry point to the device capture surface (BRD 1.2 5.7). Watchlist component: it holds no capture session.
export function PhotoCapture({ prompt, captureLabel, requiredLabel, required = false, captured, emptyMessage, disabled, onCaptureRequest, onCaptureComplete }: PhotoCaptureProps) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <div className={styles.box}>
      <div className={styles.heading}>
        <Icon name="camera" size="md" />
        <p className="type-heading-sm">{prompt}</p>
        {required && <span className={`${styles.required} type-caption`}>{requiredLabel}</span>}
      </div>
      {captured.length === 0 ? (
        <p className={`${styles.empty} type-body-sm`}>{emptyMessage}</p>
      ) : (
        <ul className={styles.thumbs}>
          {captured.map((photo) => (
            <li key={photo.id}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a supplied local preview, not a remote asset */}
              <img className={styles.thumb} src={photo.previewUrl} alt={photo.label} />
            </li>
          ))}
        </ul>
      )}
      <Button
        label={captureLabel}
        variant="ghost"
        disabled={disabled}
        leading={<Icon name="camera" size="md" />}
        onActivate={() => {
          onCaptureRequest?.();
          picker.current?.click();
        }}
      />
      <input
        ref={picker}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length > 0) onCaptureComplete(files);
        }}
      />
    </div>
  );
}
