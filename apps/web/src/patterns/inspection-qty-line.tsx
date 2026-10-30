import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

const t = messages.common.inspectionHub;

export interface InspectionQtyField {
  key: string;
  label: string;
  value: string;
  onChange: (raw: string) => void;
  /** 숫자 색 — 합격 초록 · 보류 노랑 · 불합격 빨강, 검사 수량은 기본색(IQC 와 같다). */
  kind: 'accepted' | 'held' | 'rejected' | 'inspected';
  error?: string;
}

/** 수량 줄 오른쪽 입력 현황 — 셀 수 없으면 `uncountable`, 넘치면 `over`, 아니면 남은 양(0 이면 중립색). */
export type InspectionQtyStatus =
  | { kind: 'uncountable' }
  | { kind: 'short' | 'over'; total: string; amount: string; isZero?: boolean };

export interface InspectionQtyLineProps {
  fields: readonly InspectionQtyField[];
  uomCode: string | null;
  disabled: boolean;
  status: InspectionQtyStatus;
  /** 수량 줄 오른쪽 끝 [확정] — 주지 않으면 단추가 없다(잠긴 회차). */
  onConfirm?: (() => void) | null;
  confirmDisabled?: boolean;
  /** 칸 아래 · 줄 위에 붙일 것(오류 띠 등). */
  children?: ReactNode;
  /** 칸들이 함께 가리킬 설명(잠긴 까닭 등)의 id. */
  describedBy?: string;
}

/**
 * 검사 수량 줄(PQC · OQC · #197) — IQC 판정 화면과 같은 모양. 라벨 위 큰 숫자 입력 상자(단위는 상자 안 끝), 오른쪽에
 * 「전체 34 EA 중 34 EA 미입력」과 [확정]. Enter 도 [확정]과 같다. 계산 · 검증은 부르는 쪽 규칙 그대로다.
 */
export const InspectionQtyLine = ({
  fields,
  uomCode,
  disabled,
  status,
  onConfirm = null,
  confirmDisabled = false,
  children,
  describedBy,
}: InspectionQtyLineProps) => {
  const idBase = useId();
  const statusId = `${idBase}-status`;
  const tone =
    status.kind === 'uncountable' || status.kind === 'over'
      ? 'error'
      : status.isZero === true
        ? 'neutral'
        : 'info';

  return (
    <>
      {children}
      <div className="iqc-inspection-qty-line">
        <div className="iqc-inspection-qty-group" data-group="manual" data-count={fields.length}>
          <div className="iqc-inspection-qty-group-fields" data-count={fields.length}>
            {fields.map((field) => {
              const id = `${idBase}-${field.key}`;
              return (
                <div key={field.key} className="iqc-inspection-qty-input" data-kind={field.kind}>
                  <span className="field-label">
                    <label htmlFor={id}>{field.label}</label>
                  </span>
                  <TextField
                    id={id}
                    inputMode="decimal"
                    placeholder="0"
                    value={field.value}
                    disabled={disabled}
                    aria-describedby={describedBy}
                    error={field.error}
                    trailingIcon={
                      uomCode === null ? undefined : (
                        <span className="iqc-inspection-qty-computed-unit">{uomCode}</span>
                      )
                    }
                    onChange={(event) =>
                      field.onChange(event.target.value.replace(/^0+(?=\d)/u, ''))
                    }
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' || onConfirm === null) return;
                      event.preventDefault();
                      if (!confirmDisabled) onConfirm();
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <p id={statusId} className="iqc-inspection-qty-status" data-tone={tone} role="status">
          {status.kind === 'uncountable' ? (
            <strong>{t.qtyUncountable}</strong>
          ) : (
            <>
              <span className="iqc-inspection-qty-status-total">{t.qtyTotalOf(status.total)}</span>
              <strong>
                {status.kind === 'over' ? t.qtyOverBy(status.amount) : t.qtyShortBy(status.amount)}
              </strong>
            </>
          )}
        </p>
        {onConfirm !== null && (
          <div className="iqc-inspection-qty-line-action">
            <Button
              type="button"
              size="md"
              disabled={disabled || confirmDisabled}
              /* 막힌 까닭(수량 확인 필요)은 옆 입력 현황 줄이 말한다 — 단추가 그 줄을 가리킨다(C-4). */
              aria-describedby={confirmDisabled ? statusId : undefined}
              onClick={onConfirm}
            >
              {t.stepConfirm}
            </Button>
          </div>
        )}
      </div>
    </>
  );
};
