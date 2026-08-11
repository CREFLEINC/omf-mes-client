import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupNote, type LookupResult } from './lookups';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.stocktaking;

export interface LocationFieldProps {
  /** 고른 실사의 창고로 좁혀 받은 위치. **화면이 선택지로 옮겨 넘긴다.** */
  lookup: LookupResult;
  options: SelectOption[];
  /** 주소의 `loc`. 비어 있으면 아직 고르지 않은 것이다. */
  value: string;
  /** 전송 중인가. 위치를 바꾸면 **앞 요청의 결과가 다른 위치의 맥락에 나타난다.** */
  isLocked: boolean;
  onChange: (locationId: number | null) => void;
  onRetry: () => void;
}

/**
 * 결과 등록의 **축을 고르는 칸**.
 *
 * 치환은 위치 단위라(계약) 이 칸을 고르기 전에는 라인을 부르지 않는다(완료 조건 C31).
 * 조회 조건이 아니라 **무엇을 저장할지 정하는 칸**이라 조건 줄이 아니라 아래 구획에 선다 —
 * 조건 줄에 두면 「좁혀 보는 조건」으로 읽히고, 그 오해가 이 화면에서는 위험하다:
 * 치환은 좁혀 받은 목록을 그대로 덮어써 **보이지 않던 줄을 미실사로 되돌린다.**
 *
 * **「고르지 않음」을 값이 빈 선택지로 둔다.** 두지 않으면 한 번 고른 뒤에 해제할 방법이 칸
 * 안에 없어지고, 사용자는 라인 구획을 닫으려고 실사 선택을 풀게 된다. 여기서는 **빈 값도 고른
 * 값**이라 자리표시로 대신하지 않는다.
 *
 * **조건 줄의 「전체」를 재사용하지 않는다**(리뷰 R-5). 자리는 같아 보여도 뜻이 다르다 —
 * 조건 줄의 「전체」는 「좁히지 않는다」이고, 여기서 그렇게 읽히면 「**전체 위치**를 대상으로
 * 한다」가 된다. 이 부품이 조건 줄을 떠난 이유가 바로 그 독법을 없애려는 것이었다.
 *
 * **실패의 복구 버튼이 이 칸에 붙는다**(계획 결정 17). 위치를 못 받으면 라인 표 자체가 열리지
 * 않으므로 표 아래에 두면 **보이지도 않는 실패의 복구 버튼**이 된다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const LocationField = ({
  lookup,
  options,
  value,
  isLocked,
  onChange,
  onRetry,
}: LocationFieldProps) => (
  <>
    <SelectField
      wide
      label={t.fields.location}
      options={[{ value: '', label: t.values.locationNotChosen }, ...options]}
      value={value}
      note={lookupNote(lookup)}
      disabled={isLocked}
      onChange={(next) => {
        onChange(next === '' ? null : Number(next));
      }}
    />

    {lookup.isError && (
      <div className="field-cell">
        <span className="field-note">{t.reasons.locationReferenceFailed}</span>
        <Button variant="outlined" size="sm" disabled={isLocked} onClick={onRetry}>
          {messages.common.retry}
        </Button>
      </div>
    )}
  </>
);
