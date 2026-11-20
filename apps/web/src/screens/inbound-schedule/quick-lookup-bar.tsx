import { Checkbox, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { ItemPickerDialog } from '../../patterns/item-picker';
import type { ScheduleFilters } from './filters';
import { resolveScannedItem } from './lookups';
import type { PeriodInput } from './period';
import { SelectField } from './select-field';

const t = messages.inboundSchedule;

export interface QuickLookupBarProps {
  appliedPeriod: PeriodInput;
  appliedFilters: ScheduleFilters;
  onApply: (period: PeriodInput, filters: ScheduleFilters) => void;
}

/**
 * 빠른 조회 — 세 가지 찾는 길(사용자 결정 2026-10-20). 앞의 둘은 조건 줄에, 셋째는 「조건 더보기」 안에 있다
 * (관리웹 정리 시안 A, 2026-11-20 — 보이는 조건은 납기 · 공급업체 · 품목코드 셋).
 *
 * 1. **공급업체** — 선택 칸이다. 펼친 목록 맨 위 검색창에 이름이나 코드를 쳐서 거르고(`patterns/select.tsx`),
 *    고르는 즉시 조회한다. 예전에는 입력칸 + 브라우저 자동완성(`datalist`)이라 모양이 다른 선택 칸과 달랐다
 *    (사용자 지시 2026-10-28 「다른 것들과 ui 가 달라」)
 * 2. **품목코드** — 스캔하거나 품목번호를 치고 Enter. 정확히 하나로 정해지면 즉시 조회하고,
 *    아니면 그 값으로 찾아 둔 품목 선택 창을 연다. 칸은 비워 다음 스캔을 받는다 — 걸린 품목은 칩이 보인다
 * 3. **오늘 도착 · 지연** — 확인칸(`QuickToggles`). 켜고 끄는 즉시 조회한다
 *
 * ⭐ **빠른 조회는 «즉시 적용»이다.** 나머지 조건(공장 · 발주번호 · 미완료만)은 「모아서 적용」(조회 단추)인데, 빠른 조회는
 * 한 번의 동작이 곧 조회라 기다리게 하면 스캔 흐름이 끊긴다. 둘 다 같은 주소를 고친다.
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
  ({ appliedPeriod, appliedFilters, onApply }, ref) => {
    const { client } = useApiClient();
    const scanNoteId = useId();
    const scanRef = useRef<HTMLInputElement>(null);

    const [scanText, setScanText] = useState('');
    const [scanNote, setScanNote] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [pickerKeyword, setPickerKeyword] = useState<string | null>(null);

    /* 들어오자마자 스캔을 받는다 — 스캐너는 키보드처럼 글자와 Enter 를 보낸다. */
    useEffect(() => {
      scanRef.current?.focus();
    }, []);

    const apply = (patch: Partial<ScheduleFilters>): void => {
      onApply(appliedPeriod, { ...appliedFilters, ...patch });
    };

    /*
     * 품목을 얹을 바탕 조건. Enter 로 찾으면 걸린 조건(주소)이고, 「조회」로 찾으면 그 단추가 모은 조건
     * (「조건 더보기」 칸에 고쳐 둔 값 포함)이다. 품목 선택 창을 거쳐 늦게 정해져도 같은 바탕을 쓴다.
     */
    const baseRef = useRef<{ period: PeriodInput; filters: ScheduleFilters } | null>(null);

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

    return (
      <div className="po-board-quick">
        {/* C-19 보통 — 참조 선택칸. 고른 공급사 이름이 길어도 칸 폭은 그대로다(말줄임). */}
        <SelectField
          filterWidth="md"
          label={t.quick.supplier}
          partners
          options={[{ value: '', label: t.filters.all }]}
          value={appliedFilters.supplier}
          onChange={(value) => {
            if (value !== appliedFilters.supplier) apply({ supplier: value });
          }}
        />

        {/*
         * C-19 좁음 — 스캔하는 품목코드 한 칸이다. 납기(보통) · 공급업체(보통)와 조회 · 초기화 · 조건 더보기가 1280 에서 한 줄에
         * 들도록 좁은 폭을 쓴다(C-6). 정한 폭이라 친 값에 따라 칸이 늘지 않는다.
         */}
        <div className="field-cell filter-field-sm">
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

export interface QuickTogglesProps {
  appliedPeriod: PeriodInput;
  appliedFilters: ScheduleFilters;
  /** 공장 달력의 오늘(`YYYY-MM-DD`). 「오늘 도착」이 쓴다. */
  today: string;
  /** 기본 기간(오늘 앞뒤 2주). 「오늘 도착」을 풀면 여기로 돌아간다. */
  fallbackPeriod: PeriodInput;
  onApply: (period: PeriodInput, filters: ScheduleFilters) => void;
}

/**
 * 빠른 조회의 확인칸 — 오늘 도착 · 지연. 켜고 끄는 즉시 조회한다. 「조건 더보기」 맨 앞에 놓인다(관리웹 정리 시안 A,
 * 2026-11-20). 걸린 지연은 접혀 있어도 칩이 보이고, 오늘 도착은 납기 칸이 오늘 하루로 보인다.
 */
export const QuickToggles = ({
  appliedPeriod,
  appliedFilters,
  today,
  fallbackPeriod,
  onApply,
}: QuickTogglesProps) => {
  const isToday = appliedPeriod.from === today && appliedPeriod.to === today;

  return (
    <div className="field-cell field-cell-unlabeled">
      <div className="check-group check-group-row">
        <Checkbox
          checked={isToday}
          onChange={(event) => {
            onApply(
              event.target.checked ? { from: today, to: today } : fallbackPeriod,
              appliedFilters,
            );
          }}
        >
          {t.quick.today}
        </Checkbox>
        <Checkbox
          checked={appliedFilters.overdueOnly}
          onChange={(event) => {
            onApply(appliedPeriod, { ...appliedFilters, overdueOnly: event.target.checked });
          }}
        >
          {t.quick.overdue}
        </Checkbox>
      </div>
    </div>
  );
};
