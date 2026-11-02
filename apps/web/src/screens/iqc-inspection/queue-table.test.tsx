import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { queueItems } from './fixtures';
import { QueueTable } from './queue-table';
import type { ItemNameLookup, NameLookup } from './reference-lookup';
import { toInspectionQueueRow } from './types';

const t = messages.iqcInspection.queue;
const rows = queueItems.map(toInspectionQueueRow);

/**
 * LOT 번호 풀이. **내부 번호가 아니라 라벨에 찍히는 번호**를 낸다(omf-all-around#40).
 *
 * 번호를 라벨에 섞지 않는다 — 「번호가 남지 않는다」를 재는 단언이 제 꼬리를 물면 안 된다.
 */
const LOT_IDS = [
  ...new Set(rows.map((row) => row.lotId).filter((lotId): lotId is number => lotId !== null)),
];

const LOT_LABELS = new Map<number, string>(
  LOT_IDS.map((lotId, index) => [lotId, `SAMPLE-LOT|${'ABCDEFGH'[index] ?? 'Z'}|CCC`]),
);

const LOT_NO = (lotId: number) => LOT_LABELS.get(lotId) ?? 'SAMPLE-LOT|Z|CCC';

/**
 * 품목 풀이. 첫 칸이 **이름과 코드를 두 줄로** 세운다(사용자 지시 2026-09-21).
 * 번호를 라벨에 섞지 않는다 — 「번호가 남지 않는다」를 재는 단언이 제 꼬리를 물면 안 된다.
 */
const ITEM_NAME = '합성 품목 가';
const ITEM_CODE = 'SAMPLE-ITEM-AA';

const itemNames: ItemNameLookup = {
  labelOf: () => `${ITEM_CODE} · ${ITEM_NAME}`,
  partsOf: () => ({ code: ITEM_CODE, name: ITEM_NAME }),
};

/** 못 푼 갈래 — 줄이 하나뿐이라 풀이가 그 자리에 사유를 낸다. */
const unresolvedItems: ItemNameLookup = {
  labelOf: () => messages.common.reference.failed,
  partsOf: () => null,
};

const lotNumbers: NameLookup = {
  labelOf: (id) => (id === null || id === undefined ? '—' : LOT_NO(id)),
};

const suppliers: NameLookup = {
  labelOf: (id) => (id === null || id === undefined ? '—' : '(주)합성공급'),
};

const renderTable = (overrides: Partial<Parameters<typeof QueueTable>[0]> = {}) => {
  const onSelect = vi.fn();

  renderWithProviders(
    <QueueTable
      rows={rows}
      itemNames={itemNames}
      lotNumbers={lotNumbers}
      suppliers={suppliers}
      selectedId={null}
      onSelect={onSelect}
      empty={<p>{t.empty}</p>}
      {...overrides}
    />,
  );

  return onSelect;
};

const openButton = (inspectionRequestNo: string) =>
  screen.getByRole('button', {
    name: t.openRow(`${ITEM_NAME} ${ITEM_CODE}`, inspectionRequestNo),
  });

