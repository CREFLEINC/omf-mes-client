import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useScanField } from './use-scan-field';

const Field = () => {
  const scanField = useScanField({ onScan: () => undefined });

  return <input ref={scanField.ref} aria-label="스캔" />;
};

describe('스캔 칸의 입력 수단', () => {
  /*
   * 포커스를 잡고 있어야 스캐너 입력을 받지만, 그 포커스에 소프트 키보드가 딸려 오면 화면
   * 절반이 덮여 목록도 버튼도 가린다. 손으로 넣는 길은 화면마다 따로 둔다.
   */
  it('소프트 키보드를 부르지 않는다', () => {
    render(<Field />);

    expect(screen.getByLabelText('스캔').inputMode).toBe('none');
  });
});
