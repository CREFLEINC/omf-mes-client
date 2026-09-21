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
 * ⛔ **사람이 친 값은 저절로 보내지 않는다.** 사람은 글자 사이가 이 기준보다 느리다 — 그 값은
 *    지금처럼 Enter·단추로만 나간다.
 *
 * ⛔ **글자가 «늘어난» 변경만 센다.** 간격만 세면 백스페이스 길게 누르기(OS 자동반복 ≈ 30ms)가
 *    스캔으로 읽혀, 지우다 만 토막으로 조회가 나간다(리뷰 지적 2026-09-21).
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
  /**
   * 칸의 `onChange` 안에서 **바뀐 값과 함께** 부른다 — 글자 속도를 재고 멈춤을 기다린다.
   * 값이 줄거나 앞이 달라지면(지우기·고쳐 쓰기) 스캔으로 세지 않는다.
   */
  noteInput: (value: string) => void;
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
  /** 직전 값 — 글자가 늘어난 변경만 스캔으로 센다. */
  const previous = useRef('');
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
    previous.current = value;
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
    noteInput: (value) => {
      const now = Date.now();
      const isFast = now - lastInputAt.current <= SCAN_KEY_INTERVAL_MS;
      /* 스캐너는 앞에 이어 붙이기만 한다 — 지우기·중간 고치기는 사람의 손이다. */
      const isGrowing =
        value.length > previous.current.length && value.startsWith(previous.current);

      burst.current = isFast && isGrowing ? burst.current + 1 : isGrowing ? 1 : 0;
      previous.current = value;
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
