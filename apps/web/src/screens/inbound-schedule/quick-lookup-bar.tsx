import { Checkbox, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';

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
  /** 기본 기간(오늘 앞뒤 2주). 「오늘 도착」을 풀면 여기로 돌아간다. */
  fallbackPeriod: PeriodInput;
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
 * 3. **오늘 도착 · 지연** — 확인칸. 켜고 끄는 즉시 조회한다
 *
 * ⭐ **이 줄은 «즉시 적용»이다.** 아래 상세 조건 줄은 「모아서 적용」(조회 단추)인데, 이 줄은 한 번의
 * 동작이 곧 조회라 기다리게 하면 스캔 흐름이 끊긴다. 둘 다 같은 주소를 고친다 — 걸린 조건은 칩이 보인다.
 */
/** 「조회」 단추가 부른다 — 품목코드 칸에 친 값이 남아 있으면 그 값으로 찾는다. */
export interface QuickLookupHandle {
  /**
   * 품목코드 칸에 값이 있으면 그것을 찾아 `period`·`filters` 위에 품목 조건을 얹어 조회하고 `true`.
   * 비어 있으면 아무것도 하지 않고 `false` — 부르는 쪽이 평소대로 조회한다.
   */
  submit: (period: PeriodInput, filters: ScheduleFilters) => boolean;
}

export const QuickLookupBar = forwardRef<QuickLookupHandle, QuickLookupBarProps>(
  (
    {
      appliedPeriod,
      appliedFilters,
      today,
      fallbackPeriod,
      supplierOptions,
      supplierNote,
      onApply,
    },
    ref,
  ) => {
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

    /*
     * 품목을 얹을 바탕 조건. Enter 로 찾으면 걸린 조건(주소)이고, 「조회」로 찾으면 그 단추가 모은 조건
     * (상세 조건 칸에 고쳐 둔 값 포함)이다. 품목 선택 창을 거쳐 늦게 정해져도 같은 바탕을 쓴다.
     */
    const baseRef = useRef<{ period: PeriodInput; filters: ScheduleFilters } | null>(null);

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
      const base = baseRef.current;
      if (base === null) apply({ item: String(itemId) });
      else onApply(base.period, { ...base.filters, item: String(itemId) });
      baseRef.current = null;
      scanRef.current?.focus();
    };

    const scan = async (
      base: { period: PeriodInput; filters: ScheduleFilters } | null = null,
    ): Promise<void> => {
      const value = scanText.trim();
      if (value === '' || isScanning) return;

      baseRef.current = base;
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

    useImperativeHandle(ref, () => ({
      submit: (period, filters) => {
        if (scanText.trim() === '') return false;
        void scan({ period, filters });
        return true;
      },
    }));

    const isToday = appliedPeriod.from === today && appliedPeriod.to === today;

    return (
      <div className="inbound-schedule-quick">
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

        <div className="field-cell wide-select">
          <TextField
            ref={scanRef}
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
          <div className="check-group check-group-row">
            <Checkbox
              checked={isToday}
              onChange={(event) => {
                apply({}, event.target.checked ? { from: today, to: today } : fallbackPeriod);
              }}
            >
              {t.quick.today}
            </Checkbox>
            <Checkbox
              checked={appliedFilters.overdueOnly}
              onChange={(event) => {
                apply({ overdueOnly: event.target.checked });
              }}
            >
              {t.quick.overdue}
            </Checkbox>
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
  },
);

QuickLookupBar.displayName = 'QuickLookupBar';
