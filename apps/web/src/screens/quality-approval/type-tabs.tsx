import { Tabs } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { CodeOption } from './code-options';

export interface TypeTabsProps {
  options: CodeOption[];
  value: string;
  onChange: (value: string) => void;
}

/** 「전체」 탭의 값 — 탭 식별자는 빈 문자열을 쓰지 않는다. 조건으로는 `''`(유형 조건 없음)이다. */
const ALL = 'all';

/**
 * 승인 유형 탭(#144) — 누르면 바로 그 유형으로 다시 조회한다. 불량·원인코드 화면과 같은 밑줄 탭이다.
 * 목록은 탭 아래에 그대로 서므로 탭마다 패널을 따로 두지 않는다.
 * 고를 유형이 없으면(기준값 미준비) 서지 않는다 — 그때는 범위 안내 배너가 대신 말한다.
 */
export const TypeTabs = ({ options, value, onChange }: TypeTabsProps) => {
  const t = messages.qualityApproval;
  if (options.length === 0) return null;

  return (
    <Tabs
      className="quality-approval-type-tabs"
      aria-label={t.fields.approvalTypeCode}
      value={value === '' ? ALL : value}
      onChange={(next) => onChange(next === ALL ? '' : next)}
      items={[{ value: ALL, label: t.all }, ...options].map((option) => ({
        value: option.value,
        label: option.label,
        content: null,
      }))}
    />
  );
};
