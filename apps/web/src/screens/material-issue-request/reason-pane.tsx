import { Button, Radio, RadioGroup, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { LookupResult } from './lookups';

const t = messages.materialIssueRequest;

export interface ReasonPaneProps {
  reasons: LookupResult;
  reasonCode: string;
  onChangeReason: (value: string) => void;
  remarks: string;
  onChangeRemarks: (value: string) => void;
  /**
   * 서버가 사유를 거부했을 때의 문구.
   *
   * ⭐ **이 자리가 없으면 그 거부가 통째로 사라진다** — 공용 쓰기 훅이 화면이 아는 이름을 배너에서
   * 빼내 인라인으로 넘기기 때문이다(`HEADER_FORM_FIELDS` 주석).
   */
  reasonError?: string;
  /** 서버가 준 비고 오류(있으면) */
  remarksError?: string;
  isLocked: boolean;
}

/**
 * 구획 ③ — 요청 사유와 비고.
 *
 * ⭐ **사유 선택기는 항상 활성이다.** 이 그룹은 값이 확정된 고객 마스터(G-31)라 「값 미확정 →
 * 비활성」 패턴을 적용하면 틀린다. 코드값이 0건으로 오거나 조회가 실패해도 **잠그지 않는다** —
 * 비고만으로도 발행할 수 있기 때문이다(스펙 §5-6 의 「또는」).
 *
 * ⛔ **「값 목록 준비 중」·「화면 미완성」으로 읽힐 문구를 쓰지 않는다.** 고를 사유가 없는 것은
 * 마스터의 사실이지 화면의 결함이 아니다.
 *
 * `RadioGroup` 은 `name` 을 필수로 받는다(설치본 실측) — `useId()` 로 만들어 같은 화면에 그룹이
 * 둘 서도 서로를 밀어내지 않게 한다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const ReasonPane = ({
  reasons,
  reasonCode,
  onChangeReason,
  remarks,
  onChangeRemarks,
  reasonError,
  remarksError,
  isLocked,
}: ReasonPaneProps) => {
  const groupName = useId();
  const reasonErrorId = useId();

  return (
    <section className="pane" aria-label={t.panes.reason}>
      <div className="field-cell">
        <span className="field-label">{t.formFields.reason}</span>
        <RadioGroup
          name={groupName}
          orientation="horizontal"
          value={reasonCode}
          disabled={isLocked}
          aria-label={t.formFields.reason}
          aria-describedby={reasonError === undefined ? undefined : reasonErrorId}
          onChange={onChangeReason}
        >
          {reasons.entries.map((entry) => (
            <Radio key={entry.value} value={entry.value}>
              {entry.label}
            </Radio>
          ))}
        </RadioGroup>

        {/* 배치 규범 3·4 — 오류는 항상 보이는 DOM 텍스트로 두고 `aria-describedby` 로 잇는다. */}
        {reasonError !== undefined && (
          <span id={reasonErrorId} className="field-error">
            {reasonError}
          </span>
        )}

        {reasons.isError ? (
          <span className="field-note">
            {t.codes.reasonFailed}{' '}
            <Button variant="text" size="sm" onClick={reasons.refetch}>
              {t.actions.retry}
            </Button>
          </span>
        ) : (
          !reasons.isLoading &&
          reasons.entries.length === 0 && <span className="field-note">{t.codes.reasonEmpty}</span>
        )}
      </div>

      <div className="field-cell">
        <TextField
          fullWidth
          label={t.formFields.remarks}
          value={remarks}
          disabled={isLocked}
          error={remarksError}
          onChange={(event) => {
            onChangeRemarks(event.target.value);
          }}
        />
      </div>
    </section>
  );
};
