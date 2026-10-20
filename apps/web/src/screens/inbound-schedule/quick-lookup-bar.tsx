import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { ItemPickerDialog } from '../../patterns/item-picker';
import type { ScheduleFilters } from './filters';
import { resolveScannedItem } from './lookups';
import type { PeriodInput } from './period';
import type { SelectOption } from './types';

const t = messages.inboundSchedule;

export interface QuickLookupBarProps {
  appliedPeriod: PeriodInput;
  appliedFilters: ScheduleFilters;
  /** 공장 달력의 오늘(`YYYY-MM-DD`). 「오늘 도착」이 쓴다. */
  today: string;
  supplierOptions: SelectOption[];
  /** 공급업체 선택지의 한계(잘림·실패) 안내. */
  supplierNote?: string;
  onApply: (period: PeriodInput, filters: ScheduleFilters) => void;
}

/**
 * 빠른 조회 줄 — 세 가지 찾는 길(사용자 결정 2026-10-20).
 *
 * 1. **공급업체** — 이름이나 코드를 치면 후보가 뜨고, 고르는 즉시 조회한다
 * 2. **품목코드** — 스캔하거나 품목번호를 치고 Enter. 정확히 하나로 정해지면 즉시 조회하고,
 *    아니면 그 값으로 찾아 둔 품목 선택 창을 연다. 칸은 비워 다음 스캔을 받는다
 * 3. **오늘 도착 · 지연** — 누르는 즉시 조회한다. 다시 누르면 푼다
 *
 * ⭐ **이 줄은 «즉시 적용»이다.** 아래 상세 조건 줄은 「모아서 적용」(조회 단추)인데, 이 줄은 한 번의
 * 동작이 곧 조회라 기다리게 하면 스캔 흐름이 끊긴다. 둘 다 같은 주소를 고친다 — 걸린 조건은 칩이 보인다.
 */
export const QuickLookupBar = ({
  appliedPeriod,
  appliedFilters,
  today,
  supplierOptions,
  supplierNote,
  onApply,
}: QuickLookupBarProps) => {
  const { client } = useApiClient();
  const supplierListId = useId();
  const scanNoteId = useId();
  const scanRef = useRef<HTMLInputElement>(null);

  const appliedSupplierLabel =
    supplierOptions.find((option) => option.value === appliedFilters.supplier)?.label ?? '';
  const [supplierText, setSupplierText] = useState(appliedSupplierLabel);
  const [scanText, setScanText] = useState('');
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [pickerKeyword, setPickerKeyword] = useState<string | null>(null);

  /* 칩 ×·초기화로 주소의 공급사가 바뀌면 칸 글자도 따라간다. */
  useEffect(() => {
    setSupplierText(appliedSupplierLabel);
  }, [appliedSupplierLabel]);

  /* 들어오자마자 스캔을 받는다 — 스캐너는 키보드처럼 글자와 Enter 를 보낸다. */
  useEffect(() => {
    scanRef.current?.focus();
  }, []);

  const apply = (patch: Partial<ScheduleFilters>, period: PeriodInput = appliedPeriod): void => {
    onApply(period, { ...appliedFilters, ...patch });
  };

  const changeSupplier = (text: string): void => {
    setSupplierText(text);
    if (text === '') {
      if (appliedFilters.supplier !== '') apply({ supplier: '' });
      return;
    }
    /* 후보에서 고른 순간(글자가 선택지 하나와 같아진 순간)에만 조회한다 — 치는 동안에는 나가지 않는다. */
    const picked = supplierOptions.find((option) => option.label === text);
    if (picked !== undefined && picked.value !== appliedFilters.supplier) {
      apply({ supplier: picked.value });
    }
  };

  const applyItem = (itemId: number): void => {
    setScanText('');
    setScanNote(null);
    apply({ item: String(itemId) });
    scanRef.current?.focus();
  };

  const scan = async (): Promise<void> => {
    const value = scanText.trim();
    if (value === '' || isScanning) return;

    setIsScanning(true);
    setScanNote(null);
    try {
      const result = await resolveScannedItem(client, value);
      if (result.kind === 'found') applyItem(result.itemId);
      else if (result.kind === 'none') setScanNote(t.quick.scanNotFound(value));
      else setPickerKeyword(value);
    } catch {
      setScanNote(t.quick.scanFailed);
    } finally {
      setIsScanning(false);
    }
  };

  const isToday = appliedPeriod.from === today && appliedPeriod.to === today;

  return (
    <div className="filter-bar inbound-schedule-quick">
      <div className="field-cell wide-select">
        <TextField
          label={t.quick.supplier}
          list={supplierListId}
          value={supplierText}
          placeholder={t.quick.supplierPlaceholder}
          autoComplete="off"
          onChange={(event) => {
            changeSupplier(event.target.value);
          }}
        />
        <datalist id={supplierListId}>
          {supplierOptions.map((option) => (
            <option key={option.value} value={option.label} />
          ))}
        </datalist>
        {supplierNote !== undefined && <span className="field-note">{supplierNote}</span>}
      </div>

      <div className="field-cell inbound-schedule-scan">
        <TextField
          ref={scanRef}
          fullWidth
          label={t.quick.item}
          value={scanText}
          placeholder={t.quick.itemPlaceholder}
          autoComplete="off"
          aria-describedby={scanNote === null ? undefined : scanNoteId}
          disabled={isScanning}
          onChange={(event) => {
            setScanText(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void scan();
            }
          }}
        />
        {scanNote !== null && (
          <span id={scanNoteId} className="field-note" role="status">
            {scanNote}
          </span>
        )}
      </div>

      <div className="field-cell field-cell-unlabeled">
        <div className="filter-actions">
          <Button
            variant={isToday ? 'tonal' : 'outlined'}
            aria-pressed={isToday}
            onClick={() => {
              apply({}, isToday ? { from: '', to: '' } : { from: today, to: today });
            }}
          >
            {t.quick.today}
          </Button>
          <Button
            variant={appliedFilters.overdueOnly ? 'tonal' : 'outlined'}
            aria-pressed={appliedFilters.overdueOnly}
            onClick={() => {
              apply({ overdueOnly: !appliedFilters.overdueOnly });
            }}
          >
            {t.quick.overdue}
          </Button>
        </div>
      </div>

      {pickerKeyword !== null && (
        <ItemPickerDialog
          multiple={false}
          includeInactive
          showAvailability={false}
          initialKeyword={pickerKeyword}
          confirmLabel={t.filters.itemPick}
          onClose={() => {
            setPickerKeyword(null);
            scanRef.current?.focus();
          }}
          onConfirm={([item]) => {
            setPickerKeyword(null);
            if (item !== undefined) applyItem(item.itemId);
          }}
        />
      )}
    </div>
  );
};
