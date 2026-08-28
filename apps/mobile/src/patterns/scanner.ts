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
  /** 문자당 평균 간격이 이보다 짧으면 사람 손이 아니다. 단말의 문자 간 지연 설정에 맞춘다. */
  burstAvgGapMs?: number;
  /** 이만큼 조용하면 한 건이 끝난 것으로 본다. */
  quietMs?: number;
}

const SCAN_TERMINATOR = 'Enter';

const DEFAULT_BURST_AVG_GAP_MS = 60;
const DEFAULT_QUIET_MS = 100;

/** 두 글자로는 속도를 말할 수 없다. 간격이 최소 둘은 있어야 평균이 뜻을 갖는다. */
const MIN_BURST_CHARS = 3;

/** 스캔값을 통째로 밀어 넣는 단말이 쓰는 입력 유형. 자동완성·조합 입력과 가른다. */
const BULK_INPUT_TYPES = new Set(['insertFromPaste', 'insertFromDrop', 'insertText']);

export const createKeyboardWedgeScanner = (timing: ScannerTiming = {}): ScannerAdapter => {
  const burstAvgGapMs = timing.burstAvgGapMs ?? DEFAULT_BURST_AVG_GAP_MS;
  const quietMs = timing.quietMs ?? DEFAULT_QUIET_MS;

  return {
    // 스캔값을 키보드 입력처럼 흘려보내는 단말은 일반 키보드와 구별되지 않아,
    // 앱에서 스캐너 모듈의 건강 상태를 관찰할 수단이 없다. 그래서 항상 준비됨이다.
    getStatus: () => 'ready',
    onStatusChange: () => () => {},

    attach: (field, onScan) => {
      let firstInputAt = 0;
      let lastInputAt = 0;
      let charSteps = 0;
      let bulkInsert = false;
      let heldKey = false;
      let previousLength = field.value.length;
      let quietTimer: ReturnType<typeof setTimeout> | undefined;

      const forget = () => {
        clearTimeout(quietTimer);
        quietTimer = undefined;
        firstInputAt = 0;
        lastInputAt = 0;
        charSteps = 0;
        bulkInsert = false;
        heldKey = false;
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
       * 버스트 전체의 평균 간격으로 판정한다. 꼬리 구간만 보면 마지막 한 글자가 늦게
       * 오는 것만으로 스캔을 놓치고, 그러면 남은 값에 다음 스캔이 이어 붙는다.
       * 반대로 천천히 시작한 입력은 평균이 높아 사람 손으로 남는다.
       */
      const looksLikeScan = (): boolean => {
        if (heldKey) {
          return false;
        }

        if (bulkInsert) {
          return true;
        }

        if (charSteps < MIN_BURST_CHARS) {
          return false;
        }

        return (lastInputAt - firstInputAt) / (charSteps - 1) <= burstAvgGapMs;
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

        if (added > 1) {
          const inputType = event instanceof InputEvent ? event.inputType : '';
          bulkInsert = bulkInsert || BULK_INPUT_TYPES.has(inputType);
        } else {
          if (firstInputAt === 0) {
            firstInputAt = now;
          }
          charSteps += 1;
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
