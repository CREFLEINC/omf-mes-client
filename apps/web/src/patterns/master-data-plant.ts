import { useEffect, useRef } from 'react';

import { usePlantsAndOaCodes, usePlantMode, plantsInScope } from './oa-access';
import { useSession } from './session';

/*
 * 기준정보 목록의 공장 — 위 줄에서 고른 사업부(OA = PL13 · 부품 = PL11)의 공장 것만 조회한다(사용자 결정 2026-11-25).
 * 한쪽 공장만 가진 계정은 그 공장으로 고정된다.
 */

export interface MasterDataPlantOption {
  value: string;
  label: string;
}

export interface MasterDataPlant {
  /** 아직 공장을 정하는 중 — 목록 조회를 미룬다(다른 공장 것이 잠깐 보이지 않게). */
  isChecking: boolean;
  /** 이 동작의 공장 번호들. `null` 이면 판단할 근거가 없어 좁히지 않는다. */
  plantIds: ReadonlySet<number> | null;
  /** 목록 질의에 실을 공장(Select 값 모양). 빈 문자열이면 공장으로 거르지 않는다. */
  plantId: string;
  /** 사용자가 고른 공장 — 고를 것이 없으면 빈 문자열(주소에 남은 옛 값은 버린다). */
  picked: string;
  /** 공장 선택칸의 선택지. `null` 이면 화면의 것(「전체」 포함), 빈 배열이면 고를 것이 없어 칸을 감춘다. */
  options: MasterDataPlantOption[] | null;
}

/**
 * 조회할 공장. ⛔ 사업부에 매이지 않은 공장은 어느 사업부 것도 아니므로 뺀다.
 *
 * @param requested 공장 선택칸에서 고른 값 — 그 사업부의 공장이 여럿일 때만 쓴다
 */
export const useMasterDataPlant = (requested = ''): MasterDataPlant => {
  const { session } = useSession();
  const lookup = usePlantsAndOaCodes();
  const { mixed, mode } = usePlantMode();

  const unrestricted = {
    isChecking: session !== null && session !== undefined && lookup.isPending,
    plantIds: null,
    plantId: requested,
    picked: requested,
    options: null,
  };
  if (session === null || session === undefined || lookup.data === undefined) return unrestricted;

  const { codes, plants } = lookup.data;
  const scoped = plantsInScope(session.scopes, plants).filter(
    (plant) => plant.isActive !== false && typeof plant.businessUnitId === 'number',
  );
  const mine = mixed
    ? scoped.filter((plant) => codes.has(plant.plantCode) === (mode === 'oa'))
    : scoped;
  if (mine.length === 0) return unrestricted;

  const options =
    mine.length === 1
      ? []
      : mine.map((plant) => ({ value: String(plant.plantId), label: plant.plantName }));
  const picked = options.some((option) => option.value === requested) ? requested : '';

  return {
    isChecking: false,
    plantIds: new Set(mine.map((plant) => plant.plantId)),
    plantId: picked === '' ? String(mine[0]!.plantId) : picked,
    picked,
    options,
  };
};

/** 공장 선택칸이 낼 것 — `null` 이면 칸을 감춘다. */
export const plantSelectOf = (
  plant: Pick<MasterDataPlant, 'options' | 'plantId'> | undefined,
  value: string,
  all: MasterDataPlantOption[],
): { options: MasterDataPlantOption[]; value: string } | null => {
  if (plant === undefined || plant.options === null) return { options: all, value };
  if (plant.options.length === 0) return null;
  return { options: plant.options, value: value === '' ? plant.plantId : value };
};

/** 사업부를 바꿔 조회 공장이 달라졌을 때 — 다른 공장에서 고른 것을 푼다. 처음 정해질 때는 부르지 않는다. */
export const useOnMasterDataPlantChange = (plant: MasterDataPlant, onChange: () => void): void => {
  const decided = plant.plantIds === null ? null : [...plant.plantIds].join(',');
  const previous = useRef(decided);
  const latest = useRef(onChange);
  latest.current = onChange;

  useEffect(() => {
    if (decided === null) return;
    const before = previous.current;
    previous.current = decided;
    if (before !== null && before !== decided) latest.current();
  }, [decided]);
};
