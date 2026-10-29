import { describe, expect, it } from 'vitest';

import {
  DEFAULT_WORKLIST_FILTERS,
  processPath,
  readWorklistFilters,
  toWorklistSearchParams,
} from './worklist-filters';

describe('작업함 주소 조건', () => {
  it('빈 주소는 기본 조건(조치 필요, 1쪽, 20건)이고 기본값은 주소에 쓰지 않는다', () => {
    expect(readWorklistFilters(new URLSearchParams())).toEqual(DEFAULT_WORKLIST_FILTERS);
    expect(toWorklistSearchParams(DEFAULT_WORKLIST_FILTERS).toString()).toBe('');
  });

  it('바뀐 조건만 주소에 남기고 잘못된 값은 버린다', () => {
    const params = toWorklistSearchParams({
      ...DEFAULT_WORKLIST_FILTERS,
      state: 'RELEASE_PENDING',
      page: 2,
      size: 50,
    });
    expect(params.toString()).toBe('state=RELEASE_PENDING&page=2&size=50');
    expect(readWorklistFilters(new URLSearchParams('state=X&size=7&page=-1&dueFrom=bad'))).toEqual(
      DEFAULT_WORKLIST_FILTERS,
    );
  });

  it('옛 주소의 autoPlan 값도 받는다(옛 W-02-04 주소, 저장해 둔 조건)', () => {
    const stateOf = (query: string) => readWorklistFilters(new URLSearchParams(query)).state;
    expect(stateOf('autoPlan=DONE')).toBe('RELEASE_PENDING');
    expect(stateOf('autoPlan=NEEDS_REVIEW')).toBe('ACTION_REQUIRED');
    expect(stateOf('autoPlan=ALL')).toBe('ALL');
    expect(stateOf('autoPlan=X')).toBe('ACTION_REQUIRED');
    expect(stateOf('state=ALL&autoPlan=DONE')).toBe('ALL');
  });

  it('처리 화면 주소는 업무 번호를 쓴다', () => {
    expect(processPath('UIR-PO-001')).toBe('/production/production-orders/UIR-PO-001');
  });
});
