import { Card } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

import './shell-home.css';

const t = messages.shellHome;

/**
 * 화면 목록.
 *
 * 관리웹은 좌측 레일로 옮겨 다니지만 이 셸은 그 자리를 두지 않는다 - 폭이 좁고 한 손으로
 * 장갑을 낀 채 쓰므로, 설계가 세 셸의 IA 를 각각 다르게 정했다. 관리웹은 메뉴 트리, POP 은
 * 태스크 모드, 모바일은 스캔 퍼스트 홈 타일이다.
 *
 * 묶음과 그 안의 차례는 설계 IA 의 타일을 그대로 따른다 - 우리가 다시 묶으면 화면이 늘 때
 * 어디에 넣을지가 매번 판단이 되고, 설계가 정한 자리와 조금씩 어긋난다.
 *
 * 글자 링크로 두지 않는다 - 기본 링크는 글자 높이만큼만 눌리고 그 높이는 손가락보다 작다.
 */
const tiles = [
  {
    label: t.tiles.inbound,
    screens: [
      { to: '/inbound-receipt', label: messages.inboundReceipt.title },
      { to: '/inbound-variance', label: messages.inboundVariance.title },
    ],
  },
  {
    label: t.tiles.putaway,
    screens: [
      { to: '/material-location', label: messages.materialLocation.title },
      { to: '/putaway', label: messages.putaway.title },
      { to: '/temporary-putaway', label: messages.temporaryPutaway.title },
    ],
  },
  {
    label: t.tiles.picking,
    screens: [{ to: '/material-picking', label: messages.materialPicking.title }],
  },
  {
    label: t.tiles.urgent,
    screens: [{ to: '/iqc-skip-request', label: messages.iqcSkipRequest.title }],
  },
  {
    label: t.tiles.productionMove,
    screens: [
      { to: '/wip-handover', label: messages.wipHandover.title },
      { to: '/repair-roundtrip', label: messages.repairRoundtrip.title },
    ],
  },
  {
    label: t.tiles.shipment,
    screens: [
      { to: '/product-picking', label: messages.productPicking.title },
      { to: '/packing-repack', label: messages.packingRepack.title },
    ],
  },
  {
    label: t.tiles.equipment,
    screens: [
      { to: '/equipment-inspection', label: messages.equipmentInspection.title },
      { to: '/equipment-failure', label: messages.equipmentFailureReport.title },
    ],
  },
  {
    label: t.shell,
    screens: [{ to: '/rejections', label: messages.outboxRejections.title }],
  },
];

export const ShellHome = () => {
  return (
    <nav aria-label={t.label} className="shell-home">
      {tiles.map((tile) => (
        <section key={tile.label} className="shell-home__group">
          <h2>{tile.label}</h2>
          <ul className="shell-home__tiles">
            {tile.screens.map((screen) => (
              <li key={screen.to}>
                <Link to={screen.to} className="shell-home__tile">
                  <Card bordered>
                    <Card.Body className="card-body">
                      <strong>{screen.label}</strong>
                    </Card.Body>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
};
