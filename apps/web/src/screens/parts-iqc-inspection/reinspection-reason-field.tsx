import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { Select } from '../../patterns/select';
import { FieldLabel } from '../iqc-inspection/field-label';
import type { OverriddenLot } from './lot-judgment';
import { judgmentText, lotTail } from './result-list';

const t = messages.iqcInboundLot.drawer;

/** 재검 사유 칸의 문구 — 기본은 IQC(자재 관리 LOT). 출하 OQC 는 피킹 LOT 문구를 넘긴다(피처 010). */
export interface ReinspectionReasonText {
  reasonHeading: string;
  reasonHelp: string;
  reasonLine: (lotTail: string, seqNo: number, before: string, after: string) => string;
  reasonPlaceholder: string;
  reasonLoadFailed: string;
}

/** 재검 사유 공통코드 그룹 — 고객이 늘릴 수 있는 열린 그룹(계약 `REINSPECTION_REASON` · 공유계약 G-32). */
export const REINSPECTION_REASON_GROUP = 'REINSPECTION_REASON';

/** 재검 사유 선택지 — 쓰는 값만, 표시 순서대로. 드로어가 열려 있는 동안 한 번 읽는다. */
export const useReinspectionReasons = (enabled: boolean) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['iqc-inbound-lot', 'reinspection-reasons'] as const,
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: REINSPECTION_REASON_GROUP, size: 100 } },
        }),
      );

      return data.items
        .filter((value) => value.isActive)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((value) => ({ value: value.code, label: value.codeName }));
    },
  });
};

export interface ReinspectionReasonFieldProps {
  /** 사유가 필요한 까닭 — 이 결과가 판정을 더 낫게 바꾸는 LOT 들. */
  overridden: readonly OverriddenLot[];
  lotNoOf: (lotId: number) => string;
  /** 이 결과의 판정(이미 골라졌다 — 고르지 않았으면 이 칸이 서지 않는다). */
  judgmentCode: string;
  value: string | null;
  error: string | null;
  disabled?: boolean;
  onChange: (code: string) => void;
  /** 문구 — 기본은 IQC. */
  text?: ReinspectionReasonText;
  /** LOT 번호 표기 — 기본은 끝 마디(같은 입하 LOT 의 LOT 은 끝만 다르다). 출하 OQC 는 번호 전체. */
  lotLabel?: (lotNo: string) => string;
}

/**
 * 재검 사유(FR-023a · 2026-11-12) — 이 결과가 어떤 자재 관리 LOT 의 판정을 불합격 → 보류 · 합격, 보류 → 합격으로 바꿀 때만 서고
 * 필수다. 공통코드 `REINSPECTION_REASON` 에서 고른다(옛 재검사 회차의 `reinspectionReasonCode` 와 같은 값). 까닭을 LOT 마다 한 줄로 보인다.
 */
export const ReinspectionReasonField = ({
  overridden,
  lotNoOf,
  judgmentCode,
  value,
  error,
  disabled = false,
  onChange,
  text = t,
  lotLabel = lotTail,
}: ReinspectionReasonFieldProps) => {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const reasons = useReinspectionReasons(true);
  const describedBy = [helpId, ...(error === null ? [] : [errorId])].join(' ');

  return (
    <section className="parts-iqc-card iqc-inbound-reason" aria-labelledby={`${id}-head`}>
      <h3 id={`${id}-head`} className="parts-iqc-sub-title">
        {text.reasonHeading}
      </h3>
      <div id={helpId} className="field-note">
        <p>{text.reasonHelp}</p>
        <ul className="iqc-inbound-reason-lines">
          {overridden.map((lot) => (
            <li key={lot.lotId}>
              {text.reasonLine(
                lotLabel(lotNoOf(lot.lotId)),
                lot.previousSeqNo,
                judgmentText(lot.previousJudgmentCode),
                judgmentText(judgmentCode),
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="field-cell">
        <FieldLabel htmlFor={id} label={text.reasonHeading} required />
        <Select
          id={id}
          options={reasons.data ?? []}
          value={value}
          placeholder={text.reasonPlaceholder}
          disabled={disabled || reasons.data === undefined}
          invalid={error !== null}
          aria-required
          aria-describedby={describedBy}
          onChange={onChange}
        />
        {reasons.isError ? <span className="field-error">{text.reasonLoadFailed}</span> : null}
        {error === null ? null : (
          <span id={errorId} className="field-error" role="alert">
            {error}
          </span>
        )}
      </div>
    </section>
  );
};
