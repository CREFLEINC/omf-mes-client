import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BreakableNo, stageNameOf, stockPlace } from './tree-table';

describe('계보 번호 · 재고 표기', () => {
  it('N1 번호는 「-」「|」 경계에서만 접힐 자리를 둔다(글자 중간에서 꺾지 않음)', () => {
    const { container } = render(
      <span>
        <BreakableNo value="V015-040101-00022S|500|0001" />
      </span>,
    );
    expect(container.textContent).toBe('V015-040101-00022S|500|0001');
    expect(container.innerHTML).toBe(
      '<span>V015-<wbr>040101-<wbr>00022S|<wbr>500|<wbr>0001</span>',
    );
  });

  it('US2-6 공정 반제품 단계는 「반제품 LOT · 공정 10」, 공정이 없으면 단계 이름만', () => {
    expect(stageNameOf('SEMI_LOT', { operationSeq: 10 })).toBe('반제품 LOT · 공정 10');
    expect(stageNameOf('SEMI_LOT', { operationSeq: null })).toBe('반제품 LOT');
    expect(stageNameOf('PRODUCTION_LOT', { operationSeq: 30 })).toBe('생산 LOT');
    expect(stageNameOf('WORK_ORDER', undefined)).toBe('W/O');
  });

  it('재고는 엑셀과 같은 「창고 이름 (코드) / 위치 이름 (코드)」', () => {
    expect(
      stockPlace({ name: '완제품 창고', code: 'WH-P' }, { name: 'A-01-01', code: 'LOC-1' }),
    ).toBe('완제품 창고 (WH-P) / A-01-01 (LOC-1)');
  });
});
