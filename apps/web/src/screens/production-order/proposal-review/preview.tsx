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
  defaultWipLocationId: [option(51, 'WIP-01', 'WIP 위치 A')],
  defaultFgLocationId: [option(61, 'FG-01', '완제품 위치 A')],
  defaultScrapLocationId: [option(71, 'SCRAP-01', '스크랩 위치 A')],
};
const operation = (key: string, sequence: number, missing: boolean): ReviewOperation => ({
  key,
  sequence,
  name: sequence === 10 ? '성형' : '검사',
  processCode: sequence === 10 ? 'PR-01' : 'PR-02',
  quantity: 100,
  predecessors: sequence === 10 ? [] : ['10 / 성형'],
  start: '2026-11-06 08:00',
  end: '2026-11-06 17:00',
  required: [
    'productionLineId',
    'defaultWipLocationId',
    'defaultFgLocationId',
    'defaultScrapLocationId',
  ],
  resources: {
    productionLineId: missing ? null : options.productionLineId[0]!,
    plannedEquipmentId: null,
    plannedMoldId: null,
    responsibleWorkerId: null,
    plannedShiftId: null,
    defaultWipLocationId: options.defaultWipLocationId[0]!,
    defaultFgLocationId: options.defaultFgLocationId[0]!,
    defaultScrapLocationId: options.defaultScrapLocationId[0]!,
  },
});
export const previewProposals: ReviewProposal[] = [0, 1, 2].map((index) => ({
  id: String(index + 1),
  number: `PD261106${String(index + 1).padStart(6, '0')}`,
  itemCode: `ITEM-${index + 1}`,
  itemName:
    index === 2
      ? '품목 C / 긴 품목명과 규격을 생략하지 않고 확인하는 시험용 품목'
      : `품목 ${index === 0 ? 'A' : 'B'}`,
  plant: '공장 A',
  orderQty: 100,
  confirmedQty: 0,
  draftQty: index === 1 ? 100 : 0,
  remainingQty: index === 1 ? 0 : 100,
  uom: 'EA',
  issues: [],
  plans: [
    {
      key: `new-${index + 1}`,
      source: index === 1 ? '작성중 계획' : '신규 제안',
      date: '2026-11-06',
      quantity: '100',
      bom: 'BOM-A (Rev 1)',
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
      operations: [operation('op-10', 10, index === 1), operation('op-20', 20, false)],
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
