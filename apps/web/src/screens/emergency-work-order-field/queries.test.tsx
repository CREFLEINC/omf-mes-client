import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EMERGENCY_WORK_ORDER, listUrls, renderScreen } from './screen-harness';

/** 줄 전체가 누를 자리라, 카드의 이름으로 찾는다. */
const selectName = (workOrderNo: string): string =>
  `${messages.emergencyWorkOrderField.list.select} ${workOrderNo}`;

const t = messages.emergencyWorkOrderField;

describe('긴급 W/O 조회 조건', () => {
  it('유형과 진행 가능 상태 두 축을 «서버에» 싣는다', async () => {
    const { urls } = renderScreen();

    await screen.findByRole('button', { name: selectName(EMERGENCY_WORK_ORDER.workOrderNo) });

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

  /* 잘림 문장 대신 목록 아래 쪽 넘김 줄 「총 N건」이 전체 건수를 말한다(POP 통일 시안). */
  it('목록이 잘리면 전체 건수를 알린다', async () => {
    renderScreen({ total: 31 });

    expect(await screen.findByText(messages.popUniform.pager.total(31))).toBeInTheDocument();
  });

  it('한 쪽 건수는 화면이 정한 크기로 묻는다 — 조건은 그대로다', async () => {
    const { urls } = renderScreen();

    await waitFor(() => {
      expect(listUrls(urls)).not.toHaveLength(0);
    });
    const query = new URL(listUrls(urls)[0] ?? '', 'http://x').searchParams;
    expect(query.get('open')).toBe('true');
    expect(Number(query.get('size'))).toBeGreaterThan(0);
  });
});
