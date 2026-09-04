import { AlertBanner, SkeletonText, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import type { CodeOption } from './options';
import {
  appliedRatio,
  cavityMismatch,
  cavityOf,
  matchedScopeText,
  parseQuantity,
  shotCount,
} from './preview';
import { SelectField } from './select-field';
import type { Mold, OperationPolicyEffective } from './types';

const t = messages.shotConversion.preview;

interface ReadOnlyRowProps {
  label: string;
  value: string;
  note?: string;
}

/** 값을 보여 주기만 하는 줄. 미리보기는 고치는 자리가 아니다. */
const ReadOnlyRow = ({ label, value, note }: ReadOnlyRowProps) => {
  const labelId = useId();

  return (
    <div className="field-cell">
      <span className="field-label" id={labelId}>
        {label}
      </span>
      <p aria-labelledby={labelId}>{value}</p>
      {note !== undefined && <span className="field-note">{note}</span>}
    </div>
  );
};

export interface PreviewPaneProps {
  toolId: string;
  onChangeTool: (toolId: string) => void;
  itemId: string;
  onChangeItem: (itemId: string) => void;
  processId: string;
  onChangeProcess: (processId: string) => void;
  quantity: string;
  onChangeQuantity: (quantity: string) => void;
  toolOptions: CodeOption[];
  itemOptions: CodeOption[];
  processOptions: CodeOption[];
  /** 고른 툴. 캐비티 수가 여기서 온다 */
  tool: Mold | null;
  /** 서버가 준 판정. 아직 안 물었으면 `null` */
  effective: OperationPolicyEffective | null;
  isLoading: boolean;
  isError: boolean;
}

/**
 * 미리보기 — **범위 해석을 서버가 한다.**
 *
 * ⛔ **화면이 우선순위를 다시 구현하지 않는다**(스펙 §5-2 · 공유계약 B-17). 서버가 답과
 * **그 근거**(어느 축으로 맞았는가)를 함께 주고, 화면은 그것으로 셈만 한다.
 *
 * ⛔ **적용 정책이 없으면 「1.0」으로 채우지 않는다**(G-9) — 없는 정책을 있는 것으로 만들면
 * **계산이 조용히 돌고** 사용자는 환산이 되는 줄 안다.
 */
export const PreviewPane = ({
  toolId,
  onChangeTool,
  itemId,
  onChangeItem,
  processId,
  onChangeProcess,
  quantity,
  onChangeQuantity,
  toolOptions,
  itemOptions,
  processOptions,
  tool,
  effective,
  isLoading,
  isError,
}: PreviewPaneProps) => {
  const ratio = appliedRatio(effective);
  const cavity = cavityOf(tool);
  const parsedQuantity = parseQuantity(quantity);
  const shots = shotCount(parsedQuantity, ratio);
  const mismatch = cavityMismatch(cavity, ratio);
  const matched = matchedScopeText(effective);

  const result = (): ReactNode => {
    if (isError) {
      return (
        <div className="form-grid-full">
          <div className="banner-slot">
            <AlertBanner variant="error">{t.loadFailed}</AlertBanner>
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="form-grid-full" role="status" aria-label={t.loading}>
          <SkeletonText lines={2} />
        </div>
      );
    }

    /* ⛔ 없는 정책을 지어내지 않는다 — 없다는 사실이 곧 「환산 불가」다. */
    if (ratio === null) {
      return (
        <div className="form-grid-full">
          <div className="banner-slot">
            <AlertBanner variant="warning" title={t.unresolvedTitle}>
              {t.unresolved}
            </AlertBanner>
          </div>
        </div>
      );
    }

    return (
      <>
        <ReadOnlyRow
          label={t.ratioLabel}
          value={String(ratio)}
          note={matched === null ? undefined : t.matchedBy(matched)}
        />
        <ReadOnlyRow
          label={t.cavityLabel}
          value={cavity === null ? t.cavityNeedsTool : String(cavity)}
          note={cavity === null ? undefined : t.cavitySource}
        />

        {/*
         * ⚠ **두 값이 서로 다른 곳에 있어 어긋날 수 있다**(툴 마스터 · 정책).
         * ⛔ 고쳐 주지 않는다 — 어느 쪽이 맞는지 화면이 알 수 없다. 알리기만 한다.
         */}
        {mismatch !== null && (
          <div className="form-grid-full">
            <div className="banner-slot">
              <AlertBanner variant="warning">{mismatch}</AlertBanner>
            </div>
          </div>
        )}

        {shots === null ? (
          <div className="form-grid-full">
            <p className="dialog-lead">
              {parsedQuantity === null && quantity.trim() !== ''
                ? t.quantityNumber
                : t.needsQuantity}
            </p>
          </div>
        ) : (
          <ReadOnlyRow
            label={t.shotLabel}
            value={t.shotCount(shots)}
            /* ⭐ 셈을 그대로 보인다 — 결과만 보이면 왜 그 수인지 알 수 없다. */
            note={`${t.formula(parsedQuantity ?? 0, ratio, shots)}${
              cavity === null ? '' : ` · ${t.cavityNote(cavity)}`
            }`}
          />
        )}
      </>
    );
  };

  return (
    <section className="pane shot-conversion-pane" aria-label={t.paneTitle}>
      <h2 className="pane-title">{t.paneTitle}</h2>
      <p className="dialog-lead">{t.description}</p>

      {/*
       * ⭐ **입력과 결과를 한 격자에 둔다.** 격자를 둘로 나눠 붙이면 그 사이만 간격이 없어
       * 결과 줄의 라벨이 위 칸에 붙어 읽히고, 안쪽 격자가 바깥 칸 하나에 갇혀 폭이 반이 된다
       * (브라우저 확인 실측). 한 격자면 리듬이 한 벌이다.
       */}
      <div className="form-grid shot-conversion-preview-grid">
        <SelectField
          label={t.toolLabel}
          options={toolOptions}
          value={toolId}
          onChange={onChangeTool}
          placeholder={t.toolPlaceholder}
        />
        <SelectField
          label={t.itemLabel}
          options={[{ value: '', label: t.anyScope }, ...itemOptions]}
          value={itemId}
          onChange={onChangeItem}
        />
        <SelectField
          label={t.processLabel}
          options={[{ value: '', label: t.anyScope }, ...processOptions]}
          value={processId}
          onChange={onChangeProcess}
        />
        <TextField
          label={t.quantityLabel}
          value={quantity}
          onChange={(event) => onChangeQuantity(event.target.value)}
          placeholder={t.quantityPlaceholder}
        />

        {result()}
      </div>
    </section>
  );
};
