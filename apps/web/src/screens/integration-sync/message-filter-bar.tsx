import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { validatePeriod, type PeriodInput } from './period';

const t = messages.integrationSync;

export interface MessageFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 기간. 편집 중인 값은 이 부품 안에만 있다. */
  appliedPeriod: PeriodInput;
  onSearch: (period: PeriodInput) => void;
  onReset: () => void;
}

/**
 * 조회 조건 줄.
 *
 * 트리거 모델은 「모아서 적용」이다 — 날짜를 고치는 동안 조회가 나가면 반쯤 지운 기간으로
 * 요청이 나간다. 「조회」를 누를 때만 주소가 바뀌고 그때 조회된다.
 */
export const MessageFilterBar = ({ appliedPeriod, onSearch, onReset }: MessageFilterBarProps) => {
  const reasonId = useId();

  const [draft, setDraft] = useState<PeriodInput>(appliedPeriod);
  useEffect(() => {
    setDraft(appliedPeriod);
  }, [appliedPeriod]);

  /** 기간이 갖춰지지 않으면 조회를 막고 사유를 밝힌다 — 계약이 기간을 필수로 두었다. */
  const searchReason = validatePeriod(draft);

  return (
    <div className="filter-bar">
      <TextField
        type="date"
        label={t.fields.periodFrom}
        value={draft.from}
        onChange={(event) => setDraft((prev) => ({ ...prev, from: event.target.value }))}
      />
      <TextField
        type="date"
        label={t.fields.periodTo}
        value={draft.to}
        onChange={(event) => setDraft((prev) => ({ ...prev, to: event.target.value }))}
      />
      {/*
       * 조회와 초기화는 짝이라 함께 줄바꿈되게 묶고(배치 규범 2-1), 비활성 사유는 그 아래에 둔다.
       * 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더해 aria-describedby로 잇는다 —
       * 비활성 컨트롤은 포커스를 받지 못해 툴팁만으로는 키보드·보조기술 사용자가 닿을 수 없다.
       */}
      <div className="field-cell field-cell-unlabeled">
        <div className="filter-actions">
          <Button
            disabled={searchReason !== null}
            aria-describedby={searchReason === null ? undefined : reasonId}
            onClick={() => onSearch(draft)}
          >
            {messages.common.search}
          </Button>
          <Button variant="outlined" onClick={onReset}>
            {messages.common.reset}
          </Button>
        </div>
        {searchReason !== null && (
          <span id={reasonId} className="field-note">
            {searchReason}
          </span>
        )}
      </div>
    </div>
  );
};
