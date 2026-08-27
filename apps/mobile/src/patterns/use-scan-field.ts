import { useCallback, useEffect, useRef } from 'react';

import { createKeyboardWedgeScanner, type ScannerAdapter } from './scanner';

export interface UseScanFieldOptions {
  onScan: (value: string) => void;
  scanner?: ScannerAdapter;
}

export interface ScanField {
  ref: (node: HTMLInputElement | null) => void;
  focus: () => void;
}

export const useScanField = ({ onScan, scanner }: UseScanFieldOptions): ScanField => {
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const detachRef = useRef<(() => void) | null>(null);
  const onScanRef = useRef(onScan);
  const adapterRef = useRef<ScannerAdapter | null>(null);

  onScanRef.current = onScan;
  adapterRef.current ??= scanner ?? createKeyboardWedgeScanner();

  const focus = useCallback(() => {
    fieldRef.current?.focus();
  }, []);

  // 포커스가 스캔 필드를 벗어나면 스캐너가 밀어 넣는 입력이 유실된다.
  const handleBlur = useCallback(() => {
    if (document.hidden) {
      return;
    }
    queueMicrotask(() => {
      if (document.activeElement !== fieldRef.current) {
        fieldRef.current?.focus();
      }
    });
  }, []);

  const ref = useCallback(
    (node: HTMLInputElement | null) => {
      detachRef.current?.();
      detachRef.current = null;
      fieldRef.current?.removeEventListener('blur', handleBlur);
      fieldRef.current = node;

      if (node === null) {
        return;
      }

      node.addEventListener('blur', handleBlur);
      detachRef.current =
        adapterRef.current?.attach(node, (value) => {
          onScanRef.current(value);
        }) ?? null;
      node.focus();
    },
    [handleBlur],
  );

  useEffect(() => {
    return () => {
      detachRef.current?.();
      fieldRef.current?.removeEventListener('blur', handleBlur);
    };
  }, [handleBlur]);

  return { ref, focus };
};
