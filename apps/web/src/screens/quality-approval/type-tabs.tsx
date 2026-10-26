import { Chip, Tabs } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { toTypeOptions, type CodeOption } from './code-options';

/** 품질 승인 처리 목록 주소 — IQC 생략 화면의 다른 유형 탭이 이리로 돌아온다. */
export const QUALITY_APPROVALS_PATH = '/quality/approvals';
/** 긴급 IQC 생략 한도승인 화면(W-01-02) — 「IQC (수입검사) 생략」 탭이 이 화면이다(#144). */
export const IQC_SKIP_APPROVAL_PATH = '/logistics/iqc-skip-approval';
export const IQC_SKIP_TYPE_CODE = 'IQC_SKIP';

/**
 * 유형 탭 선택지 — 이 화면의 유형에 IQC 생략 탭을 OQC 생략 앞에 끼운다(IQC → OQC 흐름 차례).
 * 그 화면을 볼 권한이 없으면(`withIqcSkip` 거짓) 끼우지 않는다 — 누르는 순간 막힌 화면이 선다.
 */
export const toTypeTabOptions = (codes: readonly string[], withIqcSkip = true): CodeOption[] => {
  if (!withIqcSkip) return toTypeOptions(codes);
  const at = codes.indexOf('OQC_SKIP');
  const ordered =
    at === -1
      ? [...codes, IQC_SKIP_TYPE_CODE]
      : [...codes.slice(0, at), IQC_SKIP_TYPE_CODE, ...codes.slice(at)];
  return toTypeOptions(ordered);
};

export interface TypeTabsProps {
  options: CodeOption[];
  value: string;
  onChange: (value: string) => void;
  /** 탭 줄 오른쪽 끝(#186) — 입하 예정 조회의 단계 칩 자리와 같다. */
  trailing?: ReactNode;
}

/** 「전체」 탭의 값 — 탭 식별자는 빈 문자열을 쓰지 않는다. 조건으로는 `''`(유형 조건 없음)이다. */
const ALL = 'all';

/**
 * 승인 유형 탭(#144) — 누르면 바로 그 유형으로 다시 조회한다. 불량·원인코드 화면과 같은 밑줄 탭이다.
 * 목록은 탭 아래에 그대로 서므로 탭마다 패널을 따로 두지 않는다.
 * 고를 유형이 없으면(기준값 미준비) 탭은 서지 않는다 — 그때는 범위 안내 배너가 대신 말한다.
 */
export const TypeTabs = ({ options, value, onChange, trailing }: TypeTabsProps) => {
  const t = messages.qualityApproval;
  if (options.length === 0 && trailing === undefined) return null;

  return (
    <div className="quality-approval-type-bar">
      {options.length > 0 && (
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
      )}
      {trailing !== undefined && <div className="quality-approval-type-bar-tools">{trailing}</div>}
    </div>
  );
};

export interface PendingChipProps {
  /** 지금 「결재 대기만 보기」가 걸렸는가. */
  selected: boolean;
  /** 지금 조건의 결재 대기 건수. 아직 모르면(조회 중·실패) 이름만 보인다. */
  count: number | undefined;
  onChange: (selected: boolean) => void;
}

/**
 * 「결재 대기 3」 칩(#186) — 조회 조건 칸의 「결재 대기만 보기」 체크를 탭 줄 오른쪽으로 옮긴 것이다(입하 예정
 * 조회의 단계 칩과 같은 모양). 누르면 결재 대기만 남고, 다시 누르면 풀린다. 상태 기준값이 확정되지 않아
 * 승인·반려 칩은 세우지 않는다.
 */
export const PendingChip = ({ selected, count, onChange }: PendingChipProps) => {
  const t = messages.qualityApproval;

  return (
    <Chip
      variant="filter"
      size="sm"
      selected={selected}
      aria-pressed={selected}
      aria-label={selected ? t.pendingChip.filterOff : t.fields.pendingOnly}
      onSelectedChange={onChange}
    >
      {count === undefined ? t.pendingChip.label : t.pendingChip.count(count)}
    </Chip>
  );
};
