import { messages } from '@omf-mes/i18n';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSearchParams } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';

import { IssueLookupField } from './issue-lookup-field';

/**
 * 셸 [화면 이동]으로 들어온 작업자가 **전표를 고를 자리**(ISSUE-QR-01 U3).
 *
 * ⛔ **비슷한 번호를 화면이 대신 고르지 않는다.** 계약에 정확 일치 축이 없어 부분 검색으로 묻는데,
 *    그 결과에서 아무거나 고르면 **되돌릴 수 없는 발행이 작업자가 고르지 않은 전표에 남는다.**
 */

const t = messages.goodsIssueQr.entry.lookup;

const ISSUE_NO = 'GI-20260916-0001';

const issue = (goodsIssueId: number, goodsIssueNo: string) => ({
  goodsIssueId,
  goodsIssueNo,
  issueTypeCode: 'PRODUCTION',
  sourceDocumentTypeCode: 'PICKING_ORDER',
  sourceDocumentId: 1,
  sourceWarehouseId: 1,
  issuedAt: '2026-09-16T09:00:00+09:00',
  statusCode: 'POSTED',
});

const listRoute = (items: unknown[], fails = false): StubRoute => ({
  match: (request) => new URL(request.url).pathname === '/logistics/goods-issues',
  respond: () =>
    fails
      ? jsonResponse({ message: '조회 실패' }, { status: 500 })
      : jsonResponse({ items, page: { page: 1, size: 200, total: items.length } }),
});

/** 찾은 전표를 주소에 싣는 것까지 본다 — 화면이 하는 일이 그것이다. */
const Here = () => <p>주소: {useSearchParams()[0].get('goodsIssueId') ?? '없음'}</p>;

const render = (route: StubRoute) => {
  const found: number[] = [];

  renderWithProviders(
    <>
      <IssueLookupField
        onFound={(goodsIssueId) => {
          found.push(goodsIssueId);
        }}
      />
      <Here />
    </>,
    { fetch: createStubFetch([route]), route: '/pop/goods-issue-qr' },
  );

  return found;
};

