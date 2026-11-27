import { ReviewHelp } from '../proposal-review/review-help';
import './release-review.css';
import './release-materials.css';
import type { MaterialComponents } from '@omf-mes/api-client';
import { AlertBanner, Button, TextField } from '@crefle/web-ui';
import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { useApiClient } from '../../../patterns/api-context';
import { runRequest } from '../../../patterns/request';
import { messages } from '@omf-mes/i18n';
import type { ReleaseTarget } from '../release-runner';
import type { SectionCheck } from './release-checks';
import { AdjustableNativeTable } from './adjustable-table';
import {
  AvailabilityError,
  AvailabilityStatusCell,
  AvailableCell,
  useMaterialAvailability,
  type AvailabilityRequest,
} from './material-availability';

const c = messages.erpWorkOrderFlow.process.release.checks;

export type MaterialRequirement = MaterialComponents['schemas']['WorkOrderMaterialRequirement'];
export type MaterialConfirmation = NonNullable<
  MaterialComponents['schemas']['WorkOrderRelease']['materialUomConfirmations']
>[number];
export type MaterialConfirmations = Record<number, MaterialConfirmation[]>;
const decimal = (value: string | number): [bigint, bigint] => {
  const [whole = '0', exponent = '0'] = String(value).toLowerCase().split('e');
  const fraction = whole.split('.')[1]?.length ?? 0;
  const power = Number(exponent) - fraction;
  const digits = BigInt(whole.replace('.', ''));
  return power >= 0 ? [digits * 10n ** BigInt(power), 1n] : [digits, 10n ** BigInt(-power)];
};
export const normalizedRate = (text: string): number | null => {
  if (!/^\d+(\.\d*)?$/.test(text.trim()) || !Number.isFinite(Number(text))) return null;
  const [n, d] = decimal(text.trim());
  const rounded = (n * 100000000n * 2n + d) / (d * 2n);
  const value = Number(rounded) / 1e8;
  return value > 0 && Number.isFinite(value) ? value : null;
};
export const stockQuantity = (qty: number, rate: number, scale: number): string => {
  const [q, qd] = decimal(qty),
    [r, rd] = decimal(rate);
  const unit = 10n ** BigInt(scale);
  const denominator = qd * r;
  const rounded = (q * rd * unit + denominator - 1n) / denominator;
  return scale === 0
    ? String(rounded)
    : `${rounded / unit}.${String(rounded % unit).padStart(scale, '0')}`;
};
export const editableRate = (row: MaterialRequirement) =>
  row.conversionSource === 'NONE' ||
  (row.conversionSource === 'COMMON' &&
    [row.bomUomCode, row.stockUomCode].every((code) => ['EA', 'PC'].includes(code)));
const quantityText = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 20 });
interface Choice {
  rate: string | null;
}
export const useReleaseMaterials = (targets: readonly ReleaseTarget[], enabled: boolean) => {
  const { client } = useApiClient();
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const queries = useQueries({
    queries: targets.map((target) => ({
      queryKey: ['work-orders', 'release-materials', target.workOrderId],
      enabled,
      retry: false,
      queryFn: () =>
        runRequest(() =>
          client.GET('/production/work-orders/{workOrderId}/material-requirements', {
            params: { path: { workOrderId: target.workOrderId } },
          }),
        ),
    })),
  });
  const groups = targets.map((target, index) => {
    const query = queries[index]!;
    const rows = query.data?.items ?? [];
    const signature = JSON.stringify(rows);
    return {
      target,
      query,
      rows: rows.map((row) => {
        const key = `${target.workOrderId}:${signature}:${row.bomComponentId}`;
        const choice = choices[key] ?? { rate: null };
        const rate = choice.rate === null ? row.conversionRate : normalizedRate(choice.rate);
        return {
          row,
          choice,
          rate,
          set: (patch: Partial<Choice>) =>
            setChoices((current) => ({ ...current, [key]: { ...choice, ...patch } })),
        };
      }),
    };
  });
  const availability = useMaterialAvailability(
    groups.flatMap(({ target, rows }) =>
      rows.flatMap(({ row }) => {
        const request = availabilityRequestOf(target, row);
        return request === null ? [] : [request];
      }),
    ),
  );
  const ready =
    !enabled ||
    groups.every(
      (group) =>
        group.query.isSuccess &&
        !group.query.isFetching &&
        group.rows.every(({ row, rate }) => !row.confirmationRequired || rate !== null),
    );
  const confirmations: MaterialConfirmations = Object.fromEntries(
    groups.map((group) => [
      group.target.workOrderId,
      group.rows
        .filter(({ row }) => row.confirmationRequired)
        .map(({ row, choice, rate }) => ({
          bomComponentId: row.bomComponentId,
          confirmed: rate !== null,
          ...(editableRate(row) && choice.rate !== null && rate !== null
            ? { conversionRate: rate }
            : {}),
        })),
    ]),
  );
  return { groups, ready, confirmations, availability };
};
/** 가용 수량은 W/O 수량 기준으로 서버가 판정한다(omf-all-around#320) — 공장·수량을 모르면 묻지 않는다. */
const availabilityRequestOf = (
  target: ReleaseTarget,
  row: MaterialRequirement,
): AvailabilityRequest | null =>
  target.plantId != null && target.orderQty != null && target.orderQty > 0
    ? { plantId: target.plantId, bomComponentId: row.bomComponentId, quantity: target.orderQty }
    : null;
