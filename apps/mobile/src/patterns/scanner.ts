export type ScannerStatus = 'ready' | 'error';

export interface ScannerAdapter {
  getStatus(): ScannerStatus;
  onStatusChange(listener: (status: ScannerStatus) => void): () => void;
  attach(field: HTMLInputElement, onScan: (value: string) => void): () => void;
}

const SCAN_TERMINATOR = 'Enter';

export const createKeyboardWedgeScanner = (): ScannerAdapter => ({
  // 스캔값을 키보드 입력처럼 흘려보내는 단말은 일반 키보드와 구별되지 않아,
  // 앱에서 스캐너 모듈의 건강 상태를 관찰할 수단이 없다. 그래서 항상 준비됨이다.
  getStatus: () => 'ready',
  onStatusChange: () => () => {},

  attach: (field, onScan) => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== SCAN_TERMINATOR) {
        return;
      }

      // 스캔 종료 문자가 폼 제출까지 일으키면 화면이 두 번 반응한다.
      event.preventDefault();

      const value = field.value.trim();
      field.value = '';

      if (value !== '') {
        onScan(value);
      }
    };

    field.addEventListener('keydown', handleKeyDown);
    return () => {
      field.removeEventListener('keydown', handleKeyDown);
    };
  },
});
