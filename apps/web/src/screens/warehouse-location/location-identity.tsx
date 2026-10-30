import { Chip, Icon, IconButton, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId, useState } from 'react';

import type { LocationLevelCode } from '../../patterns/location-level';
import { Select } from '../../patterns/select';
import {
  isPutawayStaging,
  isSystemLocation,
  SYSTEM_LOCATION_ROLE,
} from '../../patterns/system-location';
import type { Location } from './types';

const t = messages.warehouseLocation;

/**
 * 단계마다 다른 모양 · 색의 아이콘(사용자 지시 2026-10-29) — 줄마다 어느 단계인지 한눈에 갈리게. 서버가 만든 자리는
 * 단계가 구역이어도 따로 둔다(창고 전체 · 적치 대기). 목록과 수정 창이 같은 아이콘을 쓴다.
 */
const LEVEL_ICONS: Record<LocationLevelCode, string> = {
  ZONE: 'grid_view',
  RACK: 'shelves',
  LEVEL: 'layers',
  CELL: 'crop_square',
};

type LevelSubject = Pick<Location, 'locationLevelCode' | 'systemRoleCode'>;

export const levelIconOf = (location: LevelSubject): { name: string; tone: string } => {
  if (isPutawayStaging(location)) return { name: 'move_to_inbox', tone: 'system' };
  if (isSystemLocation(location)) return { name: 'warehouse', tone: 'system' };
  const level = location.locationLevelCode;
  return level === null
    ? { name: 'place', tone: 'none' }
    : { name: LEVEL_ICONS[level], tone: level.toLowerCase() };
};

/** 단계 이름 — 서버가 만든 자리는 그 역할 이름(창고 전체 · 적치 대기). */
export const levelNameOf = (location: LevelSubject): string | null => {
  if (location.systemRoleCode === SYSTEM_LOCATION_ROLE.putawayStaging) {
    return t.values.systemRoles.PUTAWAY_STAGING;
  }
  if (location.systemRoleCode === SYSTEM_LOCATION_ROLE.warehouseWhole) {
    return t.values.systemRoles.WAREHOUSE_WHOLE;
  }
  const level = location.locationLevelCode;
  return level === null || level === undefined ? null : t.values.locationLevels[level];
};

export interface LocationIdentityProps {
  subject: LevelSubject;
  /** 위치 코드 — 추가할 때는 발행할 코드. */
  code: string;
  alias: string;
  /** 고칠 때만 — 추가할 때는 상태가 없다. */
  isActive?: boolean | undefined;
}

export interface IdentityHeaderProps {
  icon: { name: string; tone: string };
  /** 코드 위 작은 글자 — 위치는 단계, 창고는 「창고」. */
  kind: string | null;
  code: string;
  /** 코드의 접근성 이름 — 위치 코드 · 창고 코드. */
  codeLabel: string;
  /** 코드 옆 이름 — 위치는 별칭, 창고는 창고명. */
  name: string;
  /** 이름의 접근성 이름 — 주면 이름을 그 이름으로 찾을 수 있다(창고명). */
  nameLabel?: string | undefined;
  /** 상태 칩 앞에 둘 칩(불량 창고 · 외부 창고). */
  chips?: ReactNode;
  /** 고칠 때만 — 추가할 때는 상태가 없다. */
  isActive?: boolean | undefined;
}

/** 창 · 판 맨 위 — 아이콘 · 종류 · 코드 · 이름 · 상태를 한 줄로. 위치 창과 창고 정보가 같은 머리를 쓴다. */
export const IdentityHeader = ({
  icon,
  kind,
  code,
  codeLabel,
  name,
  nameLabel,
  chips,
  isActive,
}: IdentityHeaderProps) => {
  const trimmedName = name.trim();

  return (
    <div className="location-identity">
      <span className={`location-identity-icon is-${icon.tone}`}>
        <Icon name={icon.name} size={24} />
      </span>
      <div className="location-identity-text">
        {kind !== null && <span className="location-identity-level">{kind}</span>}
        <div className="location-identity-name">
          <output className="location-identity-code" aria-label={codeLabel}>
            {code}
          </output>
          {trimmedName !== '' &&
            (nameLabel === undefined ? (
              <span className="location-identity-alias">{trimmedName}</span>
            ) : (
              <output className="location-identity-alias" aria-label={nameLabel}>
                {trimmedName}
              </output>
            ))}
        </div>
      </div>
      {(chips !== undefined || isActive !== undefined) && (
        <div className="location-identity-chips">
          {chips}
          {isActive !== undefined && (
            <Chip size="sm" status={isActive ? 'success' : 'idle'}>
              {isActive ? t.values.active : t.values.inactive}
            </Chip>
          )}
        </div>
      )}
    </div>
  );
};

/** 수정 · 추가 창 맨 위 — 단계 아이콘 · 단계 · 코드 · 별칭 · 상태를 한 줄로. */
export const LocationIdentity = ({ subject, code, alias, isActive }: LocationIdentityProps) => (
  <IdentityHeader
    icon={levelIconOf(subject)}
    kind={levelNameOf(subject)}
    code={code}
    codeLabel={t.fields.locationCode}
    name={alias}
    isActive={isActive}
  />
);

export interface LocationFact {
  label: string;
  value: string;
  error?: string | undefined;
  /** 저장 전에 바꾼 값이면 참 — 이름 옆에 점을 찍는다. */
  changed?: boolean | undefined;
  /** 글자 대신 둘 컨트롤(창고의 불량 · 외부 스위치). 이름은 컨트롤이 스스로 갖는다. */
  control?: ReactNode;
  /**
   * 연필로 고치는 값(별칭 · 사업부 · 창고 유형) — 있으면 값 옆에 연필 단추, 누르면 그 자리에서 입력칸이 된다.
   * `select` 를 주면 입력칸 대신 선택칸이다 — `value` 는 보이는 이름, `select.value` 는 고른 값.
   */
  edit?: {
    onChange: (value: string) => void;
    disabled?: boolean;
    select?: { value: string; options: { value: string; label: string }[] } | undefined;
  };
}

