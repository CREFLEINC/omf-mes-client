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

  adapterRef.current ??= scanner ?? createKeyboardWedgeScanner();

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const focus = useCallback(() => {
    fieldRef.current?.focus();
  }, []);

  /*
   * 포커스가 스캔 필드를 벗어나면 스캐너가 밀어 넣는 입력이 유실되므로 되돌린다.
   * 다만 다른 컨트롤로 옮겨 간 것은 되돌리지 않는다 — 무조건 되돌리면 Tab 과
   * 보조 기술이 화면의 버튼에 닿지 못하고, 직접 입력 대체 경로가 사라진다.
   */
  const handleBlur = useCallback((event: FocusEvent) => {
    if (document.hidden || event.relatedTarget !== null) {
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
