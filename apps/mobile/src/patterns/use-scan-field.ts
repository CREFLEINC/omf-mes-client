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
   * 포커스가 갈 곳 없이 빠지면 스캐너가 밀어 넣는 입력이 유실되므로 되돌린다.
   * 다른 컨트롤로 옮겨 간 포커스는 그대로 둔다.
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

      /*
       * 이 칸은 스캐너가 밀어 넣는 자리다. 포커스를 잡고 있어야 입력을 받지만, 그 포커스에
       * 소프트 키보드가 딸려 오면 화면 절반이 덮여 목록도 버튼도 가린다. 손으로 넣는 길은
       * 화면마다 따로 둔다.
       */
      node.inputMode = 'none';
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
