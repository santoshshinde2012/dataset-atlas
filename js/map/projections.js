/**
 * Projection strategies. Both entries satisfy the same interface, so the
 * map view treats them interchangeably (Liskov substitution) and a new
 * projection is one more registry entry (open/closed). The contract MapView
 * relies on:
 *
 *   create(d3): d3 projection instance
 *   baseScale(width, height): fit-to-viewport scale
 *   rotate(rotation): the [λ, φ, γ] actually applied for a logical rotation
 *   applyDrag(rotation, dx, dy, k): mutate rotation for a drag gesture;
 *     returns the vertical pan delta in screen px (0 when the projection
 *     pans by rotation only)
 *   isVisible(d3, projection, lonLat): whether a point should render
 *   focusLat(lat, rotation): target φ rotation when focusing a region centroid
 *   halfHeightRatio: projected map half-height per unit of scale
 *     (used to clamp vertical panning; only meaningful with supportsVerticalPan)
 *   supportsVerticalPan / autoRotates: capability flags
 */

export const PROJECTIONS = {
  globe: {
    key: 'globe',
    create: (d3) => d3.geoOrthographic(),
    baseScale: (w, h) => Math.min(w, h) / 2.25,
    rotate: (rotation) => rotation,
    applyDrag(rotation, dx, dy, k) {
      rotation[0] += dx * k;
      rotation[1] = Math.max(-70, Math.min(70, rotation[1] - dy * k));
      return 0; // no vertical pan delta
    },
    isVisible(d3, projection, lonLat) {
      const r = projection.rotate();
      return d3.geoDistance(lonLat, [-r[0], -r[1]]) < Math.PI / 2 - 0.06;
    },
    focusLat: (lat) => -Math.max(-55, Math.min(55, lat)),
    halfHeightRatio: 1, // sphere radius = scale; unused (no vertical pan)
    supportsVerticalPan: false,
    autoRotates: true,
  },

  flat: {
    key: 'flat',
    create: (d3) => d3.geoNaturalEarth1(),
    baseScale: (w, h) => Math.min(w / 5.8, h / 2.9),
    rotate: (rotation) => [rotation[0], 0, 0],
    applyDrag(rotation, dx, dy, k) {
      rotation[0] += dx * k * 0.9;
      return dy; // vertical pan delta in screen pixels
    },
    isVisible: () => true,
    focusLat: (lat, rotation) => rotation[1],
    halfHeightRatio: 1.45, // Natural Earth projected half-height ≈ 1.45 · scale
    supportsVerticalPan: true,
    autoRotates: false,
  },
};
