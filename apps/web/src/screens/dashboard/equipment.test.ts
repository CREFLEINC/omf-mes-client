import type { DashboardEquipment, DashboardEquipmentItem } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import {
  ALL_LINES,
  effectiveLine,
  elapsedMinutesOf,
  filterByLine,
  toEquipmentView,
  toLineOptions,
  toStoppedItems,
} from './equipment';

const AS_OF = '2026-10-16T03:00:00Z';

const item = (overrides: Partial<DashboardEquipmentItem>): DashboardEquipmentItem => ({
  equipmentId: 1,
  equipmentCode: 'EQ-01',
  equipmentName: '시험 설비',
  equipmentTypeCode: 'TYPE-A',
  equipmentTypeName: '100T',
  productionLineId: 10,
  productionLineName: 'B라인',
  statusCode: 'RUNNING',
  statusSince: '2026-10-16T01:00:00Z',
  statusReasonCode: null,
  statusReasonName: null,
  todayTotalQty: 100,
  todayNgQty: 2,
  defectRate: 2,
  standardCycleTimeSec: 30,
  currentWorkOrderNo: 'WO-1',
  currentItemCode: 'ITEM-1',
  currentItemName: '시험 품목',
  ...overrides,
});

const section = (items: DashboardEquipmentItem[]): DashboardEquipment => ({
  asOf: AS_OF,
  statusCounts: { RUNNING: 2, STOPPED: 1, WAITING: 0, CHANGEOVER: 1, IDLE: 0 },
  items,
});

describe('toEquipmentView', () => {
  it('섹션이 오지 않으면 null — 설비 0대와 가른다', () => {
    expect(toEquipmentView(undefined)).toBeNull();
    expect(toEquipmentView(section([]))?.items).toEqual([]);
  });

  it('상태 집계를 규격 순서(가동 · 정지 · 대기 · 교체 · 비가동)로 세우고 합을 낸다', () => {
    const view = toEquipmentView(section([]));

    expect(view?.statusCounts.map((entry) => entry.statusCode)).toEqual([
      'RUNNING',
      'STOPPED',
      'WAITING',
      'CHANGEOVER',
      'IDLE',
    ]);
    expect(view?.totalCount).toBe(4);
  });

  it('경과 시간은 서버 판단 시각까지 잰다', () => {
    const view = toEquipmentView(section([item({ statusSince: '2026-10-16T01:35:00Z' })]));

    expect(view?.items[0]?.elapsedMinutes).toBe(85);
  });
});

describe('elapsedMinutesOf', () => {
  it('시작 시각이 없거나 · 읽을 수 없거나 · 판단 시각보다 뒤면 null', () => {
    expect(elapsedMinutesOf(null, AS_OF)).toBeNull();
    expect(elapsedMinutesOf('어제', AS_OF)).toBeNull();
    expect(elapsedMinutesOf('2026-10-16T04:00:00Z', AS_OF)).toBeNull();
  });
});

describe('라인 필터', () => {
  const view = toEquipmentView(
    section([
      item({ equipmentId: 1, productionLineId: 10, productionLineName: 'B라인' }),
      item({ equipmentId: 2, productionLineId: 20, productionLineName: 'A라인' }),
      item({ equipmentId: 3, productionLineId: 10, productionLineName: 'B라인' }),
      item({ equipmentId: 4, productionLineId: null, productionLineName: null }),
    ]),
  );
  const items = view?.items ?? [];

  it('받은 설비에서 라인을 뽑아 이름순으로 낸다 — 라인 없는 설비는 선택지를 만들지 않는다', () => {
    expect(toLineOptions(items)).toEqual([
      { value: '20', label: 'A라인' },
      { value: '10', label: 'B라인' },
    ]);
  });

  it('라인을 고르면 그 라인 설비만, 「전체」면 라인 없는 설비까지 다 보인다', () => {
    expect(filterByLine(items, '10').map((entry) => entry.equipmentId)).toEqual([1, 3]);
    expect(filterByLine(items, ALL_LINES)).toHaveLength(4);
  });

  it('고른 라인이 선택지에서 사라지면(공장 전환 · 자동 갱신) 전체로 본다', () => {
    const options = toLineOptions(items);

    expect(effectiveLine(options, '10')).toBe('10');
    expect(effectiveLine(options, '99')).toBe(ALL_LINES);
  });
});

describe('toStoppedItems', () => {
  it('가동이 아닌 설비만, 오래 멈춘 것부터 — 경과를 모르면 뒤로', () => {
    const view = toEquipmentView(
      section([
        item({ equipmentId: 1, statusCode: 'RUNNING' }),
        item({ equipmentId: 2, statusCode: 'WAITING', statusSince: '2026-10-16T02:50:00Z' }),
        item({ equipmentId: 3, statusCode: 'IDLE', statusSince: null }),
        item({ equipmentId: 4, statusCode: 'STOPPED', statusSince: '2026-10-16T01:00:00Z' }),
        item({ equipmentId: 5, statusCode: 'CHANGEOVER', statusSince: '2026-10-16T02:00:00Z' }),
      ]),
    );

    expect(toStoppedItems(view?.items ?? []).map((entry) => entry.equipmentId)).toEqual([
      4, 5, 2, 3,
    ]);
  });
});
