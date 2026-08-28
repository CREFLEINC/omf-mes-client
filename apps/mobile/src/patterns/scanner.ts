export type ScannerStatus = 'ready' | 'error';

export interface ScannerAdapter {
  getStatus(): ScannerStatus;
  onStatusChange(listener: (status: ScannerStatus) => void): () => void;
  attach(field: HTMLInputElement, onScan: (value: string) => void): () => void;
}

const SCAN_TERMINATOR = 'Enter';

/** 이 간격 안에 이어지는 문자는 사람 손이 낼 수 없는 속도다. */
const BURST_GAP_MS = 60;

/** 이만큼 조용하면 한 건이 끝난 것으로 본다. */
const QUIET_MS = 100;

/** 빠른 간격이 이만큼 이어져야 버스트로 본다. 두 글자 우연으로는 서지 않는다. */
const BURST_GAPS = 2;

export const createKeyboardWedgeScanner = (): ScannerAdapter => ({
  // 스캔값을 키보드 입력처럼 흘려보내는 단말은 일반 키보드와 구별되지 않아,
  // 앱에서 스캐너 모듈의 건강 상태를 관찰할 수단이 없다. 그래서 항상 준비됨이다.
  getStatus: () => 'ready',
  onStatusChange: () => () => {},

  attach: (field, onScan) => {
    let lastInputAt = 0;
    let fastGaps = 0;
    let bulkInsert = false;
    let heldKey = false;
    let previousLength = field.value.length;
    let quietTimer: ReturnType<typeof setTimeout> | undefined;

    const reset = () => {
      clearTimeout(quietTimer);
      quietTimer = undefined;
      lastInputAt = 0;
      fastGaps = 0;
      bulkInsert = false;
      heldKey = false;
      previousLength = field.value.length;
    };

    const submit = () => {
      const value = field.value.trim();
      field.value = '';
      reset();

      if (value !== '') {
        onScan(value);
      }
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

    /*
     * 종료 문자를 붙이지 않는 스캐너가 있다. 그런 단말에서는 입력이 도착하는 속도로
     * 한 건의 경계를 찾는다 — 사람 손이 낼 수 없는 간격으로 이어지다 멎으면 스캔이다.
     * 천천히 친 값은 제출하지 않는다. 직접 입력 대체 경로가 살아 있어야 한다.
     */
    const handleInput = () => {
      const now = Date.now();
      const added = field.value.length - previousLength;
      previousLength = field.value.length;

      if (heldKey) {
        fastGaps = 0;
      } else if (added > 1) {
        bulkInsert = true;
      } else if (lastInputAt !== 0 && now - lastInputAt <= BURST_GAP_MS) {
        fastGaps += 1;
      } else {
        fastGaps = 0;
      }

      heldKey = false;
      lastInputAt = now;
      clearTimeout(quietTimer);

      if (field.value === '') {
        return;
      }

      quietTimer = setTimeout(() => {
        if (bulkInsert || fastGaps >= BURST_GAPS) {
          submit();
        }
      }, QUIET_MS);
    };

    field.addEventListener('keydown', handleKeyDown);
    field.addEventListener('input', handleInput);

    return () => {
      clearTimeout(quietTimer);
      field.removeEventListener('keydown', handleKeyDown);
      field.removeEventListener('input', handleInput);
    };
  },
});
