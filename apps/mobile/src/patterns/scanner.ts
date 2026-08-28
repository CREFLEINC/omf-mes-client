export type ScannerStatus = 'ready' | 'error';

export interface ScannerAdapter {
  getStatus(): ScannerStatus;
  onStatusChange(listener: (status: ScannerStatus) => void): () => void;
  /**
   * 스캔 한 건이 끝나면 onScan 을 부른다.
   *
   * 종료 문자를 붙이지 않는 단말에서는 입력이 멎는 것으로 경계를 찾으므로, 읽는 도중
   * 끊기면 잘린 값이 올 수 있다. 소비하는 화면이 형식을 반드시 검증한다.
   */
  attach(field: HTMLInputElement, onScan: (value: string) => void): () => void;
}

export interface ScannerTiming {
  /** 입력당 평균 간격이 이보다 짧으면 사람 손이 아니다. 단말의 문자 간 지연 설정에 맞춘다. */
  burstAvgGapMs?: number;
  /** 이만큼 조용하면 한 건이 끝난 것으로 본다. */
  quietMs?: number;
  /** 이만큼 벌어지면 앞뒤 입력이 서로 무관한 것으로 본다. */
  sessionBreakMs?: number;
}

const SCAN_TERMINATOR = 'Enter';

const DEFAULT_BURST_AVG_GAP_MS = 60;
const DEFAULT_QUIET_MS = 100;

/*
 * 사람이 칸을 잠시 두었다 이어 치는 정도로는 끊기지 않을 만큼 넉넉해야 한다. 짧게 잡으면
 * 손으로 치다 쉰 구간이 새 세션이 되어, 그 뒤 몇 글자가 빠르면 스캔으로 오인된다.
 */
const DEFAULT_SESSION_BREAK_MS = 1000;

/** 입력 둘로는 속도를 말할 수 없다. 간격이 최소 둘은 있어야 평균이 뜻을 갖는다. */
const MIN_BURST_EVENTS = 3;

/*
 * 스캔값을 붙여넣기로 밀어 넣는 단말이 쓰는 입력 유형. 사람이 손으로 붙여넣는 것도 같은
 * 유형이지만 스캔 칸에 붙여넣을 값은 스캔값 말고 없다. 유형을 읽을 수 없거나 여기 없는
 * 다중 삽입은 스캔으로 보지 않는다 — 사건 하나에는 간격이 없어 속도로도 잴 수 없다.
 */
const BULK_INPUT_TYPES = new Set(['insertFromPaste', 'insertFromDrop']);

export const createKeyboardWedgeScanner = (timing: ScannerTiming = {}): ScannerAdapter => {
  const burstAvgGapMs = timing.burstAvgGapMs ?? DEFAULT_BURST_AVG_GAP_MS;
  const quietMs = timing.quietMs ?? DEFAULT_QUIET_MS;
  const sessionBreakMs = timing.sessionBreakMs ?? DEFAULT_SESSION_BREAK_MS;

  return {
    // 스캔값을 키보드 입력처럼 흘려보내는 단말은 일반 키보드와 구별되지 않아,
    // 앱에서 스캐너 모듈의 건강 상태를 관찰할 수단이 없다. 그래서 항상 준비됨이다.
    getStatus: () => 'ready',
    onStatusChange: () => () => {},

    attach: (field, onScan) => {
      let firstInputAt = 0;
      let lastInputAt = 0;
      let inputEvents = 0;
      let bulkInsert = false;
      let heldKey = false;
      let previousLength = field.value.length;
      let quietTimer: ReturnType<typeof setTimeout> | undefined;

      const startSession = () => {
        firstInputAt = 0;
        inputEvents = 0;
        bulkInsert = false;
        heldKey = false;
      };

      const forget = () => {
        clearTimeout(quietTimer);
        quietTimer = undefined;
        lastInputAt = 0;
        startSession();
        previousLength = field.value.length;
      };

      const submit = () => {
        const value = field.value.trim();
        field.value = '';
        forget();

        if (value !== '') {
          onScan(value);
        }
      };

      /*
       * 한 세션의 평균 간격으로 판정한다. 중간에 한 번 늦는 것은 평균을 거의 움직이지
       * 않고, 천천히 시작한 입력은 평균이 높아 사람 손으로 남는다.
       */
      const looksLikeScan = (): boolean => {
        if (heldKey) {
          return false;
        }

        if (bulkInsert) {
          return true;
        }

        if (inputEvents < MIN_BURST_EVENTS) {
          return false;
        }

        return (lastInputAt - firstInputAt) / (inputEvents - 1) <= burstAvgGapMs;
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.repeat) {
          heldKey = true;
        }

        if (event.key !== SCAN_TERMINATOR) {
          return;
        }

        // 스캔 종료 문자가 폼 제출까지 일으키면 화면이 두 번 반응한다.
        event.preventDefault();
        submit();
      };

      const handleInput = (event: Event) => {
        const now = Date.now();
        const added = field.value.length - previousLength;
        previousLength = field.value.length;

        // 지우는 것은 손으로 고치는 중이다. 판정을 접고 대기도 걸지 않는다.
        if (added <= 0) {
          forget();
          return;
        }

        if (lastInputAt !== 0 && now - lastInputAt > sessionBreakMs) {
          startSession();
        }

        if (firstInputAt === 0) {
          firstInputAt = now;
        }

        inputEvents += 1;

        if (added > 1) {
          const inputType = event instanceof InputEvent ? event.inputType : '';
          bulkInsert = bulkInsert || BULK_INPUT_TYPES.has(inputType);
        }

        lastInputAt = now;
        clearTimeout(quietTimer);
        quietTimer = setTimeout(() => {
          if (looksLikeScan()) {
            submit();
          }
        }, quietMs);
      };

      field.addEventListener('keydown', handleKeyDown);
      field.addEventListener('input', handleInput);

      return () => {
        clearTimeout(quietTimer);
        field.removeEventListener('keydown', handleKeyDown);
        field.removeEventListener('input', handleInput);
      };
    },
  };
};