export type MaterialReview = ReturnType<typeof useReleaseMaterials>;

/**
 * 작업지시의 자재 확인 결과. 재고 부족 · 환산 비율 미입력 · 조회 실패 · 서버가 돌려준 자재 오류가 「확인 필요」다.
 * 재고 부족은 배포를 막지 않는다 — 환산 비율 미입력과 조회 실패만 막는다(`ready`).
 */
export const materialCheckOf = (
  review: MaterialReview,
  workOrderId: number,
  errorCount = 0,
): SectionCheck => {
  const group = review.groups.find((entry) => entry.target.workOrderId === workOrderId);
  if (group === undefined || group.query.isPending)
    return { state: 'pending', summary: [c.pending] };
  if (group.query.isError) return { state: 'warn', summary: [], alerts: [c.failed] };
  if (group.rows.length === 0) return { state: 'none', summary: [c.materialNone] };
  const short = group.rows.filter(({ row }) => {
    const request = availabilityRequestOf(group.target, row);
    return request !== null && review.availability.lineOf(request)?.statusCode === 'SHORT';
  }).length;
  const unconfirmed = group.rows.filter(
    ({ row, rate }) => row.confirmationRequired && rate === null,
  ).length;
  const alerts = [
    ...(short > 0 ? [c.materialShort(short)] : []),
    ...(unconfirmed > 0 ? [c.materialRate(unconfirmed)] : []),
  ];
  return {
    state: alerts.length > 0 || errorCount > 0 || review.availability.isError ? 'warn' : 'ok',
    summary: [c.materialKinds(group.rows.length)],
    alerts,
  };
};