describe('출고번호로 전표 불러오기', () => {
  it('번호가 똑같은 건을 찾으면 그 전표로 넘긴다', async () => {
    const user = userEvent.setup();
    const found = render(listRoute([issue(7001, ISSUE_NO)]));

    await user.type(screen.getByLabelText(t.label), `${ISSUE_NO}{Enter}`);

    await waitFor(() => {
      expect(found).toEqual([7001]);
    });
  });

  /*
   * ⭐ **스캔 한 번에 조회된다**(omf-all-around#35). 한/영 입력기가 조합 중이면 Enter 가
   *    `key: 'Process'` 로 오고 폼 제출이 되지 않으며, 조합이 끝나며 같은 값의 변경이 한 번 더
   *    온다 — 전에는 그 변경이 방금 낸 조회를 지워 Enter 를 한 번 더 쳐야 했다.
   */
  it('입력기 조합 중의 Enter 한 번으로 조회하고, 뒤따르는 같은 값 변경이 조회를 지우지 않는다', async () => {
    const found = render(listRoute([issue(7004, ISSUE_NO)]));
    const field = screen.getByLabelText(t.label);

    fireEvent.change(field, { target: { value: ISSUE_NO } });
    fireEvent.keyDown(field, { key: 'Process', code: 'Enter', keyCode: 229 });
    fireEvent.change(field, { target: { value: `${ISSUE_NO} ` } });

    await waitFor(() => {
      expect(found).toEqual([7004]);
    });
  });

  /* ⭐ 끝에 Enter 를 붙이지 않는 스캐너 — 스캐너 속도로 들어온 글자가 멈추면 묻는다. */
  it('Enter 없이 스캐너 속도로 들어온 번호도 멈추면 바로 조회한다', async () => {
    const found = render(listRoute([issue(7005, ISSUE_NO)]));
    const field = screen.getByLabelText(t.label);

    for (let length = 1; length <= ISSUE_NO.length; length += 1) {
      fireEvent.change(field, { target: { value: ISSUE_NO.slice(0, length) } });
    }

    await waitFor(() => {
      expect(found).toEqual([7005]);
    });
  });

  /* ⭐ 끝에 Tab 을 붙이는 스캐너 — 포커스가 단추로 넘어가지 않고 바로 묻는다. */
  it('스캔 끝의 Tab 은 조회로 받는다', async () => {
    const found = render(listRoute([issue(7006, ISSUE_NO)]));
    const field = screen.getByLabelText(t.label);

    for (let length = 1; length <= ISSUE_NO.length; length += 1) {
      fireEvent.change(field, { target: { value: ISSUE_NO.slice(0, length) } });
    }
    fireEvent.keyDown(field, { key: 'Tab', code: 'Tab' });

    await waitFor(() => {
      expect(found).toEqual([7006]);
    });
  });

  /* 사람이 천천히 친 값은 멈춰도 묻지 않는다 — Enter·단추로만. */
  it('사람 속도로 친 값은 멈춰도 저절로 조회하지 않는다', async () => {
    const user = userEvent.setup({ delay: 100 });
    const found = render(listRoute([issue(7007, 'GI-1')]));

    await user.type(screen.getByLabelText(t.label), 'GI-1');
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(found).toEqual([]);
  });

  /*
   * ⛔ **부분 일치는 일치가 아니다.** 부분 검색이 비슷한 번호를 함께 물어 오는데, 그중에 똑같은
   *    번호가 없으면 **없는 것이다.** 하나를 골라 넘기면 남의 전표에 발행 기록이 남는다.
   */
  it('비슷한 번호만 있으면 고르지 않고 못 찾았다고 말한다', async () => {
    const user = userEvent.setup();
    const found = render(
      listRoute([issue(7002, `${ISSUE_NO}-9`), issue(7003, 'GI-20260916-0002')]),
    );

    await user.type(screen.getByLabelText(t.label), `${ISSUE_NO}{Enter}`);

    expect(await screen.findByText(t.notFound)).toBeInTheDocument();
    expect(found).toEqual([]);
  });

  it('조회가 실패하면 못 찾았다고 말하지 않는다 — 다른 사실이다', async () => {
    const user = userEvent.setup();
    const found = render(listRoute([], true));

    await user.type(screen.getByLabelText(t.label), `${ISSUE_NO}{Enter}`);

    expect(await screen.findByText(t.failed)).toBeInTheDocument();
    expect(screen.queryByText(t.notFound)).not.toBeInTheDocument();
    expect(found).toEqual([]);
  });

  /* ⛔ 빈 값으로 묻지 않는다 — 부분 검색이라 전체 목록을 받아 온다. */
  it('빈 값으로는 조회하지 않는다', async () => {
    const user = userEvent.setup();
    const requests: string[] = [];

    renderWithProviders(<IssueLookupField onFound={() => undefined} />, {
      fetch: createStubFetch([
        {
          match: (request) => {
            requests.push(new URL(request.url).pathname);

            return true;
          },
          respond: () => jsonResponse({ items: [], page: { page: 1, size: 200, total: 0 } }),
        },
      ]),
      route: '/pop/goods-issue-qr',
    });

    await user.click(screen.getByRole('button', { name: t.action }));

    expect(requests).toEqual([]);
  });

  /* 공백만 친 것도 빈 값이다 — 스캐너가 빈 값을 쏘는 일이 있다. */
  it('공백만 쳐도 조회하지 않는다', async () => {
    const user = userEvent.setup();
    const found = render(listRoute([issue(7001, ISSUE_NO)]));

    await user.type(screen.getByLabelText(t.label), '   {Enter}');

    await waitFor(() => {
      expect(found).toEqual([]);
    });
  });
});
