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

  /*
   * 화면이 다시 보이면 포커스를 되찾는다.
   *
   * 잠금은 웹뷰를 가리고 그동안 칸은 포커스를 잃는다. 가려진 채로 되돌리면 보이지도 않는
   * 화면에 소프트 키보드가 서므로 handleBlur 는 그때 물러선다 - 그 판단은 맞다. 다만 다시
   * 보일 때 되찾는 자리가 없으면 스캐너가 밀어 넣는 입력이 갈 곳을 잃는다. 현장에서는
   * 잠금을 풀면 스캔이 되지 않는 것으로 나타났고, 화면을 늘 켜 두면 증상이 사라졌다.
   *
   * 손으로 치는 중이면 가져오지 않는다 - 치던 자리에서 포커스를 뺏는 것이 된다.
   */
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden || manual) {
        return;
      }
      if (document.activeElement !== fieldRef.current) {
        fieldRef.current?.focus();
      }
    };

    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [manual]);

  /*
   * 포커스가 칸에 없어도 스캔을 받는다.
   *
   * 스캐너는 키보드처럼 글자를 밀어 넣으므로 포커스가 있는 곳으로 간다. 작업자가 단추를
   * 한 번 누르면 포커스가 그리로 옮겨 가고, 그 뒤 스캔한 글자는 단추로 가 사라진다 -
   * 화면에는 아무 일도 일어나지 않아 스캐너가 고장 난 것으로 읽힌다.
   *
   * 첫 글자가 올 때 칸으로 포커스를 되돌리고 그 글자를 칸에 넣는다. 두 번째부터는 칸이
   * 포커스를 쥐고 있으므로 여기를 거치지 않고, 판정도 종전 경로 그대로 돈다.
   *
   * 사람이 치고 있는 칸에서는 가져오지 않는다. 수량이나 비고를 치는 중에 글자를 빼앗으면
   * 적은 값이 어디에도 남지 않는다 - 스캔을 놓치는 것보다 나쁘다.
   */
  useEffect(() => {
    const onDocumentKey = (event: KeyboardEvent) => {
      const field = fieldRef.current;

      if (field === null || manual || event.defaultPrevented) {
        return;
      }

      const active = document.activeElement;

      if (active === field) {
        return;
      }

      /* 사람이 글자를 넣고 있는 자리는 건드리지 않는다. */
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return;
      }

      /* 글자 하나로 오는 키만 옮긴다. Tab·Escape 같은 것은 제자리에 둔다. */
      if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      event.preventDefault();
      field.focus();
      field.value += event.key;
      field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    };

    document.addEventListener('keydown', onDocumentKey, true);

    return () => {
      document.removeEventListener('keydown', onDocumentKey, true);
    };
  }, [manual]);

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
