import { plantToday } from '../../../patterns/plant-time';
import { useNavigate } from 'react-router';
import type { ReferenceRow, ReferenceSource } from '../../../patterns/reference-picker';
import { ProposalReview } from './review';
import {
  resourceLabels,
  type ResourceField,
  type ReviewOperation,
  type ReviewProposal,
} from './model';

const option = (id: number, code: string, name: string, parentId?: number): ReferenceRow => ({
  id,
  code,
  name,
  ...(parentId ? { parentId } : {}),
});
const options: Record<ResourceField, ReferenceRow[]> = {
  productionLineId: [option(1, 'LINE-01', '생산 라인 A'), option(2, 'LINE-02', '생산 라인 B')],
  plannedEquipmentId: [option(11, 'EQ-01', '설비 A', 1), option(12, 'EQ-02', '설비 B', 2)],
  plannedMoldId: [option(21, 'MOLD-01', '금형 A')],
  responsibleWorkerId: [option(31, 'WK-01', '작업자 A')],
  plannedShiftId: [option(41, 'SHIFT-01', '주간'), option(42, 'SHIFT-02', '야간')],
  defaultFgLocationId: [option(61, 'SYS-WHOLE', '창고 전체', 81)],
  defaultScrapLocationId: [option(71, 'SCRAP-01', '스크랩 위치 A')],
};
const operation = (key: string, sequence: number, missing: boolean): ReviewOperation => ({
  key,
  sequence,
  name: sequence === 10 ? '성형' : '검사',
  processCode: sequence === 10 ? 'PR-01' : 'PR-02',
  quantity: 100,
  predecessors: sequence === 10 ? [] : ['10 / 성형'],
  start: `${plantToday()} 08:00`,
  end: `${plantToday()} 17:00`,
  required: [
    'productionLineId',
    'defaultFgLocationId',
    'defaultScrapLocationId',
  ],
  resources: {
    productionLineId: missing ? null : options.productionLineId[0]!,
    plannedEquipmentId: null,
    plannedMoldId: null,
    responsibleWorkerId: null,
    plannedShiftId: null,
    defaultFgLocationId: options.defaultFgLocationId[0]!,
    defaultScrapLocationId: options.defaultScrapLocationId[0]!,
  },
});
export const previewProposals: ReviewProposal[] = [0, 1, 2, 3].map((index) => ({
  id: String(index + 1),
  number: `PD261106${String(index + 1).padStart(6, '0')}`,
  itemCode: `ITEM-${index + 1}`,
  itemName:
    index === 2
      ? '품목 C / 긴 품목명과 규격을 생략하지 않고 확인하는 시험용 품목'
      : `품목 ${index === 0 ? 'A' : index === 1 ? 'B' : 'D'}`,
  plant: 'OA Plant',
  erpStorage: {
    erpStorageLocationCode: 'WH-A',
    warehouse: option(81, 'WH-A', '생산품 입고 창고 A'),
    location: options.defaultFgLocationId[0]!,
    reasonCode: null,
    locationRole: 'WAREHOUSE_WHOLE',
  },
  erpPlanStartDate: plantToday(),
  orderQty: 100,
  confirmedQty: index === 3 ? 100 : 0,
  draftQty: index === 1 ? 100 : 0,
  remainingQty: index === 1 || index === 3 ? 0 : 100,
  uom: 'EA',
  issues: [],
  plans: [
    {
      key: `new-${index + 1}`,
      ...(index === 1 || index === 3 ? { number: `PLAN-${index + 1}` } : {}),
      source: index === 3 ? '기존 확정 계획' : index === 1 ? '작성중 계획' : '신규 제안',
      date: plantToday(),
      quantity: '100',
      bom: 'BOM-A (Rev 1)',
      bomComponents: [
        { itemCode: 'MAT-01', itemName: '구성 자재 A', quantity: 1, uom: 'EA' },
        { itemCode: 'MAT-02', itemName: '구성 자재 B', quantity: 0.25, uom: 'KG' },
      ],
      routing: 'RT-A (Rev 1)',
      routingOptions: [
        {
          value: option(101, 'RT-A', '기본 공정 (Rev 1)'),
          operations: [operation('op-10', 10, false), operation('op-20', 20, false)],
        },
        {
          value: option(102, 'RT-B', '대체 공정 (Rev 2)'),
          operations: [operation('op-10', 10, false)],
        },
      ],
      operations: [operation('op-10', 10, index === 1), operation('op-20', 20, false)].map(
        (op, position) => ({
          ...op,
          ...(index === 3 ? { number: `WO-261106-${position + 1}` } : {}),
        }),
      ),
    },
  ],
}));
export const previewResourceSource = (
  _row: ReviewProposal,
  operation: ReviewOperation,
  field: ResourceField,
): ReferenceSource => ({
  title: `${resourceLabels[field]} 선택`,
  key: ['proposal-preview', operation.key, field, operation.resources.productionLineId?.id],
  columns: { code: '코드', name: '명칭' },
  search: async (term, page) => {
    const filtered = options[field].filter(
      (value) =>
        (field !== 'plannedEquipmentId' ||
          value.parentId === operation.resources.productionLineId?.id) &&
        `${value.code} ${value.name}`.includes(term),
    );
    return { items: filtered.slice((page - 1) * 20, page * 20), total: filtered.length };
  },
});
export const ProposalReviewPreviewPage = () => {
  const navigate = useNavigate();
  return (
    <ProposalReview
      initialProposals={previewProposals}
      resourceSource={previewResourceSource}
      onClose={() => void navigate('/production/production-orders')}
      preview
    />
  );
};
