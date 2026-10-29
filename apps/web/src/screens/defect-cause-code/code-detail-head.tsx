import { Button, Chip, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { CodeAdapter } from './adapters';
import { isCategory } from './hierarchy';
import type { HierarchyCode } from './types';

const t = messages.defectCauseCode;

export interface CodeDetailHeadProps {
  adapter: CodeAdapter;
  code: HierarchyCode;
  /** 상위 대분류 표시(「코드 · 명칭」). 대분류면 null */
  parentLabel: string | null;
  /** 공정 표시(「공정코드 · 공정명」). 없으면 null */
  processLabel: string | null;
  /** 이 코드를 쓰는 기록 수 — 서버가 셀 수 없으면 null(칸을 내지 않는다) */
  referenceCount: number | null;
  /** 대분류를 골랐을 때만 — 이 대분류 아래에 상세를 추가하는 창을 연다 */
  onAddChild?: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
}

/**
 * 코드 상세 카드의 머리(omf-all-around#209) — 검사 기준 탭과 같은 모양(#196):
 * 첫 줄 제목 · 사용/구분 칩, 오른쪽 끝 사용 중지 · 수정. 둘째 줄 이름표 상자(코드 · 명칭 · 구분 · 상위).
 * 값은 「수정」 창에서 고친다.
 */
export const CodeDetailHead = ({
  adapter,
  code,
  parentLabel,
  processLabel,
  referenceCount,
  onAddChild,
  onEdit,
  onDeactivate,
}: CodeDetailHeadProps) => {
  const deactivateNoteId = useId();
  const orEmpty = (value: string | null | undefined): string =>
    value === null || value === undefined || value === '' ? t.values.empty : value;
  const category = isCategory(code);

  return (
    <div className="inspection-standard-plan-head-card">
      <div className="inspection-standard-plan-head">
        <div className="inspection-standard-plan-chips">
          <h2 className="pane-title">{t.detail.title(adapter.labels.tab)}</h2>
          {/* 사용 여부는 사용 중지 단추로만 바뀐다 — 값 표기로만 낸다. */}
          <Chip variant="status" status={code.isActive ? 'success' : 'idle'}>
            {code.isActive ? t.detail.chipActive : t.detail.chipInactive}
          </Chip>
        </div>
        <div className="defect-cause-head-actions">
          {onAddChild !== undefined && (
            /* 상세 추가는 이 카드의 주 동작 — 채운 빨강(사용자 지시 · #209). */
            <Button
              variant="filled"
              leadingIcon={<Icon name="add" size={18} />}
              onClick={onAddChild}
            >
              {t.actions.addChild}
            </Button>
          )}
          {/* 이미 미사용인 코드에는 중지할 대상이 없다. 감추지 않고 사유를 밝힌다(배치 규범 4). */}
          <Button
            variant="outlined"
            disabled={!code.isActive}
            aria-describedby={code.isActive ? undefined : deactivateNoteId}
            onClick={onDeactivate}
          >
            {messages.common.deactivate}
          </Button>
          <Button variant="outlined" leadingIcon={<Icon name="edit" size={18} />} onClick={onEdit}>
            {t.detail.edit}
          </Button>
        </div>
      </div>
      {!code.isActive && (
        <span id={deactivateNoteId} className="field-note">
          {t.actionReasons.deactivateNeedsActive}
        </span>
      )}
      {/* 이름표를 단 값들 — 검사 기준 탭의 기준 정보 상자와 같은 모양(#196). */}
      <dl className="inspection-standard-facts-line inspection-standard-plan-facts">
        {[
          { label: adapter.labels.code, value: code.code },
          { label: adapter.labels.name, value: code.name },
          { label: t.fields.kind, value: category ? t.detail.kindCategory : t.detail.kindChild },
          ...(parentLabel === null ? [] : [{ label: adapter.labels.parent, value: parentLabel }]),
          { label: t.fields.nameKo, value: orEmpty(code.nameKo) },
          { label: t.fields.nameVi, value: orEmpty(code.nameVi) },
          ...(adapter.hasDisposition
            ? [
                {
                  label: t.fields.disposition,
                  value:
                    code.dispositionTypeCode === null || code.dispositionTypeCode === undefined
                      ? t.values.empty
                      : t.values.disposition[code.dispositionTypeCode],
                },
              ]
            : []),
          { label: t.fields.process, value: orEmpty(processLabel) },
          ...(referenceCount === null
            ? []
            : [{ label: t.fields.referenceCount, value: t.values.referenceCount(referenceCount) }]),
        ].map((fact) => (
          <div key={fact.label}>
            <dt className="field-label">{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
