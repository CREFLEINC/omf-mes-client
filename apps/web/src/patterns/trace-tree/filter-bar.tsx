import { Button, DatePicker, Icon, SearchInput } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState } from 'react';

import { ReferenceField, type ReferenceSource } from '../reference-picker';
import { Select } from '../select';
import type { ListCondition } from './lot-list-state';
import { validatePeriod, type Period } from './period';
import type { TracePlant } from './queries';
import type { TraceDirection } from './types';

const t = messages.traceTree;

export interface TraceFilterBarProps {
  direction: TraceDirection;
  /** 계정 범위의 공장. 둘 이상일 때만 칸을 둔다(C-12 조직 단위 — 하나뿐이면 칸 없음). */
  plants: readonly TracePlant[];
  plantId: number | null;
  onPlantChange: (plantId: number) => void;
  /** 번호 풀기를 부르는 중. */
  scanning: boolean;
  /** 번호 하나(앞뒤 공백 뺌)를 스캔한 것으로 다룬다. */
  onScan: (q: string) => void;
  /** 지금 목록에 걸린 조건. 없으면 처음 값(빈 상대 · 최근 30일). */
  condition: ListCondition | null;
  defaultPeriod: Period;
  partnerSource: ReferenceSource;
  /** 조건의 상대 이름(「이름 (코드)」) — 주소로 들어온 조건은 이름을 풀어 보인다. */
  partnerLabel: string;
  onSearch: (condition: ListCondition) => void;
  /** [최근 목록으로]를 쓸 수 있는가 — 목록이 이미 최근이고 고른 LOT 이 없으면 막는다. */
  canReset: boolean;
  onReset: () => void;
}

/**
 * 위 조건 줄(피처 015 R-7) — 번호 칸(Enter·스캔) | 공급사·고객 + 기간 [찾기] | [최근 목록으로].
 * - 번호 칸은 DS `SearchInput` 의 Enter 로 바로 번호를 푼다(LOT 상태 조회와 같다). 풀고 나면 글자를 골라 두어 다음
 *   스캔이 덮어쓴다.
 * - 조건은 상대와 기간이 모두 있어야 찾는다. 빠진 것은 [찾기] 때 칸 아래 알린다(C-7).
 */
export const TraceFilterBar = ({
  direction,
  plants,
  plantId,
  onPlantChange,
  scanning,
  onScan,
  condition,
  defaultPeriod,
  partnerSource,
  partnerLabel,
  onSearch,
  canReset,
  onReset,
}: TraceFilterBarProps) => {
  const words = direction === 'FORWARD' ? t.material : t.product;
  const [q, setQ] = useState('');
  const scanRef = useRef<HTMLInputElement>(null);
  const [partner, setPartner] = useState<{ id: number; label: string } | null>(null);
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [partnerError, setPartnerError] = useState<string | null>(null);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const periodId = useId();
  const periodErrorId = useId();
  const partnerErrorId = useId();

  /* 조건이 바뀌면(주소 · [최근 목록으로]) 칸을 그 조건으로 맞춘다. */
  const appliedKey = JSON.stringify(condition);
  useEffect(() => {
    const applied = JSON.parse(appliedKey) as ListCondition | null;
    setPartner(applied === null ? null : { id: applied.partnerId, label: '' });
    setPeriod(applied === null ? defaultPeriod : { from: applied.from, to: applied.to });
    setPartnerError(null);
    setPeriodError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 적용된 조건이 바뀔 때만 맞춘다
  }, [appliedKey]);

  const shownPartner = partner === null ? '' : partner.label !== '' ? partner.label : partnerLabel;

  const scan = (raw: string) => {
    const value = raw.trim();
    if (value === '' || scanning) return;
    onScan(value);
    scanRef.current?.select();
  };

  const search = () => {
    const reason = validatePeriod(period);
    setPeriodError(reason);
    setPartnerError(partner === null ? words.partnerRequired : null);
    if (reason !== null || partner === null) return;
    onSearch({ partnerId: partner.id, from: period.from, to: period.to });
  };

  return (
    <div className="filter-bar trace-tree-filter" role="search" aria-label={t.filterPane}>
      {plants.length > 1 && (
        <div className="field-cell filter-field-sm">
          <span className="field-label">{t.plant}</span>
          <Select
            aria-label={t.plant}
            value={plantId === null ? null : String(plantId)}
            options={plants.map((plant) => ({
              value: String(plant.plantId),
              label: named(plant.plantName, plant.plantCode),
            }))}
            onChange={(value) => {
              if (value !== null) onPlantChange(Number(value));
            }}
          />
        </div>
      )}
      <div className="field-cell trace-tree-filter-scan">
        <SearchInput
          ref={scanRef}
          fullWidth
          label={words.scanLabel}
          placeholder={words.scanPlaceholder}
          value={q}
          loading={scanning}
          clearLabel={messages.common.clear}
          onChange={(event) => setQ(event.target.value)}
          onSearch={scan}
          onClear={() => setQ('')}
        />
      </div>
      <span className="trace-tree-filter-divider" aria-hidden="true" />
      <div className="trace-tree-filter-partner">
        <ReferenceField
          label={words.partner}
          valueLabel={shownPartner}
          source={partnerSource}
          required
          invalid={partnerError !== null}
          aria-describedby={partnerError === null ? undefined : partnerErrorId}
          onPick={(row) => {
            setPartner({ id: row.id, label: named(row.name, row.code) });
            setPartnerError(null);
          }}
          onClear={() => setPartner(null)}
        >
          {partnerError !== null && (
            <span id={partnerErrorId} className="field-error" role="alert">
              {partnerError}
            </span>
          )}
        </ReferenceField>
      </div>
      <div className="field-cell trace-tree-filter-period">
        <label className="field-label" htmlFor={periodId}>
          {words.period}
          <span className="required-mark" aria-hidden="true">
            {' '}
            *
          </span>
        </label>
        <DatePicker
          id={periodId}
          mode="range"
          value={[period.from === '' ? null : period.from, period.to === '' ? null : period.to]}
          placeholder={t.periodPlaceholder}
          aria-required
          invalid={periodError !== null}
          aria-describedby={periodError === null ? undefined : periodErrorId}
          onChange={(value) => {
            setPeriod(value === null ? { from: '', to: '' } : { from: value[0], to: value[1] });
            setPeriodError(null);
          }}
        />
        {periodError !== null && (
          <span id={periodErrorId} className="field-error" role="alert">
            {periodError}
          </span>
        )}
      </div>
      <div className="field-cell field-cell-unlabeled">
        <div className="filter-actions">
          <Button leadingIcon={<Icon name="search" size={18} />} onClick={search}>
            {t.search}
          </Button>
        </div>
      </div>
      <div className="field-cell field-cell-unlabeled filter-actions-end">
        <div className="filter-actions">
          <Button
            variant="outlined"
            leadingIcon={<Icon name="history" size={18} />}
            disabled={!canReset}
            onClick={onReset}
          >
            {t.backToRecent}
          </Button>
        </div>
      </div>
    </div>
  );
};
