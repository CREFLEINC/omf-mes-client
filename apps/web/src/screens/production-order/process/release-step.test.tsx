import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/api-harness';
import { plantToday } from '../../../patterns/plant-time';
import { addDays } from '../../plant-working-days/working-days';
import { releaseBlocksOf, type ReleaseAttempt } from '../release-runner';
import type { OrderWorkOrder } from './queries';
import {
  RELEASE_BLOCK_LINKS,
  ReleaseStep,
  toReleaseFailures,
  unsourcedNotices,
  type IssueDates,
  type ReleaseLine,
} from './release-step';

const t = messages.erpWorkOrderFlow.process.release;
const pw = t.productionWarehouse;

/** 배포 확인 단계(피처 003 · tasks T053). W/O · 품목은 합성 값이다. */

const workOrder = (id: number): OrderWorkOrder => ({
  workOrderId: id,
  workOrderNo: `SYN-WO-${String(id)}`,
  productionPlanId: 1,
  operationName: '합성 조립',
  orderQty: 100,
  uomId: 1,
  itemId: 11,
  statusCode: 'CONFIRMED',
  priorityNo: 1,
});

const line = (id: number): ReleaseLine => ({
  workOrder: workOrder(id),
  lotSizeText: '50',
  lotSize: 50,
  lotCount: 2,
  error: null,
  touched: false,
});

const attempt = (overrides: Partial<ReleaseAttempt>): ReleaseAttempt => ({
  workOrderId: 1,
  workOrderNo: 'SYN-WO-1',
  status: 'failed',
  reason: '서버 문구',
  ...overrides,
});

const renderStep = (props: Partial<Parameters<typeof ReleaseStep>[0]> = {}) =>
  renderWithProviders(
    <ReleaseStep
      lines={[line(1), line(2)]}
      uomLabelOf={() => 'EA'}
      failures={[]}
      revealErrors={false}
      onLotSizeChange={() => undefined}
      {...props}
    />,
  );

describe('배포 확인 단계 — 생산 창고 공장', () => {
  it('US2-5 400 출고 요청 기준정보 사유 3종을 W/O 마다 문구와 새 탭 바로가기로 보인다', () => {
    const blocks = releaseBlocksOf({
      kind: 'validation',
      errors: [
        { scope: 'screen', code: 'LINE_DEPARTMENT_MISSING', message: 'a' },
        { scope: 'screen', code: 'PRODUCTION_WAREHOUSE_MISSING', message: 'b' },
        { scope: 'screen', code: 'PRODUCTION_FLOOR_LOCATION_MISSING', message: 'c' },
        { scope: 'screen', code: 'OTHER', message: 'd' },
      ],
    });
    expect(blocks).toEqual([
      'LINE_DEPARTMENT_MISSING',
      'PRODUCTION_WAREHOUSE_MISSING',
      'PRODUCTION_FLOOR_LOCATION_MISSING',
    ]);

    const failures = toReleaseFailures([attempt({ blocks })], t.failed);
    renderStep({ failures });

    expect(screen.getByText(pw.blockedTitle)).toBeInTheDocument();
    expect(
      screen.getByText(t.failed('SYN-WO-1', pw.blocks.PRODUCTION_WAREHOUSE_MISSING ?? '')),
    ).toBeInTheDocument();
    const link = screen.getByRole('link', { name: pw.blockLinks.PRODUCTION_WAREHOUSE_MISSING });
    expect(link).toHaveAttribute('href', RELEASE_BLOCK_LINKS.PRODUCTION_WAREHOUSE_MISSING);
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('그 밖의 실패는 지금처럼 서버 문구 한 줄이고 바로가기가 없다', () => {
    renderStep({ failures: toReleaseFailures([attempt({})], t.failed) });

    expect(screen.getByText(t.failed('SYN-WO-1', '서버 문구'))).toBeInTheDocument();
    expect(screen.queryByText(pw.blockedTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('US2-4 「배포할 W/O」 표에 생산일 · 출고 작업일 열을 더하고 효과 문구는 「출고 요청 대기, 출고 작업일 MM-DD 외 N일」', () => {
    const later = addDays(plantToday(), 10);
    const latest = addDays(plantToday(), 12);
    const issueDates = new Map<number, IssueDates>([
      [1, { productionDate: addDays(later, 1), issueWorkDate: later }],
      [2, { productionDate: addDays(latest, 1), issueWorkDate: latest }],
    ]);
    renderStep({ issueDates });

    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers).toEqual(expect.arrayContaining([pw.productionDate, pw.issueWorkDate]));
    const effects = within(
      screen.getByRole('region', { name: messages.screenPatterns.effectList.title(t.task) }),
    );
    expect(
      effects.getByText(new RegExp(pw.materials(pw.dates(later.slice(5), 1)))),
    ).toBeInTheDocument();
    expect(effects.getByText(new RegExp(pw.picking))).toBeInTheDocument();
    expect(effects.queryByText(t.effects.materials)).not.toBeInTheDocument();
  });

  it('출고 작업일이 모두 오늘 이하면 「바로 출고」 효과 문구', () => {
    const past = addDays(plantToday(), -1);
    renderStep({
      issueDates: new Map([
        [1, { productionDate: plantToday(), issueWorkDate: past }],
        [2, { productionDate: plantToday(), issueWorkDate: past }],
      ]),
    });

    expect(screen.getByText(pw.materialsNow(past.slice(5)))).toBeInTheDocument();
    expect(screen.getByText(pw.pickingNow)).toBeInTheDocument();
  });

  it('생산 창고가 없는 공장(issueDates 없음)은 지금 효과 문구 그대로(표기만 「출고 요청 발행」)', () => {
    renderStep();

    expect(screen.getByText(t.effects.materials)).toBeInTheDocument();
    expect(t.effects.materials).toBe('출고 요청 발행');
    expect(screen.queryByText(pw.productionDate)).not.toBeInTheDocument();
  });

  it('US2-9 배포 결과의 「재고 있는 생산 창고 없음」 자재를 W/O 마다 한 줄로 안내한다(막힘 아님)', () => {
    const lines = unsourcedNotices([
      attempt({
        status: 'released',
        reason: null,
        unsourced: [
          {
            itemId: 1,
            itemCode: 'SYN-IT-1',
            itemName: '합성 도료',
            shortageQty: 20,
            uomCode: 'KG',
          },
        ],
      }),
      attempt({ workOrderId: 2, workOrderNo: 'SYN-WO-2', status: 'released', reason: null }),
    ]);

    expect(lines).toEqual([
      pw.unsourced('SYN-WO-1', 1, pw.unsourcedItem('SYN-IT-1', '합성 도료', '20', 'KG')),
    ]);
  });
});
