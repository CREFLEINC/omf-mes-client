import { AlertBanner, Button, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { countOutsideBomLines } from './bom-origin';
import { LineTable } from './line-table';
import type { ItemLookupResult, LookupResult } from './lookups';
import type { MaterialIssueLineDraft, SelectOption } from './types';

const t = messages.materialIssueRequest;

export interface LinePaneProps {
  rows: MaterialIssueLineDraft[];
  errors: Record<string, string>;
  itemLookup: ItemLookupResult;
  uomLookup: LookupResult;
  itemOptions: SelectOption[];
  uomOptions: SelectOption[];
  isLocked: boolean;
  /** 소요 조회가 도는 중인가 */
  isLoadingShortage: boolean;
  /** 소요 조회 실패 배너. 실패해도 **이미 채워진 줄을 지우지 않는다** */
  shortageErrorBanner: ReactNode;
  /**
   * 서버가 요청 품목 전체를 거부했을 때의 문구(계약 `lines`).
   *
   * ⭐ **이 자리가 없으면 그 거부가 통째로 사라진다** — 공용 쓰기 훅이 화면이 아는 이름을 배너에서
   * 빼내 인라인으로 넘기기 때문이다(`HEADER_FORM_FIELDS` 주석). 수량 하한·BOM 정합·중복 줄처럼
   * **서버만 아는 판정**이 이 이름으로 온다.
   */
  linesError?: string;
  onLoadShortage: () => void;
  onAddLine: () => void;
  onPatchLine: (key: string, patch: Partial<Omit<MaterialIssueLineDraft, 'key'>>) => void;
  onRemoveLine: (key: string) => void;
}

/**
 * 구획 ② — 요청 품목.
 *
 * ⛔ **자재 명세(BOM)를 직접 조회하지 않는다.** 「BOM 소요량 불러오기」 한 번이 소요·기출고·부족
 * 세 열을 채운다(요구서 §3-9 명시).
 *
 * **BOM 밖 품목은 경고만 하고 막지 않는다**(스펙 §5-3) — 투입 단계의 오투입 검증이 판정할
 * 일이지 이 화면이 판정할 일이 아니다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const LinePane = ({
  rows,
  errors,
  itemLookup,
  uomLookup,
  itemOptions,
  uomOptions,
  isLocked,
  isLoadingShortage,
  shortageErrorBanner,
  linesError,
  onLoadShortage,
  onAddLine,
  onPatchLine,
  onRemoveLine,
}: LinePaneProps) => {
  const outsideBomCount = countOutsideBomLines(rows);

  return (
    <section className="pane" aria-label={t.panes.lines}>
      <div className="form-actions">
        <Button
          variant="outlined"
          disabled={isLocked || isLoadingShortage}
          onClick={onLoadShortage}
        >
          {t.actions.loadShortage}
        </Button>
      </div>

      {shortageErrorBanner}

      {linesError !== undefined && <span className="field-error">{linesError}</span>}

      {isLoadingShortage ? (
        <div role="status" aria-label={t.loading.shortage}>
          <SkeletonText lines={3} />
        </div>
      ) : (
        <LineTable
          rows={rows}
          errors={errors}
          itemLookup={itemLookup}
          uomLookup={uomLookup}
          itemOptions={itemOptions}
          uomOptions={uomOptions}
          isLocked={isLocked}
          onPatch={onPatchLine}
          onRemove={onRemoveLine}
        />
      )}

      <p className="field-note">{t.notes.shortageColumnsReadOnly}</p>
      <p className="field-note">{t.notes.lineNoAssignedByServer}</p>

      <div className="filter-bar">
        <div className="field-cell">
          <Button variant="outlined" disabled={isLocked} onClick={onAddLine}>
            {t.actions.addLine}
          </Button>
        </div>
      </div>

      {outsideBomCount > 0 && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.warnings.outsideBomTitle}>
            {t.warnings.outsideBomCount(outsideBomCount)}
          </AlertBanner>
        </div>
      )}
    </section>
  );
};
