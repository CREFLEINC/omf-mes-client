import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { IqcSkipPane } from './skip-pane';

/** W-01-01 IQC 생략 구획(omf-all-around#212) — 요청 → 결재 → 실행. OQC·PQC 생략 구획과 같은 모양이다. */

const t = messages.iqcInspection.skip;

const approval = (statusCode: string) => ({
  approvalRequestId: 91,
  approvalRequestNo: 'AP-20261029-0009',
  approvalTypeCode: 'IQC_SKIP',
  requestedBy: 5,
  requestedByName: '검사자',
  requestedAt: '2026-10-29T01:00:00Z',
  statusCode,
  reason: '긴급 투입',
  target: { targetTypeCode: 'INBOUND_LOT', targetId: 27, displayName: 'LOT', openable: false },
  currentStepNo: null,
  totalStepNo: 1,
});

const renderPane = (
  latest: string | null,
  options: { workerNo?: string | null; status?: string; basis?: string | null } = {},
) => {
  const writes: Request[] = [];
  const reads: URL[] = [];
  const stubFetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    if (url.pathname === '/app/approval-requests') {
      reads.push(url);
      const items = latest === null ? [] : [approval(latest)];
      return jsonResponse({ items, page: { page: 1, size: 20, total: items.length } });
    }
    if (url.pathname === '/trace/lots/27:request-iqc-skip') {
      writes.push(request.clone());
      return jsonResponse({ approvalRequestId: 91 }, { status: 202 });
    }
    if (url.pathname === '/trace/lots/27:skip-iqc') {
      writes.push(request.clone());
      return jsonResponse({ lotId: 27 });
    }
    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
  };
  renderWithProviders(
    <IqcSkipPane
      lotId={27}
      requestStatusCode={options.status ?? 'REQUESTED'}
      skipBasisCode={options.basis ?? null}
      workerNo={options.workerNo === undefined ? '901463' : options.workerNo}
    />,
    { fetch: stubFetch },
  );
  return { writes, reads };
};

describe('IQC 생략 구획', () => {
  it('자기 LOT 의 IQC_SKIP 결재를 찾는다', async () => {
    const { reads } = renderPane(null);
    await screen.findByRole('button', { name: t.openRequest });

    expect(reads[0]?.searchParams.get('approvalTypeCode')).toBe('IQC_SKIP');
    expect(reads[0]?.searchParams.get('targetTypeCode')).toBe('INBOUND_LOT');
    expect(reads[0]?.searchParams.get('targetId')).toBe('27');
  });

  it('사유를 받아 계정 작업자 사번과 함께 생략을 요청한다', async () => {
    const user = userEvent.setup();
    const { writes } = renderPane(null);
    await user.click(await screen.findByRole('button', { name: t.openRequest }));
    await user.type(screen.getByLabelText(t.reason), '긴급 투입');
    await user.click(screen.getByRole('button', { name: t.request }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(new URL(writes[0]!.url).pathname).toBe('/trace/lots/27:request-iqc-skip');
    expect(writes[0]!.headers.get('X-Worker-No')).toBe('901463');
    expect(await writes[0]!.json()).toEqual({ reason: '긴급 투입' });
  });

  it('계정에 작업자가 없으면 요청 단추 대신 안내가 선다', async () => {
    renderPane(null, { workerNo: null });
    expect(await screen.findByText(t.workerNotLinked)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.openRequest })).not.toBeInTheDocument();
  });

  it('승인되면 실행 단추가 서고 누르면 LOT 생략을 실행한다', async () => {
    const user = userEvent.setup();
    const { writes } = renderPane('APPROVED');
    await user.click(await screen.findByRole('button', { name: t.execute }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(new URL(writes[0]!.url).pathname).toBe('/trace/lots/27:skip-iqc');
  });

  it('기본 생략으로 만들어진 의뢰는 「기본 설정」 생략이라고 말한다', async () => {
    renderPane(null, { status: 'SKIPPED', basis: 'DEFAULT' });
    expect(await screen.findByText(t.skippedDefault)).toBeInTheDocument();
  });
});
