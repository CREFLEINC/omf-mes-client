import { Button, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

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
  /** 대분류를 골랐을 때만 — 이 대분류 아래에 상세를 추가하는 창을 연다 */
  onAddChild?: () => void;
}

/**
 * 코드 상세 카드의 머리(omf-all-around#209) — 검사 기준 탭과 같은 모양(#196):
 * 첫 줄 제목 · 오른쪽 끝 하위 코드 추가. 둘째 줄 이름표 상자(코드 · 명칭 · 구분 · 상위).
 * 사용 여부 · 사용된 기록 · 사용 중지 · 수정은 목록 줄로 옮겼다(사용자 지시 · #360).
 */
export const CodeDetailHead = ({
  adapter,
  code,
  parentLabel,
  processLabel,
  onAddChild,
}: CodeDetailHeadProps) => {
  const orEmpty = (value: string | null | undefined): string =>
    value === null || value === undefined || value === '' ? t.values.empty : value;
  const category = isCategory(code);

  return (
    <div className="inspection-standard-plan-head-card">
      <div className="inspection-standard-plan-head">
        <div className="inspection-standard-plan-chips">
          <h2 className="pane-title">{t.detail.title(adapter.labels.tab)}</h2>
        </div>
        <div className="defect-cause-head-actions">
          {/* 미사용 코드에는 하위 코드 추가 · 사용 중지를 내지 않는다(대신 재사용) — 안내 문구도 두지 않는다(사용자 지시 · #209). */}
          {code.isActive && onAddChild !== undefined && (
            /* 상세 추가는 이 카드의 주 동작 — 채운 빨강(사용자 지시 · #209). */
            <Button
              variant="filled"
              leadingIcon={<Icon name="add" size={18} />}
              onClick={onAddChild}
            >
              {t.actions.addChild}
            </Button>
          )}
        </div>
      </div>
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
