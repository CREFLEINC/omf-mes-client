import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { setupScreen } from './test-fixtures';

const t = messages.productionWarehouseReplenishment;
const tu = t.runs;
const tl = t.runLog;

const PROGRESS = '/production/warehouse-replenishment?view=progress';

const runTable = async () => within(await screen.findByRole('table', { name: tu.listLabel }));
const rowOf = async (name: string) => {
  const found = (await runTable()).getByText(name).closest('tr');
  if (found === null) throw new Error(`${name} 줄이 없다`);
  return within(found);
};

describe('W-02-12 생산 창고 보충 — 자동 보충 실행', () => {
  it('US5-10 진행 보기 아래 창고마다 실행 시각 · 마지막 실행 · 결과를 보이고, 「지금 실행」은 없다', async () => {
    const { gets } = setupScreen({ route: PROGRESS });

    /* 창고 A — 창고 시각, 오늘 실행은 실패. */
    const a = await rowOf('합성 생산창고 A');
    expect(a.getByText(tu.runTimeWarehouse('07:00'))).toBeInTheDocument();
    expect(a.getByText('11-05 07:00')).toBeInTheDocument();
    expect(a.getByText(tu.failed)).toBeInTheDocument();

    /* 창고 B — 공장 기본 시각, 기준 아래 품목이 없었다. */
    const b = await rowOf('합성 생산창고 B');
    expect(b.getByText(tu.runTimePlant('01:00'))).toBeInTheDocument();
    expect(b.getByText(`${tu.created(0)}, ${tu.allAbove}`)).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /지금 실행/ })).toBeNull();
    const query = gets.find((url) => url.pathname === '/logistics/replenishment-runs');
    expect(query?.searchParams.get('plantId')).toBe('8401');
    expect(query?.searchParams.get('runDateFrom')).not.toBeNull();
    /* 서버 기본 50건에서 잘리지 않게 쪽을 실어 끝까지 받는다(G2 확인 4). */
    expect(query?.searchParams.get('size')).not.toBeNull();
  });

  it('US5-10 결과 줄은 만든 요청과 건너뛴 품목을 사유별로 센다(일부만 요청은 건너뜀이 아니다)', async () => {
    setupScreen({
      route: PROGRESS,
      runs: [
        {
          replenishmentRunId: 3,
          productionWarehouseId: 7001,
          productionWarehouseCode: 'SYN-PW-A',
          productionWarehouseName: '합성 생산창고 A',
          runDate: '2026-11-05',
          status: 'DONE',
          startedAt: '2026-11-05T00:00:10Z',
          finishedAt: '2026-11-05T00:00:30Z',
          checkedItemCount: 12,
          createdRequestCount: 1,
          errorText: null,
          lines: [
            {
              itemId: 601,
              itemCode: 'SYN-IT-1',
              itemName: '합성',
              resultCode: 'CREATED',
              usableQty: 40,
              requestedQty: 160,
              shortageQty: 0,
              issueRequestNo: 'SYN-MIR-31',
            },
            {
              itemId: 602,
              itemCode: 'SYN-IT-2',
              itemName: '합성',
              resultCode: 'SHORTAGE',
              usableQty: 40,
              requestedQty: 100,
              shortageQty: 60,
              issueRequestNo: 'SYN-MIR-31',
            },
            {
              itemId: 603,
              itemCode: 'SYN-IT-3',
              itemName: '합성',
              resultCode: 'IN_PROGRESS',
              usableQty: 60,
              requestedQty: 0,
              shortageQty: 0,
              issueRequestNo: null,
            },
            {
              itemId: 604,
              itemCode: 'SYN-IT-4',
              itemName: '합성',
              resultCode: 'NO_SOURCE_STOCK',
              usableQty: 12,
              requestedQty: 0,
              shortageQty: 0,
              issueRequestNo: null,
            },
          ],
        },
      ],
    });

    const a = await rowOf('합성 생산창고 A');
    expect(
      a.getByText(
        `${tu.created(1)}, ${tu.skipped(
          2,
          `${tu.skippedPart(tl.results.IN_PROGRESS, 1)}, ${tu.skippedPart(tl.results.NO_SOURCE_STOCK, 1)}`,
        )}`,
      ),
    ).toBeInTheDocument();
  });

  it('US5-10 [기록 보기]는 날짜별 결과 표(결과 이름 5종)와 「관리 품목 N 중 기준 아래 M」, 실패는 오류 글과 「오늘은 다시 실행하지 않습니다」', async () => {
    const { user } = setupScreen({ route: PROGRESS });

    await user.click(
      (await rowOf('합성 생산창고 A')).getByRole('button', {
        name: tu.showLogLabel('합성 생산창고 A'),
      }),
    );
    const dialog = within(await screen.findByRole('dialog', { name: tl.title('합성 생산창고 A') }));

    /* 최근 것이 먼저 — 11-05 실패. */
    expect(dialog.getByText(tl.failedText('출고 자재 창고를 쓰지 않습니다'))).toBeInTheDocument();
    expect(dialog.getByText(tl.noRerun)).toBeInTheDocument();

    /* 11-04 완료 — 기준 이상 품목은 행 대신 수로만. */
    expect(dialog.getByText(tl.checked(12, 4))).toBeInTheDocument();
    const lines = within(dialog.getByRole('table', { name: tl.linesLabel('11-04 07:00') }));
    expect(lines.getByText(tl.results.CREATED)).toBeInTheDocument();
    expect(lines.getByText(tl.results.SHORTAGE)).toBeInTheDocument();
    expect(lines.getByText(tl.results.IN_PROGRESS)).toBeInTheDocument();
    expect(lines.getByText(tl.results.NO_SOURCE_STOCK)).toBeInTheDocument();
    expect(lines.getByText('SYN-MIR-32')).toBeInTheDocument();
    /* 일부만 요청 줄 — 요청 100, 부족 60. */
    const shortRow = within(lines.getByText('SYN-MIR-32').closest('tr') as HTMLElement);
    expect(shortRow.getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'SYN-IT-2 합성 품목 2',
      tl.results.SHORTAGE,
      '40',
      '100',
      '60',
      'SYN-MIR-32',
    ]);
  });

  it('결과 이름 5종이 모두 문구에 있다(출고 자재 창고 사용 안 함 포함)', () => {
    expect(Object.keys(tl.results).sort()).toEqual(
      ['CREATED', 'IN_PROGRESS', 'NO_SOURCE_STOCK', 'SHORTAGE', 'SOURCE_INACTIVE'].sort(),
    );
    expect(tl.results.SOURCE_INACTIVE).toBe('출고 자재 창고 사용 안 함');
  });

  it('US5-10 관리 품목 보기의 시각 구획에 창고마다 마지막 실행을 보인다', async () => {
    setupScreen({ route: '/production/warehouse-replenishment?view=items' });

    const panel = within(await screen.findByRole('region', { name: t.runTime.title }));
    expect(panel.getByText(t.runTime.lastRun('11-05 01:00', tu.created(0)))).toBeInTheDocument();
  });
});
