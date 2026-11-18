import './release-review.css';
import './release-materials.css';
import type { MaterialComponents } from '@omf-mes/api-client';
import { AlertBanner, Button, TextField } from '@crefle/web-ui';
import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { useApiClient } from '../../../patterns/api-context';
import { runRequest } from '../../../patterns/request';
import type { ReleaseTarget } from '../release-runner';
import { AdjustableNativeTable } from './adjustable-table';

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
  checked: boolean;
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
        const choice = choices[key] ?? { checked: false, rate: null };
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
  const ready =
    !enabled ||
    groups.every(
      (group) =>
        group.query.isSuccess &&
        !group.query.isFetching &&
        group.rows.every(
          ({ row, choice, rate }) => !row.confirmationRequired || (choice.checked && rate !== null),
        ),
    );
  const confirmations: MaterialConfirmations = Object.fromEntries(
    groups.map((group) => [
      group.target.workOrderId,
      group.rows
        .filter(({ row }) => row.confirmationRequired)
        .map(({ row, choice, rate }) => ({
          bomComponentId: row.bomComponentId,
          confirmed: choice.checked,
          ...(editableRate(row) && choice.rate !== null && rate !== null
            ? { conversionRate: rate }
            : {}),
        })),
    ]),
  );
  return { groups, ready, confirmations };
};
export type MaterialReview = ReturnType<typeof useReleaseMaterials>;
export const ReleaseMaterials = ({
  review,
  disabled = false,
  errors = [],
}: {
  review: MaterialReview;
  disabled?: boolean;
  errors?: { workOrderId: number; field?: string; message: string }[];
}) => (
  <section aria-label="자재 소요 및 단위 환산" className="pane">
    <div className="section-heading-row">
      <h3 className="section-title">자재 소요 및 단위 환산</h3>
    </div>
    {review.groups.map(({ target, query, rows }) => (
      <section key={target.workOrderId} aria-label={`${target.workOrderNo} 자재 소요`}>
        <div className="section-heading-row">
          <h4>{target.workOrderNo}</h4>
          <Button
            variant="outlined"
            disabled={disabled || query.isFetching}
            onClick={() => void query.refetch()}
          >
            다시 조회
          </Button>
        </div>
        {query.isPending ? (
          <p role="status">자재 소요 조회 중</p>
        ) : query.isError ? (
          <AlertBanner variant="error" title="자재 소요를 조회하지 못했습니다. 다시 조회하세요." />
        ) : rows.length === 0 ? (
          <p>출고요청 대상 자재 없음</p>
        ) : (
          <>
            <div className="erp-wo-table-scroll">
              <AdjustableNativeTable
                storageKey="omf-release-materials"
                className="erp-wo-final-table"
                labels={[
                  '자재 코드',
                  '자재명',
                  'BOM 소요량',
                  '재고 단위 소요량',
                  '환산 기준',
                  '확인',
                ]}
                widths={[160, 220, 140, 150, 320, 110]}
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
                            ? '환산 불가'
                            : quantityText(row.stockQty)}{' '}
                        {row.stockUomCode}
                      </td>
                      <td>
                        {row.conversionSource === null ? (
                          '동일 단위'
                        ) : (
                          <>
                            <span>
                              {row.conversionSource === 'ITEM'
                                ? '품목 환산'
                                : row.conversionSource === 'COMMON'
                                  ? '공통 환산'
                                  : '환산 불가 — 직접 입력'}
                            </span>
                            <div className="release-material-ratio">
                              <span>1 {row.stockUomCode} =</span>
                              {editableRate(row) ? (
                                <TextField
                                  size="sm"
                                  style={{ width: 112 }}
                                  inputMode="decimal"
                                  aria-label={`${target.workOrderNo} ${row.itemCode} 환산 비율`}
                                  value={choice.rate ?? String(row.conversionRate ?? '')}
                                  disabled={disabled}
                                  error={
                                    choice.rate !== null && rate === null
                                      ? '0보다 큰 비율을 입력하세요. 소수 8자리까지 반올림합니다.'
                                      : undefined
                                  }
                                  onChange={(event) =>
                                    set({ rate: event.target.value, checked: false })
                                  }
                                />
                              ) : (
                                <span>
                                  {row.conversionRate == null
                                    ? ''
                                    : quantityText(row.conversionRate)}
                                </span>
                              )}
                              <span>{row.bomUomCode}</span>
                            </div>
                            {choice.rate !== null && (
                              <span className="field-note">
                                입력값은 배포 시 품목 환산으로 저장됩니다.
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
                      <td>
                        {row.confirmationRequired ? (
                          <label>
                            <input
                              type="checkbox"
                              aria-label={`${target.workOrderNo} ${row.itemCode} 환산 확인`}
                              disabled={disabled || rate === null}
                              checked={choice.checked}
                              onChange={(event) => set({ checked: event.target.checked })}
                            />{' '}
                            환산 확인
                          </label>
                        ) : (
                          '—'
                        )}
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
