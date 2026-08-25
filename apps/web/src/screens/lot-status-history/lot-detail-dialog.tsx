import { AlertBanner, Button, Dialog, SkeletonText } from '@crefle/web-ui';

import { lookupDisplayLabelWithInactive, type LookupSource } from '../../patterns/lookup-display';
import type { FilterOption } from './lot-filter-bar';
import type { ReferenceOption } from './reference-options';
import { LotHoldDocuments } from './lot-hold-documents';
import { useLotDetail } from './queries';

const EMPTY = '—';

const formatDateTime = (value: string | null): string => {
  if (value === null) return EMPTY;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
};

const labelOf = (options: readonly FilterOption[], value: string): string =>
  options.find((option) => option.value === value)?.label ?? `${value} (목록 미확정)`;

interface LotDetailDialogProps {
  lotId: number;
  itemSource: LookupSource<ReferenceOption>;
  lotTypeOptions: readonly FilterOption[];
  statusOptions: readonly FilterOption[];
  onClose: () => void;
}

export const LotDetailDialog = ({
  lotId,
  itemSource,
  lotTypeOptions,
  statusOptions,
  onClose,
}: LotDetailDialogProps) => {
  const detail = useLotDetail(lotId);
  const retry = (
    <Button
      variant="outlined"
      size="sm"
      aria-label="LOT 상세 다시 시도"
      onClick={() => void detail.refetch()}
    >
      다시 시도
    </Button>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title="LOT 상세"
      size="lg"
      footer={
        <Button variant="outlined" onClick={onClose}>
          닫기
        </Button>
      }
    >
      {detail.isPending && (
        <div role="status" aria-label="LOT 상세를 불러오는 중">
          <SkeletonText lines={3} />
        </div>
      )}
      {detail.isError && (
        <AlertBanner variant="error" title="LOT 상세를 불러오지 못했습니다." action={retry} />
      )}
      {detail.data !== undefined && (
        <dl className="filter-bar" aria-label="LOT 속성">
          {[
            ['LOT 번호', detail.data.lotNo],
            ['품목', lookupDisplayLabelWithInactive(itemSource, detail.data.itemId)],
            ['LOT 유형', labelOf(lotTypeOptions, detail.data.lotTypeCode)],
            ['현재 상태', labelOf(statusOptions, detail.data.statusCode)],
            ['초기 수량', String(detail.data.initialQty)],
            ['유효기한', detail.data.expiryDate ?? EMPTY],
            ['제조 시각', formatDateTime(detail.data.manufacturedAt)],
          ].map(([label, value]) => (
            <div className="field-cell" key={label}>
              <dt className="field-label">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <LotHoldDocuments key={lotId} lotId={lotId} />

      <div className="form-actions">
        <Button disabled>판정·전이 처리</Button>
        <p className="field-note">W-03-02 화면이 제공되면 사용할 수 있습니다.</p>
      </div>
      <p className="field-note">의심자재 등록은 W-03-03 화면에서 진행하세요.</p>
    </Dialog>
  );
};
