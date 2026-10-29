import { Chip, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import type { LocationLevelCode } from '../../patterns/location-level';
import {
  isPutawayStaging,
  isSystemLocation,
  SYSTEM_LOCATION_ROLE,
  type SystemLocationFields,
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

type LevelSubject = Pick<Location, 'locationLevelCode'> & SystemLocationFields;

export const levelIconOf = (location: LevelSubject): { name: string; tone: string } => {
  if (isPutawayStaging(location)) return { name: 'move_to_inbox', tone: 'system' };
  if (isSystemLocation(location)) return { name: 'warehouse', tone: 'system' };
  const level = location.locationLevelCode ?? null;
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
  const level = location.locationLevelCode ?? null;
  return level === null ? null : t.values.locationLevels[level];
};

export interface LocationIdentityProps {
  subject: LevelSubject;
  /** 위치 코드 — 추가할 때는 발행할 코드. */
  code: string;
  alias: string;
  /** 고칠 때만 — 추가할 때는 상태가 없다. */
  isActive?: boolean | undefined;
}

/** 수정 · 추가 창 맨 위 — 단계 아이콘 · 단계 · 코드 · 별칭 · 상태를 한 줄로. */
export const LocationIdentity = ({ subject, code, alias, isActive }: LocationIdentityProps) => {
  const icon = levelIconOf(subject);
  const levelName = levelNameOf(subject);
  const trimmedAlias = alias.trim();

  return (
    <div className="location-identity">
      <span className={`location-identity-icon is-${icon.tone}`}>
        <Icon name={icon.name} size={24} />
      </span>
      <div className="location-identity-text">
        {levelName !== null && <span className="location-identity-level">{levelName}</span>}
        <div className="location-identity-name">
          <output className="location-identity-code" aria-label={t.fields.locationCode}>
            {code}
          </output>
          {trimmedAlias !== '' && <span className="location-identity-alias">{trimmedAlias}</span>}
        </div>
      </div>
      {isActive !== undefined && (
        <Chip size="sm" status={isActive ? 'success' : 'idle'}>
          {isActive ? t.values.active : t.values.inactive}
        </Chip>
      )}
    </div>
  );
};

export interface LocationFact {
  label: string;
  value: string;
  error?: string | undefined;
}

/** 고칠 수 없는 값 — 옅은 바탕의 한 판에 이름 · 값 두 열로. */
export const LocationFacts = ({ facts }: { facts: readonly LocationFact[] }) => {
  const baseId = useId();
  return (
    <dl className="location-facts">
      {facts.map((fact, index) => {
        const id = `${baseId}-${String(index)}`;
        return (
          <div key={fact.label} className="location-facts-row">
            <dt id={id}>{fact.label}</dt>
            <dd>
              <output aria-labelledby={id}>{fact.value}</output>
              {fact.error !== undefined && <span className="field-error">{fact.error}</span>}
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

/** 확인 창 본문 — 경고 아이콘 · 대상 코드(와 별칭) · 영향받는 위치 수 한 줄. */
export const ConfirmTarget = ({
  tone,
  icon,
  target,
  line,
}: {
  tone: 'danger' | 'warning' | 'success';
  icon: string;
  target: Pick<Location, 'locationCode' | 'aliasName'>;
  line: string;
}) => {
  const alias = target.aliasName?.trim() ?? '';
  return (
    <div className="location-confirm">
      <span className={`location-confirm-icon is-${tone}`}>
        <Icon name={icon} size={24} />
      </span>
      <div className="location-confirm-text">
        <p className="location-confirm-target">
          <strong>{target.locationCode}</strong>
          {alias !== '' && <span className="location-confirm-alias">{alias}</span>}
        </p>
        <p className="location-confirm-line">{line}</p>
      </div>
    </div>
  );
};
