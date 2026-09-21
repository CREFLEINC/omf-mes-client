import { useEffect, useRef, type KeyboardEvent } from 'react';

/**
 * 스캐너로 읽은 값을 **한 번에** 보낸다 — POP 스캔 칸이 함께 쓴다(omf-all-around#35).
 *
 * ⭐ **왜 Enter 만 믿지 않는가.** 실기에서 스캔하고도 Enter 를 한 번 더 쳐야 조회가 나갔다.
 *    스캐너 설정에 따라 값 끝에 Enter 를 붙이지 않거나 Tab 을 붙이고(Tab 이면 포커스가 옆 단추로
 *    넘어간다), 한/영 입력기가 조합 중이면 Enter 가 `key: 'Process'` 로 와 폼 제출이 되지 않는다.
 *    그래서 셋을 모두 받는다.
 *    - Enter — 물리 키(`code`)로도 가른다. 칸의 **지금 값**(`input.value`)으로 보낸다
 *    - 스캔 직후의 Tab — 조회로 받고 포커스를 붙든다
 *    - 스캐너 속도로 몰려 들어온 글자가 멈추면 — Enter 없이 보낸다
 *
 * ⛔ **사람이 친 값은 저절로 보내지 않는다.** 사람은 글자 사이가 80ms 를 넘는다 — 그 값은
 *    지금처럼 Enter·단추로만 나간다.
 */

/** 글자 사이가 이 안쪽이면 사람이 친 것이 아니다. */
const SCAN_KEY_INTERVAL_MS = 40;
/** 이렇게 빠른 글자가 이만큼 이어지면 스캔이다. */
const SCAN_MIN_CHARS = 5;
/** 스캔 글자가 멈추고 이만큼 조용하면 끝난 것으로 보고 보낸다. */
const SCAN_IDLE_MS = 150;

export interface ScannerSubmit {
  /** 칸의 `onKeyDown` 에 건다. */
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** 칸의 `onChange` 안에서 부른다 — 글자 속도를 재고 멈춤을 기다린다. */
  noteInput: () => void;
  /** 단추·폼 제출로 보낼 때 — 기다리던 자동 전송을 거둔다. */
  submit: (value: string) => void;
}

/**
 * @param send 보낼 값을 받는다. 빈 값·진행 중 거르기는 부르는 쪽이 한다.
 * @param readValue 자동 전송 때 칸의 지금 값을 읽는다(보통 `ref.current?.value`).
 */
export const useScannerSubmit = (
  send: (value: string) => void,
  readValue: () => string,
): ScannerSubmit => {
  const lastInputAt = useRef(0);
  const burst = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* 타이머가 낡은 처리기를 부르지 않게 최신 것을 쥔다. */
  const latest = useRef({ send, readValue });
  latest.current = { send, readValue };

  const cancel = (): void => {
    if (idleTimer.current !== null) clearTimeout(idleTimer.current);
    idleTimer.current = null;
  };

  useEffect(() => cancel, []);

  const submit = (value: string): void => {
    cancel();
    burst.current = 0;
    latest.current.send(value);
  };

  return {
    onKeyDown: (event) => {
      const isEnter =
        event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter';
      const isScanTab =
        event.key === 'Tab' &&
        burst.current >= SCAN_MIN_CHARS &&
        Date.now() - lastInputAt.current <= SCAN_IDLE_MS;

      if (!isEnter && !isScanTab) return;

      /* 폼 제출·포커스 이동을 막는다 — 여기서 이미 보냈다. */
      event.preventDefault();
      submit(event.currentTarget.value);
    },
    noteInput: () => {
      const now = Date.now();

      burst.current = now - lastInputAt.current <= SCAN_KEY_INTERVAL_MS ? burst.current + 1 : 1;
      lastInputAt.current = now;

      cancel();
      if (burst.current < SCAN_MIN_CHARS) return;

      idleTimer.current = setTimeout(() => {
        submit(latest.current.readValue());
      }, SCAN_IDLE_MS);
    },
    submit,
  };
};