describe('QueueTable', () => {
  it('의뢰마다 한 줄을 그린다', () => {
    renderTable();

    expect(screen.getAllByRole('row')).toHaveLength(rows.length + 1);
  });

  /*
   * **첫 칸은 품목이다**(사용자 지시 2026-09-21). 의뢰번호는 고르는 데 필요한 값이 아니고
   * 고른 뒤 우측 창이 먼저 보여 준다 — 좁은 칸의 자리를 검사자가 실제로 찾는 값에 내줬다.
   */
  it('첫 칸에 품목 이름과 코드를 두 줄로 세운다', () => {
    renderTable();

    const table = screen.getByRole('table');

    expect(within(table).getAllByText(ITEM_NAME).length).toBe(rows.length);
    expect(within(table).getAllByText(ITEM_CODE).length).toBe(rows.length);
  });

  /** 열에서 뺐다 — 화면에 남으면 그 자리를 도로 차지한다. */
  it('의뢰번호를 열로 보인다(사용자 지시 2026-10-27 · #185)', () => {
    renderTable();

    const table = screen.getByRole('table');

    expect(within(table).getByText('IR-2026-0001')).toBeInTheDocument();
    expect(within(table).getByText(t.columns.inspectionRequestNo)).toBeInTheDocument();
  });

  /**
   * 열에서 뺐다고 **줄을 가릴 수 없게 되면 안 된다** — 같은 품목의 의뢰가 여럿일 수 있어
   * 보이는 글자만으로는 줄이 갈리지 않는다. 접근 이름이 의뢰번호를 함께 담는다.
   */
  it('줄을 여는 단추의 접근 이름이 보이는 품목과 의뢰번호를 함께 담는다', () => {
    renderTable();

    const button = openButton('IR-2026-0002');

    expect(button).toHaveAccessibleName(
      expect.stringContaining('IR-2026-0002') as unknown as string,
    );
    expect(button).toHaveAccessibleName(expect.stringContaining(ITEM_NAME) as unknown as string);
  });

  /** 못 푼 갈래는 줄이 하나뿐이다 — 그 자리에 사유가 선다. */
  it('품목을 못 풀면 그 자리에 사유를 낸다', () => {
    renderTable({ itemNames: unresolvedItems });

    const table = screen.getByRole('table');

    expect(within(table).getAllByText(messages.common.reference.failed).length).toBe(rows.length);
  });

  it('품목 칸을 누르면 그 의뢰를 고른다 — 첫 칸이 곧 「이 줄을 연다」다', async () => {
    const onSelect = renderTable();

    await userEvent.click(openButton('IR-2026-0002'));

    expect(onSelect).toHaveBeenCalledWith(1002);
  });

  /* omf-all-around#133 — 줄의 다른 칸(LOT·상태·일시)을 눌러도 그 줄을 고른다. */
  it('줄의 다른 칸을 눌러도 그 의뢰를 고른다', async () => {
    const onSelect = renderTable();
    const row = openButton('IR-2026-0002').closest('tr') as HTMLElement;

    await userEvent.click(within(row).getAllByRole('cell')[1] as HTMLElement);

    expect(onSelect).toHaveBeenCalledWith(1002);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('고른 줄만 현재로 표시한다', () => {
    renderTable({ selectedId: 1002 });

    expect(openButton('IR-2026-0002')).toHaveAttribute('aria-current', 'true');
    expect(openButton('IR-2026-0001')).not.toHaveAttribute('aria-current');
  });

  it('자재 LOT 이 없으면 빈 칸이 아니라 없음 표시를 낸다 — 못 불러온 것과 구분한다', () => {
    renderTable();

    const row = openButton('IR-2026-0003').closest('tr');
    expect(row).not.toBeNull();
    /* LOT 칸 · 공급사 칸(LOT 으로 푼다) 둘 다 없음 표시다(#197). */
    expect(within(row as HTMLElement).getAllByText(t.emptyValue)).toHaveLength(2);
  });

  it('대기와 진행을 서로 다른 문구로 가른다', () => {
    renderTable();

    const waiting = openButton('IR-2026-0001').closest('tr');
    const inProgress = openButton('IR-2026-0002').closest('tr');

    expect(
      within(waiting as HTMLElement).getByText(messages.iqcInspection.status.requested),
    ).toBeInTheDocument();
    expect(
      within(inProgress as HTMLElement).getByText(messages.iqcInspection.status.inProgress),
    ).toBeInTheDocument();
  });

  it('의뢰 일시를 공장 시각(UTC+7)의 연·월·일 시·분으로 낸다 — 실행 환경 시간대와 무관하다', () => {
    renderTable();

    /* 픽스처 `2026-08-18T09:15:00+09:00` 은 공장 시각 07:15 다(omf-all-around#20). */
    expect(screen.getByText('2026-08-18 07:15')).toBeInTheDocument();
  });

  it('결과가 없으면 받은 빈 상태를 그 자리에 그린다', () => {
    renderTable({ rows: [] });

    expect(screen.getByText(t.empty)).toBeInTheDocument();
  });
});

describe('QueueTable — 자재 LOT 표기', () => {
  /**
   * ⛔ **내부 번호를 화면에 내지 않는다**(`omf-mes#44`). 이 칸은 종전에 `lotId` 를 그대로 찍어
   * 「44」·「45」가 나왔다 — 검사자가 손에 든 라벨과 대조할 수 없었다(omf-all-around#40).
   */
  it('LOT 번호를 보이고 내부 번호는 어디에도 없다', () => {
    renderTable();

    const table = screen.getByRole('table');

    expect(LOT_IDS.length).toBeGreaterThan(0);

    for (const lotId of LOT_IDS) {
      /* 번호는 앞 마디 · 끝 마디 두 조각으로 그려진다(#133) — 칸 전체 글자와 title 로 잰다. */
      const cells = within(table).getAllByTitle(LOT_NO(lotId));
      expect(cells.length).toBeGreaterThan(0);
      expect(cells[0]).toHaveTextContent(LOT_NO(lotId));
      /* 짝 방향 — 번호가 글자로도 남지 않는다. */
      expect(table.textContent ?? '').not.toContain(String(lotId));
    }
  });

  /** 없는 것이 정상이다(작업지시 대상 검사 등) — 풀이가 그 갈래의 글자를 정한다. */
  it('LOT 이 없는 줄은 풀이가 정한 빈 값 표기를 낸다', () => {
    renderTable({ rows: rows.map((row) => ({ ...row, lotId: null })) });

    const table = screen.getByRole('table');

    /* LOT 칸 · 공급사 칸(LOT 으로 푼다) 둘 다(#197). */
    expect(within(table).getAllByText('—').length).toBe(rows.length * 2);
  });

  it('공급사 열이 자재 LOT 의 공급사 이름을 보인다(#197)', () => {
    renderTable();

    expect(screen.getByRole('columnheader', { name: t.columns.supplier })).toBeInTheDocument();
    expect(screen.getAllByText('(주)합성공급').length).toBeGreaterThan(0);
  });

  describe('「생략」 칸(omf-all-around#225)', () => {
    /* 줄마다 LOT 이 다르다 — 결재 상태를 LOT 으로 갈라 돌려준다. */
    const lotRow = (no: string, lotId: number, statusCode = 'REQUESTED') => ({
      ...rows[0]!,
      inspectionRequestId: lotId,
      inspectionRequestNo: no,
      lotId,
      statusCode,
    });
    const skipRows = [
      lotRow('IR-SKIP-REQ', 7001),
      lotRow('IR-SKIP-PEND', 7002, 'IN_PROGRESS'),
      lotRow('IR-SKIP-APPR', 7003),
      lotRow('IR-SKIP-REJ', 7004),
      lotRow('IR-SKIP-DONE', 7005, 'COMPLETED'),
      { ...lotRow('IR-SKIP-NOLOT', 7006), lotId: null },
    ];
    const approvalOf: Record<number, string> = {
      7002: 'PENDING',
      7003: 'APPROVED',
      7004: 'REJECTED',
    };

    const renderSkip = (workerNo: string | null = '901463', myTurn = true) => {
      const writes: Request[] = [];
      const stubFetch: StubFetch = async (request) => {
        const url = new URL(request.url);
        /* 승인 처리 창이 읽는 결재 상세 — 내 차례이고 버전은 3. */
        if (url.pathname === '/app/approval-requests/7102') {
          return jsonResponse(
            {
              request: {
                approvalRequestId: 7102,
                approvalRequestNo: 'AP-7002',
                approvalTypeCode: 'IQC_SKIP',
                requestedBy: 5,
                requestedByName: '검사자',
                requestedAt: '2026-11-02T01:00:00Z',
                statusCode: 'PENDING',
                reason: '긴급 투입',
                target: {
                  targetTypeCode: 'INBOUND_LOT',
                  targetId: 7002,
                  displayName: 'LOT',
                  openable: false,
                },
                currentStepNo: 1,
                totalStepNo: 1,
                isMyTurn: myTurn,
              },
              steps: [],
            },
            { headers: { ETag: '"3"' } },
          );
        }
        if (url.pathname.startsWith('/app/approval-requests/7102:')) {
          writes.push(request.clone());
          return jsonResponse({ request: {}, steps: [] });
        }
        if (url.pathname === '/app/approval-requests') {
          const lotId = Number(url.searchParams.get('targetId'));
          const statusCode = approvalOf[lotId];
          const items =
            statusCode === undefined
              ? []
              : [
                  {
                    approvalRequestId: lotId + 100,
                    approvalRequestNo: `AP-${String(lotId)}`,
                    approvalTypeCode: 'IQC_SKIP',
                    requestedBy: 5,
                    requestedByName: '검사자',
                    requestedAt: '2026-11-02T01:00:00Z',
                    statusCode,
                    reason: '긴급 투입',
                    target: {
                      targetTypeCode: 'INBOUND_LOT',
                      targetId: lotId,
                      displayName: 'LOT',
                      openable: false,
                    },
                    currentStepNo: null,
                    totalStepNo: 1,
                  },
                ];
          return jsonResponse({ items, page: { page: 1, size: 20, total: items.length } });
        }
        if (url.pathname.startsWith('/trace/lots/')) {
          writes.push(request.clone());
          return jsonResponse(
            { lotId: 1 },
            { status: url.pathname.endsWith(':skip-iqc') ? 200 : 202 },
          );
        }
        throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
      };
      const result = renderWithProviders(
        <QueueTable
          rows={skipRows}
          itemNames={itemNames}
          lotNumbers={lotNumbers}
          suppliers={suppliers}
          selectedId={null}
          onSelect={vi.fn()}
          skipWorkerNo={workerNo}
          empty={<p>{t.empty}</p>}
        />,
        { fetch: stubFetch, dataRouter: true },
      );
      return { writes, router: result.router };
    };
    const rowOf = (no: string) => within(screen.getByText(no).closest('tr')!);
    const skip = messages.iqcInspection.skip;

    it('결재 단계마다 단추가 하나 선다 — 없음·반려 생략 요청, 결재 중 승인 처리, 승인 생략 실행', async () => {
      renderSkip();
      expect(screen.getByRole('columnheader', { name: t.columns.skip })).toBeInTheDocument();
      expect(
        await rowOf('IR-SKIP-REQ').findByRole('button', { name: t.skipRequest }),
      ).toBeEnabled();
      expect(
        await rowOf('IR-SKIP-PEND').findByRole('button', { name: t.skipApprove }),
      ).toBeInTheDocument();
      expect(
        await rowOf('IR-SKIP-APPR').findByRole('button', { name: t.skipExecute }),
      ).toBeInTheDocument();
      expect(
        await rowOf('IR-SKIP-REJ').findByRole('button', { name: t.skipRequest }),
      ).toBeInTheDocument();
      /* 끝난 의뢰·LOT 없는 의뢰에는 단추가 없다. */
      expect(
        rowOf('IR-SKIP-DONE').queryByRole('button', { name: /생략|승인/ }),
      ).not.toBeInTheDocument();
      expect(
        rowOf('IR-SKIP-NOLOT').queryByRole('button', { name: /생략|승인/ }),
      ).not.toBeInTheDocument();
    });

    it('생략 요청은 사유를 받아 그 LOT 으로 사번과 함께 보낸다', async () => {
      const user = userEvent.setup();
      const { writes } = renderSkip();
      await user.click(await rowOf('IR-SKIP-REQ').findByRole('button', { name: t.skipRequest }));
      await user.type(screen.getByLabelText(skip.reason), '긴급 투입');
      await user.click(screen.getByRole('button', { name: skip.request }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(new URL(writes[0]!.url).pathname).toBe('/trace/lots/7001:request-iqc-skip');
      expect(writes[0]!.headers.get('X-Worker-No')).toBe('901463');
      expect(await writes[0]!.json()).toEqual({ reason: '긴급 투입' });
    });

    const d = t.skipDialog;

    it('승인 처리는 화면을 옮기지 않고 창에서 결재 사유와 함께 승인한다', async () => {
      const user = userEvent.setup();
      const { writes, router } = renderSkip();
      await user.click(await rowOf('IR-SKIP-PEND').findByRole('button', { name: t.skipApprove }));
      const dialog = await screen.findByRole('dialog', { name: d.approveTitle });
      expect(await within(dialog).findByText('AP-7002')).toBeInTheDocument();

      /* 결재 사유 없이는 보내지 않는다. */
      await user.click(within(dialog).getByRole('button', { name: d.approve }));
      expect(writes).toHaveLength(0);

      await user.type(within(dialog).getByLabelText(d.comment), '확인함');
      await user.click(within(dialog).getByRole('button', { name: d.approve }));
      await waitFor(() => expect(writes).toHaveLength(1));
      expect(new URL(writes[0]!.url).pathname).toBe('/app/approval-requests/7102:approve');
      expect(writes[0]!.headers.get('If-Match')).toBe('"3"');
      expect(await writes[0]!.json()).toEqual({ comment: '확인함' });
      expect(router?.state.location.pathname).not.toBe('/quality/approvals');
    });

    it('승인 처리 창에서 반려도 한다', async () => {
      const user = userEvent.setup();
      const { writes } = renderSkip();
      await user.click(await rowOf('IR-SKIP-PEND').findByRole('button', { name: t.skipApprove }));
      const dialog = await screen.findByRole('dialog', { name: d.approveTitle });
      await user.type(await within(dialog).findByLabelText(d.comment), '서류 미비');
      await user.click(within(dialog).getByRole('button', { name: d.reject }));
      await waitFor(() => expect(writes).toHaveLength(1));
      expect(new URL(writes[0]!.url).pathname).toBe('/app/approval-requests/7102:reject');
    });

    it('내 결재 차례가 아니면 승인·반려 단추가 잠긴다', async () => {
      const user = userEvent.setup();
      renderSkip('901463', false);
      await user.click(await rowOf('IR-SKIP-PEND').findByRole('button', { name: t.skipApprove }));
      const dialog = await screen.findByRole('dialog', { name: d.approveTitle });
      expect(await within(dialog).findByText(d.notMyTurn)).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: d.approve })).toBeDisabled();
      expect(within(dialog).getByRole('button', { name: d.reject })).toBeDisabled();
    });

    it('생략 실행은 한 번 묻고, 「생략 실행」을 눌러야 그 LOT 의 IQC 생략을 실행한다', async () => {
      const user = userEvent.setup();
      const { writes } = renderSkip();
      await user.click(await rowOf('IR-SKIP-APPR').findByRole('button', { name: t.skipExecute }));
      const dialog = await screen.findByRole('dialog', { name: d.executeTitle });
      expect(writes).toHaveLength(0);

      await user.click(within(dialog).getByRole('button', { name: d.execute }));
      await waitFor(() => expect(writes).toHaveLength(1));
      expect(new URL(writes[0]!.url).pathname).toBe('/trace/lots/7003:skip-iqc');
    });

    it('생략 실행 창에서 취소하면 실행하지 않는다', async () => {
      const user = userEvent.setup();
      const { writes } = renderSkip();
      await user.click(await rowOf('IR-SKIP-APPR').findByRole('button', { name: t.skipExecute }));
      const dialog = await screen.findByRole('dialog', { name: d.executeTitle });
      await user.click(
        within(dialog).getByRole('button', { name: messages.iqcInspection.skip.cancel }),
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(writes).toHaveLength(0);
    });

    it('계정에 작업자가 없으면 생략 요청 단추가 잠긴다', async () => {
      renderSkip(null);
      expect(
        await rowOf('IR-SKIP-REQ').findByRole('button', { name: t.skipRequest }),
      ).toBeDisabled();
    });

    it('사번을 넘기지 않으면 열을 세우지 않는다', () => {
      renderTable();
      expect(screen.queryByRole('columnheader', { name: t.columns.skip })).not.toBeInTheDocument();
    });
  });
});