/** 연필로 고치는 값 — 비었으면 「—」로 자리만. 고친 값은 창의 저장으로 함께 나간다. */
const EditableFact = ({
  fact,
  labelId,
}: {
  fact: LocationFact & { edit: NonNullable<LocationFact['edit']> };
  labelId: string;
}) => {
  const [editing, setEditing] = useState(false);
  const select = fact.edit.select;
  const current = select === undefined ? fact.value : select.value;
  const [original, setOriginal] = useState(current);

  if (editing && select !== undefined) {
    return (
      <div className="location-facts-edit">
        <Select
          size="sm"
          aria-labelledby={labelId}
          options={select.options}
          value={select.value}
          disabled={fact.edit.disabled}
          invalid={fact.error !== undefined}
          onChange={fact.edit.onChange}
        />
        <IconButton
          size="sm"
          icon="check"
          aria-label={t.factEdit.done(fact.label)}
          onClick={() => setEditing(false)}
        />
        {fact.error !== undefined && <span className="field-error">{fact.error}</span>}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="location-facts-edit">
        <TextField
          size="sm"
          aria-labelledby={labelId}
          value={fact.value}
          autoFocus
          disabled={fact.edit.disabled}
          error={fact.error}
          onChange={(event) => fact.edit.onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') setEditing(false);
            if (event.key === 'Escape') {
              /* 창이 닫히지 않게 — Esc 는 고치던 값만 되돌린다. */
              event.preventDefault();
              event.stopPropagation();
              fact.edit.onChange(original);
              setEditing(false);
            }
          }}
        />
        <IconButton
          size="sm"
          icon="check"
          aria-label={t.factEdit.done(fact.label)}
          onClick={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="location-facts-value">
      <output aria-labelledby={labelId} title={fact.value}>
        {fact.value.trim() === '' ? messages.common.reference.empty : fact.value}
      </output>
      <IconButton
        size="sm"
        icon="edit"
        aria-label={t.factEdit.start(fact.label)}
        disabled={fact.edit.disabled}
        onClick={() => {
          setOriginal(current);
          setEditing(true);
        }}
      />
      {fact.error !== undefined && <span className="field-error">{fact.error}</span>}
    </div>
  );
};

/** 고칠 수 없는 값 — 옅은 바탕의 한 판에 이름 · 값 두 열로. */
export const LocationFacts = ({ facts }: { facts: readonly LocationFact[] }) => {
  const baseId = useId();
  return (
    <dl className="location-facts">
      {facts.map((fact, index) => {
        const id = `${baseId}-${String(index)}`;
        return (
          <div
            key={fact.label}
            className={
              fact.changed === true ? 'location-facts-row is-changed' : 'location-facts-row'
            }
          >
            <dt id={id}>{fact.label}</dt>
            <dd>
              {fact.control !== undefined ? (
                fact.control
              ) : fact.edit === undefined ? (
                <output aria-labelledby={id} title={fact.value}>
                  {fact.value}
                </output>
              ) : (
                <EditableFact fact={{ ...fact, edit: fact.edit }} labelId={id} />
              )}
              {fact.error !== undefined && fact.edit === undefined && (
                <span className="field-error">{fact.error}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
};

/** 창 안의 묶음 — 짧은 제목과 얇은 선. */
export const DialogSection = ({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) => (
  <section
    className={className === undefined ? 'location-section' : `location-section ${className}`}
    aria-label={title}
  >
    <h3 className="location-section-title">{title}</h3>
    {children}
  </section>
);

/** 위치와 그 밑의 위치 수 — 삭제 · 사용 중지 확인에 보인다. */
export const countSubtree = (items: readonly Location[], locationId: number): number => {
  const children = new Map<number, number[]>();
  for (const item of items) {
    const parentId = item.parentLocationId;
    if (parentId === null || parentId === undefined || parentId === item.locationId) continue;
    children.set(parentId, [...(children.get(parentId) ?? []), item.locationId]);
  }
  const seen = new Set<number>();
  const stack = [locationId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return seen.size;
};

/**
 * 확인 창 본문 — 경고 아이콘 · 대상 코드(와 별칭 · 창고명) · 무엇이 바뀌는지 한 줄. 위치 · 창고 확인 창이 같은 모양이다.
 * 줄이 없으면(창고의 불량 · 외부 바꾸기 — 제목이 곧 바뀌는 것) 대상만 보인다.
 */
export const ConfirmTarget = ({
  tone,
  icon,
  code,
  name,
  line,
  children,
}: {
  tone: 'danger' | 'warning' | 'success';
  icon: string;
  code: string;
  name?: string | null | undefined;
  line?: string | undefined;
  /** 줄 아래에 덧붙일 것(창고를 끄기 전 남은 재고). */
  children?: ReactNode;
}) => {
  const alias = name?.trim() ?? '';
  return (
    <div className="location-confirm">
      <span className={`location-confirm-icon is-${tone}`}>
        <Icon name={icon} size={24} />
      </span>
      <div className="location-confirm-text">
        <p className="location-confirm-target">
          <strong>{code}</strong>
          {alias !== '' && <span className="location-confirm-alias">{alias}</span>}
        </p>
        {line !== undefined && <p className="location-confirm-line">{line}</p>}
        {children}
      </div>
    </div>
  );
};