export const ReleaseMaterials = ({
  review,
  workOrderId,
  disabled = false,
  errors = [],
  plain = false,
}: {
  review: MaterialReview;
  workOrderId?: number;
  disabled?: boolean;
  errors?: { workOrderId: number; field?: string; message: string }[];
  /** 배포 확인의 「자재 소요량」 줄 안 — 카드 테두리와 제목 · 작업지시 번호는 그 줄과 상세 머리가 이미 보인다. */
  plain?: boolean;
}) => (
  <section aria-label="자재 소요량 확인" className={plain ? 'release-materials-plain' : 'pane'}>
    {!plain && (
      <div className="section-heading-row">
        <h3 className="section-title">자재 소요량 확인</h3>
      </div>
    )}
    {review.groups
      .filter((group) => workOrderId === undefined || group.target.workOrderId === workOrderId)
      .map(({ target, query, rows }) => (
        <section key={target.workOrderId} aria-label={`${target.workOrderNo} 자재 소요`}>
          <div className="section-heading-row">
            {!plain && <h4>{target.workOrderNo}</h4>}
            {(query.isError ||
              errors.some((error) => error.workOrderId === target.workOrderId)) && (
              <Button
                variant="outlined"
                disabled={disabled || query.isFetching}
                onClick={() => void query.refetch()}
              >
                다시 조회
              </Button>
            )}
          </div>
          {query.isPending ? (
            <p role="status">자재 소요 조회 중</p>
          ) : query.isError ? (
            <AlertBanner
              variant="error"
              title="자재 소요를 조회하지 못했습니다. 다시 조회하세요."
            />
          ) : rows.length === 0 ? (
            <p>출고요청 대상 자재 없음</p>
          ) : (
            <>
              <AvailabilityError availability={review.availability} />
              <div className="erp-wo-table-scroll">
                <AdjustableNativeTable
                  storageKey="omf-release-materials-availability"
                  className="erp-wo-final-table"
                  labels={[
                    '자재 코드',
                    '자재명',
                    'BOM 소요량',
                    '출고 기준 소요량',
                    '가용 수량',
                    '재고 상태',
                    rows.some(({ row }) => row.confirmationRequired && editableRate(row)) ? (
                      <>
                        환산 비율
                        <span className="required-mark" aria-hidden="true">
                          {' *'}
                        </span>
                      </>
                    ) : (
                      '환산 비율'
                    ),
                  ]}
                  widths={[135, 195, 110, 135, 130, 90, 260]}
                >
                  <tbody>
                    {rows.map(({ row, choice, rate, set }) => (
                      <tr key={row.bomComponentId}>
                        <td>{row.itemCode}</td>
                        <td>{row.itemName}</td>
                        <td>
                          {quantityText(row.bomQty)} {row.bomUomCode}
                        </td>
                        <td>
                          {choice.rate !== null
                            ? rate !== null
                              ? stockQuantity(row.bomQty, rate, row.stockUomScale)
                              : '—'
                            : row.stockQty == null
                              ? '—'
                              : quantityText(row.stockQty)}{' '}
                          {row.stockUomCode}
                        </td>
                        <td>
                          <AvailableCell
                            availability={review.availability}
                            request={availabilityRequestOf(target, row)}
                          />
                        </td>
                        <td>
                          <AvailabilityStatusCell
                            availability={review.availability}
                            request={availabilityRequestOf(target, row)}
                          />
                        </td>
                        <td>
                          {row.conversionSource === null ? (
                            '—'
                          ) : (
                            <>
                              {row.conversionSource === 'NONE' && rate === null && (
                                <span>환산 비율 미등록</span>
                              )}
                              <div className="release-material-ratio">
                                <span>1 {row.stockUomCode} =</span>
                                {editableRate(row) ? (
                                  <div className="release-material-rate">
                                    <TextField
                                      size="sm"
                                      inputMode="decimal"
                                      aria-label={`${target.workOrderNo} ${row.itemCode} 환산 비율`}
                                      aria-required={row.confirmationRequired || undefined}
                                      value={choice.rate ?? String(row.conversionRate ?? '')}
                                      disabled={disabled}
                                      aria-invalid={choice.rate !== null && rate === null}
                                      aria-describedby={
                                        choice.rate !== null && rate === null
                                          ? `material-rate-${target.workOrderId}-${row.bomComponentId}`
                                          : undefined
                                      }
                                      onChange={(event) => set({ rate: event.target.value })}
                                    />
                                  </div>
                                ) : (
                                  <span>
                                    {row.conversionRate == null
                                      ? ''
                                      : quantityText(row.conversionRate)}
                                  </span>
                                )}
                                <span>{row.bomUomCode}</span>
                                <ReviewHelp
                                  title={`${target.workOrderNo} ${row.itemCode} 환산 비율`}
                                >
                                  {choice.rate !== null && rate !== null
                                    ? '입력한 비율로 소요량을 계산합니다. 이 비율은 배포 시 품목별 단위 환산으로 저장됩니다.'
                                    : row.conversionSource === 'ITEM'
                                      ? '품목별 단위 환산에 등록된 비율입니다. 비율 변경은 품목 기준정보에서 처리합니다.'
                                      : row.conversionSource === 'COMMON'
                                        ? '단위 사이에 정해진 기본 환산 비율입니다. 품목별 등록값이 있으면 우선 적용합니다.'
                                        : `1 ${row.stockUomCode}에 해당하는 ${row.bomUomCode} 수량을 입력하세요. 배포 시 품목별 단위 환산으로 저장됩니다.`}
                                </ReviewHelp>
                              </div>
                              {choice.rate !== null && rate === null && (
                                <span
                                  id={`material-rate-${target.workOrderId}-${row.bomComponentId}`}
                                  className="field-error release-material-error"
                                  role="alert"
                                >
                                  {choice.rate.trim() !== '' && Number(choice.rate) === 0
                                    ? '환산 비율에 0을 입력할 수 없습니다.'
                                    : '환산 비율을 확인하세요.'}
                                </span>
                              )}
                            </>
                          )}
                          {errors
                            .filter(
                              (error) =>
                                error.workOrderId === target.workOrderId &&
                                error.field?.includes(`bomComponentId=${row.bomComponentId}`),
                            )
                            .map((error, i) => (
                              <span role="alert" className="field-error" key={i}>
                                {error.message}
                              </span>
                            ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </AdjustableNativeTable>
              </div>
            </>
          )}
        </section>
      ))}
  </section>
);
