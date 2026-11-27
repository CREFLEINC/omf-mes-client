import type { Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { ListEmpty } from './list-empty';
import { ManagedTable } from './managed-table';

/**
 * 정보 표시 팝업(입력란 없음)의 상세 정보 상자 — 팝업 디자인 시안 2026-11-27 「3. 정보 표시 팝업」(omf-all-around#360).
 * 모양은 검사 조회·판정 「검사 기본 정보」 상자(`.parts-iqc-facts` · `.parts-iqc-fact`)와 같다 — 연회색 둥근 상자 안에
 * 이름(위) · 값(아래) 칸이 가로로 흐르고 칸 사이 세로선, 넘치면 다음 줄, 값은 한 줄(길면 말줄임).
 * 첫 줄(`isKey`)은 대상을 가리키는 핵심 값을 크게, 둘째 줄부터 보통 크기. 필수 · 선택 표시는 붙이지 않는다.
 */
export interface InfoFact {
  label: string;
  /** 비어 있으면(`null` · `undefined` · 빈 글 · 「—」) 회색 「—」. */
  value: ReactNode;
  /** 크게 쓰는 핵심 값(번호 · 품목 등). */
  isKey?: boolean;
  /** 말줄임될 때 마우스를 올리면 보일 전체 글. 글 값이면 생략해도 그 글을 쓴다. */
  title?: string;
}

const EMPTY_MARK = '—';

const isBlank = (value: ReactNode): boolean =>
  value === null ||
  value === undefined ||
  value === false ||
  (typeof value === 'string' && (value.trim() === '' || value === EMPTY_MARK || value === '-'));

/** 빈 값 표시 — 회색 「—」. */
export const InfoEmpty = () => <span className="info-fact-empty">{EMPTY_MARK}</span>;

/** 코드 + 이름 한 줄 — 이름은 보통 굵기. */
export const InfoCodeName = ({ code, name }: { code: string; name?: string | null }) => (
  <>
    {code}
    {name !== undefined && name !== null && name !== '' && (
      <span className="parts-iqc-fact-sub">{name}</span>
    )}
  </>
);

/** 한 칸 값이 두 줄일 때(예: 입하번호 + 품목) — 줄마다 한 줄, 길면 말줄임. */
export const InfoLines = ({ lines }: { lines: ReactNode[] }) => (
  <span className="info-fact-lines">
    {lines.map((line, index) => (
      <span className="info-fact-line" key={index}>
        {line}
      </span>
    ))}
  </span>
);

/** 수량 — 천 단위 쉼표 + 흐린 단위. */
export const InfoQty = ({ value, unit }: { value: number | string; unit?: string | null }) => {
  const num = typeof value === 'number' ? value : Number(value);
  const text =
    Number.isFinite(num) && String(value).trim() !== ''
      ? num.toLocaleString('ko-KR')
      : String(value);

  return (
    <>
      {text}
      {unit !== undefined && unit !== null && unit !== '' && (
        <span className="info-fact-unit">{unit}</span>
      )}
    </>
  );
};

const FactItem = ({ fact }: { fact: InfoFact }) => {
  const blank = isBlank(fact.value);
  const title = fact.title ?? (typeof fact.value === 'string' && !blank ? fact.value : undefined);

  return (
    <div className="parts-iqc-fact info-fact">
      <dt className="field-label">{fact.label}</dt>
      <dd
        className={fact.isKey === true ? 'info-fact-value is-key' : 'info-fact-value'}
        title={title}
      >
        {blank ? <InfoEmpty /> : fact.value}
      </dd>
    </div>
  );
};

export interface InfoFactsProps {
  /** 줄마다 칸 목록. 첫 줄은 보통 `isKey` 칸. */
  rows: InfoFact[][];
  className?: string;
}

/**
 * 확인 팝업의 이름 · 값 목록을 상자 두 줄로 — 첫 칸은 대상을 가리키는 핵심 값(크게), 나머지는 둘째 줄.
 */
export const toFactRows = (facts: readonly { label: string; value: ReactNode }[]): InfoFact[][] => {
  const [first, ...rest] = facts;
  if (first === undefined) return [];
  return [
    [{ label: first.label, value: first.value, isKey: true }],
    rest.map(({ label, value }) => ({ label, value })),
  ];
};

/** 상세 정보 상자 하나. */
export const InfoFacts = ({ rows, className }: InfoFactsProps) => (
  <div className={className === undefined ? 'info-facts' : `info-facts ${className}`}>
    {rows
      .filter((row) => row.length > 0)
      .map((row, index) => (
        <dl className="info-facts-row" key={index}>
          {row.map((fact) => (
            <FactItem fact={fact} key={fact.label} />
          ))}
        </dl>
      ))}
  </div>
);

/** 긴 글(비고 등) — 상자 밖 아래에 이름 + 글, 줄바꿈 그대로. */
export const InfoLong = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="info-long">
    <div className="field-label">{label}</div>
    <div className="info-long-value">{isBlank(value) ? <InfoEmpty /> : value}</div>
  </div>
);

/** 항목이 많을 때 묶음 제목(검정) — 묶음마다 상자 하나. */
export const InfoGroupTitle = ({ children }: { children: ReactNode }) => (
  <h3 className="info-group-title">{children}</h3>
);

export interface InfoTableProps<T> {
  /** 표 제목(검정) — 옆에 회색 「N건」. 표가 여럿이면 표마다 제목. */
  title: string;
  /** 바꾼 열 폭 · 순서를 남기는 열쇠 — 표마다 다르게. */
  storageKey: string;
  /** 숫자 열은 `align: 'end'`, 판정 · 상태 칩 열은 `align: 'center'`, 글자 열은 비워 둔다(왼쪽). */
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** 내역이 없을 때 안내 한 줄. */
  emptyTitle: ReactNode;
  isBusy?: boolean;
}

/**
 * 정보 표시 팝업 안의 표 — 상세 정보 상자 아래에 제목 + 건수, 그 아래 관리웹 공용 표(`ManagedTable` — 열 폭 끌기 ·
 * 열 순서 바꾸기). 5줄이 넘으면 표 안에서 구르고 머리 줄은 고정. 내역이 없으면 머리 줄은 두고 `ListEmpty`.
 * 영역 이름(region)이 필요하면 부르는 쪽이 `section` 으로 감싼다.
 */
export const InfoTable = <T,>({
  title,
  storageKey,
  columns,
  rows,
  getRowId,
  emptyTitle,
  isBusy,
}: InfoTableProps<T>) => (
  <div className="info-table-block">
    <div className="info-table-head">
      <h3 className="info-table-title">{title}</h3>
      <span className="info-table-count">{messages.common.paneList.count(rows.length)}</span>
    </div>
    <ManagedTable
      className="info-table"
      storageKey={storageKey}
      columns={columns}
      rows={rows}
      getRowId={getRowId}
      caption={title}
      empty={<ListEmpty title={emptyTitle} />}
      isBusy={isBusy}
    />
  </div>
);
