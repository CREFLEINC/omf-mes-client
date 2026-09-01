import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EMERGENCY_WORK_ORDER, listUrls, renderScreen } from './screen-harness';

const t = messages.emergencyWorkOrderField;

describe('긴급 W/O 조회 조건', () => {
  it('유형과 진행 가능 상태 두 축을 «서버에» 싣는다', async () => {
    const { urls } = renderScreen();

    await screen.findByText(EMERGENCY_WORK_ORDER.workOrderNo);

    const listed = listUrls(urls).at(-1) ?? '';
    const query = new URL(listed, 'http://api.test').searchParams;

    /* 유형만 걸면 완료·마감된 긴급 W/O 까지 실린다 — 두 축을 함께 본다. */
    expect(query.get('workOrderTypeCode')).toBe('EMERGENCY');
    expect(query.get('open')).toBe('true');
  });

  it('유형 값을 모르면 아예 묻지 않는다', async () => {
    const { urls } = renderScreen({ typeCode: '  ' });

    /* 단위 이름표는 나가도 «목록»은 나가지 않아야 한다. */
    await waitFor(() => {
      expect(urls.some((url) => url.startsWith('/mdm/uoms'))).toBe(true);
    });

    expect(listUrls(urls)).toHaveLength(0);
  });

  it('목록을 받지 못하면 「없다」가 아니라 받지 못했다고 말한다', async () => {
    renderScreen({ listStatus: 500 });

    expect(await screen.findByText(t.list.loadError)).toBeInTheDocument();
    expect(screen.queryByText(t.list.empty)).not.toBeInTheDocument();
  });

  it('목록이 잘리면 전체 건수를 알린다', async () => {
    renderScreen({ total: 31 });

    expect(await screen.findByText(t.list.truncated(1, 31))).toBeInTheDocument();
  });
});
