import { Button, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import type { CodeValueFormValues } from './code-value-types';
import { DisabledAction } from './disabled-action';

const t = messages.commonCode.codeValue;

export interface CodeValueDetailPaneProps {
  /** 저장된 값(폼의 기준값). 고치는 중인 값이 아니다. */
  values: CodeValueFormValues;
  /** null이면 사용 중지를 누를 수 있다. 값이 있으면 그것이 비활성 사유다. */
  deactivateDisabledReason: string | null;
  onDeactivate: () => void;
  onEdit: () => void;
}

/** 라벨과 값 한 쌍 — 작업자 상세와 같은 모양. **폼 컨트롤이 아니다.** */
const ValueField = ({ label, value }: { label: string; value: ReactNode }) => {
  const labelId = useId();

  return (
    <div className="field-cell">
      <span className="field-label" id={labelId}>
        {label}
      </span>
      <div aria-labelledby={labelId}>{value}</div>
    </div>
  );
};

/** 값이 없는 칸을 비워 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string): string => (value === '' ? t.values.empty : value);

/**
 * 우 칸 아래 — 고른 코드값 정보를 **읽기 전용**으로 보인다(사용자 지시 2026-11-25).
 * 고치려면 [수정]을 눌러 종전 편집 폼으로 바꾼다. 칸 이름 · 배치는 편집 폼과 같다.
 *
 * 코드값 편집 한 벌의 부품이다 — 다른 자원의 부품·타입·주소를 참조하지 않는다.
 */
export const CodeValueDetailPane = ({
  values,
  deactivateDisabledReason,
  onDeactivate,
  onEdit,
}: CodeValueDetailPaneProps) => (
  <section className="pane" aria-label={t.formPaneTitle}>
    <div className="form-grid">
      <ValueField label={t.fields.code} value={orEmptyMark(values.code)} />
      <ValueField label={t.fields.codeName} value={orEmptyMark(values.codeName)} />
      <ValueField label={t.fields.displayOrder} value={orEmptyMark(values.displayOrder)} />
      <ValueField label={t.fields.effectiveFrom} value={orEmptyMark(values.effectiveFrom)} />
      <ValueField label={t.fields.effectiveTo} value={orEmptyMark(values.effectiveTo)} />
    </div>

    <div className="form-actions">
      {/* 사용 중지는 편집 폼과 같은 자리 · 같은 동작(확인 창)이다. */}
      {deactivateDisabledReason === null ? (
        <div className="field-cell form-actions-secondary">
          <Button variant="outlined" size="sm" onClick={onDeactivate}>
            {messages.common.deactivate}
          </Button>
        </div>
      ) : (
        <DisabledAction
          label={messages.common.deactivate}
          reason={deactivateDisabledReason}
          className="form-actions-secondary"
          size="sm"
        />
      )}

      {/* 상세 카드의 [수정]과 같은 모양(불량 원인 코드 상세). */}
      <Button variant="outlined" leadingIcon={<Icon name="edit" size={18} />} onClick={onEdit}>
        {t.actions.edit}
      </Button>
    </div>
  </section>
);
