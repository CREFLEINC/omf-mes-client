import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { FitName } from '../../patterns/fit-name';
import type { PendingLotLookup } from './direct';
import type { TerminalWarehouse } from './queries';

const d = messages.putaway.direct;

type Designated = NonNullable<PendingLotLookup['designated']>;

/** 서버가 위치 경로를 잇는 글자 — 「창고 › 구역 › 랙 › 단」(omf-mes-server `locationPaths`). */
const PATH_SEPARATOR = ' › ';

interface TreeNode {
  key: string;
  /** 창고 코드 · 위치 코드 — 중간 단계(구역 · 랙 …)는 경로에 이름만 와서 없다. */
  code: string | null;
  name: string;
  /** 위치(맨 아래) — 코드가 스캔할 라벨이다. */
  leaf: boolean;
  /** 「지정 위치 없음」 같은 안내 줄. */
  note?: boolean;
  children: TreeNode[];
}

interface TreeRow {
  node: TreeNode;
  depth: number;
  /** 윗 단계마다 세로선을 이어 그리는가(그 단계에 아래 형제가 남았나). 뿌리는 없다. */
  rails: boolean[];
  isLast: boolean;
}

/**
 * 창고 › 구역 › 랙 › … › 위치 나무. 중간 단계는 경로의 이름으로 묶는다(같은 부모 아래 같은 이름은 한 마디). 경로의 첫
 * 이름은 창고 이름이라 뺀다. 지정 위치가 없으면 이 PDA 창고 아래 「지정 위치 없음」 한 줄.
 */
const treeOf = (
  designated: Designated,
  terminalWarehouse: TerminalWarehouse | null | undefined,
  codeOf: (warehouseId: number) => string | undefined,
): TreeNode[] => {
  if (designated.length === 0) {
    return terminalWarehouse === null || terminalWarehouse === undefined
      ? []
      : [
          {
            key: `w${String(terminalWarehouse.warehouseId)}`,
            code: codeOf(terminalWarehouse.warehouseId) ?? null,
            name: terminalWarehouse.warehouseName,
            leaf: false,
            children: [
              {
                key: `w${String(terminalWarehouse.warehouseId)}/none`,
                code: null,
                name: d.designatedAnywhere,
                leaf: true,
                note: true,
                children: [],
              },
            ],
          },
        ];
  }

  return designated.map((warehouse) => {
    const root: TreeNode = {
      key: `w${String(warehouse.warehouseId)}`,
      code: codeOf(warehouse.warehouseId) ?? null,
      name: warehouse.warehouseName,
      leaf: false,
      children: [],
    };

    for (const location of warehouse.locations) {
      const names = location.locationPath.split(PATH_SEPARATOR);
      /* 경로의 첫 이름은 창고다. 경로를 못 받아 코드만 왔으면 위치를 창고 바로 아래에 둔다. */
      const steps = names[0] === warehouse.warehouseName ? names.slice(1) : names;
      const leafName = steps.at(-1) ?? location.locationCode;
      let parent = root;

      for (const name of steps.slice(0, -1)) {
        const key = `${parent.key}/${name}`;
        let next = parent.children.find((child) => child.key === key && !child.leaf);
        if (next === undefined) {
          next = { key, code: null, name, leaf: false, children: [] };
          parent.children.push(next);
        }
        parent = next;
      }

      parent.children.push({
        key: `l${String(location.locationId)}`,
        code: location.locationCode,
        name: location.aliasName ?? (leafName === location.locationCode ? '' : leafName),
        leaf: true,
        children: [],
      });
    }

    return root;
  });
};

const flatten = (nodes: readonly TreeNode[], depth = 0, rails: boolean[] = []): TreeRow[] =>
  nodes.flatMap((node, index) => {
    const isLast = index === nodes.length - 1;

    return [
      { node, depth, rails, isLast },
      ...flatten(node.children, depth + 1, depth === 0 ? [] : [...rails, !isLast]),
    ];
  });

/**
 * 적치 위치 후보 나무(사용자 지시 2026-11-23 「관리웹의 BOM 처럼 하이라키를 주어 아래에」) — 창고를 맨 위에, 그 아래
 * 구역 · 랙 · 단을 단계마다 들여 쓰고 점선으로 잇는다(관리웹 BOM 하이라키 칸과 같은 연결선). 맨 아래 줄이 위치 코드다 —
 * 그 라벨을 스캔한다. 모두 펼친 채로 둔다(후보가 몇 줄뿐이라 접을 일이 없다). 줄은 누르지 않는다.
 */
export const DesignatedTree = ({
  designated,
  terminalWarehouse,
  codeOf,
}: {
  designated: Designated;
  /** 이 PDA 의 창고 — 지정 위치가 없을 때만 쓴다. */
  terminalWarehouse: TerminalWarehouse | null | undefined;
  codeOf: (warehouseId: number) => string | undefined;
}) => {
  const rows = flatten(treeOf(designated, terminalWarehouse, codeOf));

  return (
    <ul className="loc-tree" role="tree" aria-label={d.designatedLabel}>
      {rows.map(({ node, depth, rails, isLast }) => (
        <li
          key={node.key}
          role="treeitem"
          aria-level={depth + 1}
          aria-expanded={node.leaf ? undefined : true}
          className="loc-tree__row"
          data-depth={depth}
          data-leaf={node.leaf}
        >
          {rails.map((pass, level) => (
            <span
              /* 단계 자리라 순서가 곧 열쇠다. */
              key={level}
              className="loc-tree__rail"
              data-line={pass ? 'pass' : 'none'}
              aria-hidden="true"
            />
          ))}
          {depth > 0 ? (
            <span
              className="loc-tree__rail"
              data-line={isLast ? 'elbow' : 'tee'}
              aria-hidden="true"
            />
          ) : null}
          {node.leaf ? (
            <span className="loc-tree__spacer" data-branch={depth > 0} aria-hidden="true" />
          ) : (
            /* 펼친 마디 — 아래 자식으로 세로선을 내린다(관리웹 BOM 의 펼친 단추 자리). */
            <span className="loc-tree__marker" aria-hidden="true">
              <Icon name="expand_more" size={18} />
            </span>
          )}
          <span className="loc-tree__label">
            {node.code === null ? null : (
              <FitName className="loc-tree__code" text={node.code} min={10} lines={1} whole />
            )}
            {node.name === '' ? null : (
              <span
                className={node.note === true ? 'loc-tree__name loc-tree__note' : 'loc-tree__name'}
              >
                {node.name}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
};
