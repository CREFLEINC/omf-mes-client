import type { DashboardQuality, DashboardQualityTypeBlock } from '@omf-mes/api-client';

/** 품질 섹션 시험값. ⛔ 시안의 예시 숫자 · 업체명을 옮기지 않는다(공개 저장소). */
export const qualityBlock = (
  overrides: Partial<DashboardQualityTypeBlock> = {},
): DashboardQualityTypeBlock => ({
  monthPassRate: 96.4,
  prevMonthPassRate: null,
  dailyPassRates: [
    { date: '2026-10-14', passRate: 95 },
    { date: '2026-10-15', passRate: null },
    { date: '2026-10-16', passRate: 97.5 },
  ],
  todayLots: { accepted: 2, rejected: 1, held: 1 },
  monthLots: { accepted: 20, rejected: 2, held: 1 },
  monthDefectQty: 30,
  defectPhenomena: [],
  recentLots: [],
  ...overrides,
});

export const quality = (): DashboardQuality => ({
  iqc: {
    ...qualityBlock({
      recentLots: [
        {
          inspectionResultId: 1,
          inspectedAt: '2026-10-16T01:00:00Z',
          counterpartName: '공급사 A',
          equipmentCode: null,
          itemCode: 'ITEM-1',
          itemName: '시험 품목 1',
          lotNo: 'LOT-1',
          qty: 100,
          judgmentCode: 'ACCEPTED',
        },
      ],
    }),
    vendorDefects: [{ partnerId: 1, partnerName: '공급사 A', rejectedQty: 12 }],
    itemDefects: [],
    fullReinspect: null,
    receiptHoldLotCount: 2,
  },
  pqc: {
    ...qualityBlock({
      monthPassRate: null,
      recentLots: [
        {
          inspectionResultId: 2,
          inspectedAt: '2026-10-16T02:00:00Z',
          counterpartName: null,
          equipmentCode: 'EQ-01',
          itemCode: 'ITEM-2',
          itemName: '시험 품목 2',
          lotNo: null,
          qty: 50,
          judgmentCode: 'HELD',
        },
      ],
    }),
    pendingLotCount: 3,
    reworkRequestCount: 1,
    equipmentDefectRates: [],
  },
  oqc: { ...qualityBlock(), customerReturnQty: 40 },
  nonconformance: {
    monthQty: 30,
    phenomena: [],
    causeGroups: [],
    scrapQty: 5,
    reworkReleasedQty: 8,
    openCount: 4,
    overdueCount: null,
  },
});
