import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import {
  PuButton,
  PuDialog,
  PuField,
  PuInput,
  PuKeypad,
  PuNote,
  PuUnit,
  applyKeypadKey,
} from '../../patterns/pop-uniform';
import type { IssueUnit } from './issue-unit';

const t = messages.popMaterialLotLabel.precreate.bulk;

export interface BulkPrintDialogProps {
  /** 넣을 수 있는 최대 — 미출력 탭 총 건수(아직 만들지 않은 몫 포함). */
  max: number;
  /** 이미 만든 미출력 수 — 넘으면 모자란 몫을 먼저 만든다. */
  existing: number;
  unit: IssueUnit;
  onCancel: () => void;
  /** 장수 N — 미출력 차례 1~N 을 모은다(모자라면 서버가 만든다). 실패하면 던진다. */
  onConfirm: (count: number) => Promise<void>;
}

/** 넣은 글 → 장수. 1 이상 정수가 아니면 `null`. */
export const parseBulkCount = (value: string): number | null => {
  const trimmed = value.trim();

  if (!/^\d+$/u.test(trimmed)) return null;
  const count = Number(trimmed);

  return count >= 1 ? count : null;
};

/**
 * [일괄 출력] 창(피처 014 FR-015 · 시안 P0101 ④) — 몇 장 찍을지 숫자로 받는다. 미출력을 차례 번호 순서로 앞에서부터
 * 그 장수만큼 모아 지금 출력 흐름(미리 보기 → 발행 단위마다 멈춤 → 실패 처리)으로 넘긴다.
 * ⛔ 최대(미출력 총 건수)를 넘으면 알리고 찍지 않는다. 「전부 찍기」는 두지 않는다.
 */
export const BulkPrintDialog = ({
  max,
  existing,
  unit,
  onCancel,
  onConfirm,
}: BulkPrintDialogProps) => {
  const fieldId = useId();
  const [value, setValue] = useState(String(Math.min(max, unit ?? max)));
  const [isCollecting, setCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = parseBulkCount(value);
  const isOver = count !== null && count > max;
  const canSubmit = count !== null && !isOver && !isCollecting;

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;

    setCollecting(true);
    setError(null);
    try {
      await onConfirm(count);
    } catch {
      setError(t.failed);
      setCollecting(false);
    }
  };

  return (
    <PuDialog
      title={t.title}
      wide
      onClose={onCancel}
      footer={
        <>
          <span className="mll-dim mll-revise-foot">{isOver ? null : t.next}</span>
          <PuButton onClick={onCancel}>{t.cancel}</PuButton>
          <PuButton
            variant="primary"
            icon="print"
            disabled={!canSubmit}
            onClick={() => {
              void submit();
            }}
          >
            {canSubmit ? t.submit(count) : t.submitIdle}
          </PuButton>
        </>
      }
    >
      <div className="mll-batch-wrap">
        <div className="mll-batch">
          <p className="pu-help">{t.lead}</p>
          <PuField label={t.count} required htmlFor={fieldId}>
            <div className="pu-row">
              <PuInput
                id={fieldId}
                target
                inputMode="numeric"
                numeric
                aria-invalid={isOver ? true : undefined}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setError(null);
                }}
              />
              <PuUnit>{t.unit}</PuUnit>
            </div>
            <span className="pu-help">{t.hint(max, existing, Math.max(0, max - existing))}</span>
          </PuField>
          {isOver ? (
            <PuNote tone="bad">
              <b>{t.over(max)}</b> {t.overBody(count)}
            </PuNote>
          ) : count === null ? null : (
            <dl className="pu-kv mll-revise-kv">
              <dt>{t.range}</dt>
              <dd>{t.rangeValue(count)}</dd>
              {count > existing ? (
                <>
                  <dt>{t.create}</dt>
                  <dd>{t.createValue(count - existing)}</dd>
                </>
              ) : null}
              <dt>{t.unitLabel}</dt>
              <dd>{unit === null ? t.unitAll : t.unitEach(unit)}</dd>
            </dl>
          )}
          {isCollecting ? <PuNote live>{t.collecting}</PuNote> : null}
          {error === null ? null : <PuNote tone="bad">{error}</PuNote>}
        </div>
        <div className="mll-batch-keypad">
          <PuKeypad
            targetLabel={t.count}
            decimal={false}
            disabled={isCollecting}
            onKey={(key) => {
              setValue((previous) => applyKeypadKey(previous, key, { decimal: false }));
            }}
            onClearAll={() => {
              setValue('');
            }}
          />
        </div>
      </div>
    </PuDialog>
  );
};
