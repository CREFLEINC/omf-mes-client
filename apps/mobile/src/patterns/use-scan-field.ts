import { useCallback, useEffect, useRef, useState } from 'react';

import { createKeyboardWedgeScanner, type ScannerAdapter } from './scanner';

export interface UseScanFieldOptions {
  onScan: (value: string) => void;
  scanner?: ScannerAdapter;
}

export interface ScanField {
  ref: (node: HTMLInputElement | null) => void;
  focus: () => void;
  /** 손으로 칠 수 있는 상태인가. */
  manual: boolean;
  /** 칸을 손 입력으로 연다. 소프트 키보드가 뜬다. */
  openManual: () => void;
  /** 칸에 적힌 것을 스캔값과 같은 길로 넘긴다. */
  submitManual: () => void;
}

export const useScanField = ({ onScan, scanner }: UseScanFieldOptions): ScanField => {
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const [manual, setManual] = useState(false);
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
   * 손으로 칠 때만 소프트 키보드를 연다. 스캔을 기다리는 동안 키보드가 떠 있으면 화면
   * 절반이 덮여 목록도 단추도 가린다.
   */
  const setKeyboard = useCallback((on: boolean) => {
    if (fieldRef.current !== null) {
      fieldRef.current.inputMode = on ? 'text' : 'none';
    }
  }, []);

  const openManual = useCallback(() => {
    setManual(true);
    setKeyboard(true);
    fieldRef.current?.focus();
  }, [setKeyboard]);

  const submitManual = useCallback(() => {
    const value = fieldRef.current?.value.trim() ?? '';

    if (fieldRef.current !== null) {
      fieldRef.current.value = '';
      /*
       * 비웠다는 것을 어댑터에도 알린다. 모르면 다음 스캔의 첫 글자를 지우기로 읽어 세지
       * 않고, 종료 문자가 없는 단말에서 짧은 스캔이 판정 기준에 못 미친다.
       */
      fieldRef.current.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }),
      );
    }

    setManual(false);
    setKeyboard(false);

    if (value !== '') {
      onScanRef.current(value);
    }
  }, [setKeyboard]);

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
          /* 스캔이 들어오면 손으로 치던 것은 접는다. 실물을 읽은 값이 이긴다. */
          setManual(false);
          node.inputMode = 'none';
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

  return { ref, focus, manual, openManual, submitManual };
};
