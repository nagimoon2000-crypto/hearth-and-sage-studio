// Enable a checkout only after verifying the PUBLIC listing, not the publisher portal.
export const catalog = [
  {
    id: 'cozy-cafe', name: 'Cozy Café Props', version: '0.1.1',
    count: 40, triangles: 8952, materials: 10,
    unity: { status: 'pending_review', checked: '2026-11-03', url: null },
    fab: { status: 'approved_unpublished', checked: '2026-11-03', url: null },
    sample: null,
  },
  {
    id: 'mini-planet', name: 'Mini Planet Settlements', version: '0.1.0',
    count: 25, triangles: 7159, materials: 12,
    unity: { status: 'pending_review', checked: '2026-11-03', url: null },
    fab: { status: 'approved_unpublished', checked: '2026-11-03', url: null },
    sample: null,
  },
];
// GitHub Pages has no collector. Keep null unless a same-origin collector is deployed.
export const collector = null;
