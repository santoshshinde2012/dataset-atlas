/**
 * The map stage: renders the world, region availability tint, and region
 * nodes; owns drag/zoom/auto-rotate interaction. Depends on the store's
 * narrow interface and a projection strategy — never on other UI components.
 */
import { d3, topojson } from '../lib.js';
import { REGION_META, THEMES, domainColor, accentColor } from '../config.js';
import { PROJECTIONS } from './projections.js';

export class MapView {
  /**
   * @param {object} deps
   * @param {SVGSVGElement} deps.svgElement
   * @param {object} deps.world TopoJSON world topology
   * @param {Record<string, string>} deps.countryRegion ISO-numeric → region key
   * @param {object} deps.store
   * @param {{show: Function, move: Function, hide: Function}} deps.tooltip
   */
  constructor({ svgElement, world, countryRegion, countryCodes = {}, store, tooltip }) {
    this.svg = d3.select(svgElement);
    this.world = world;
    this.countryRegion = countryRegion;
    this.countryCodes = countryCodes;
    this.store = store;
    this.tooltip = tooltip;

    this.rotation = [-20, -18, 0];
    this.scaleK = 1;
    this.offsetY = 0;
    this.interacted = false;
    this.autoTimer = null;
    this.lastProjectionKey = store.getState().projection;
    this.lastRegion = store.getState().region;
    this.lastTheme = store.getState().theme;

    this.#buildScene();
    this.#paintLegend();
    this.applyProjection();
    this.#attachInteractions();
    this.startAutoRotate();

    store.subscribe(() => this.#onStateChange());
    this.repaint();
  }

  get strategy() {
    return PROJECTIONS[this.store.getState().projection] || PROJECTIONS.globe;
  }

  get themeTokens() {
    return THEMES[this.store.getState().theme] || THEMES.light;
  }

  #availColor(t) {
    return d3.interpolateRgbBasis(this.themeTokens.availRamp)(t * 0.92);
  }

  /* ---------- scene construction ---------- */

  #buildScene() {
    this.svg.selectAll('*').remove();
    this.gSphere = this.svg.append('g');
    this.gGraticule = this.svg.append('g');
    this.gCountries = this.svg.append('g');
    this.gNodes = this.svg.append('g');

    this.gSphere.append('path').attr('class', 'sphere-fill').datum({ type: 'Sphere' });
    this.gSphere.append('path').attr('class', 'sphere-glow').datum({ type: 'Sphere' });
    this.gGraticule.append('path').attr('class', 'graticule').datum(d3.geoGraticule10());

    const countries = topojson.feature(this.world, this.world.objects.countries).features;
    this.gCountries.selectAll('path')
      .data(countries)
      .join('path')
      .attr('class', 'country')
      .attr('data-region', (d) => this.countryRegion[d.id] || '')
      .on('pointerenter', (event, d) => this.#onCountryEnter(event, d))
      .on('pointermove', (event, d) => {
        if (this.countryRegion[d.id]) this.tooltip.move(event);
      })
      .on('pointerleave', () => this.#onCountryLeave())
      .on('click', (event, d) => {
        const region = this.countryRegion[d.id];
        if (region) {
          event.stopPropagation();
          // remember which country opened the region — its datasets sort first
          this.store.actions.selectRegion(region, this.countryCodes[d.id]?.cca2 || null);
        }
      });

    const nodes = this.gNodes.selectAll('g')
      .data(Object.entries(REGION_META))
      .join('g')
      .attr('class', 'region-node')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', ([, meta]) => `Browse ${meta.name} datasets`)
      .on('click', (event, [key]) => {
        event.stopPropagation();
        this.store.actions.selectRegion(key);
      })
      .on('keydown', (event, [key]) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.store.actions.selectRegion(key);
        }
      })
      .on('pointerenter', (event, [key]) => {
        this.stopAutoRotate();
        this.tooltip.show(event, key);
      })
      .on('pointermove', (event) => this.tooltip.move(event))
      .on('pointerleave', () => this.tooltip.hide());

    nodes.append('circle').attr('class', 'halo');
    nodes.append('circle').attr('class', 'core');
    nodes.append('text').attr('class', 'node-name');
    // the count renders in a solid pill so the number stays legible over
    // any map fill, in either theme
    const badge = nodes.append('g').attr('class', 'count-badge');
    badge.append('rect');
    badge.append('text');

    this.svg.on('click', () => this.store.actions.selectRegion(null));
  }

  #onCountryEnter(event, d) {
    const region = this.countryRegion[d.id];
    if (!region) return;
    this.stopAutoRotate();
    this.gCountries.classed('region-hover', true);
    this.gCountries.selectAll(`.country[data-region="${region}"]`).classed('hovered-region', true);
    // outline the exact country under the pointer, distinct from its region
    d3.select(event.currentTarget).classed('hovered-country', true).raise();
    this.tooltip.show(event, region, d.id);
  }

  /** The legend gradient is derived from the same ramp as the choropleth. */
  #paintLegend() {
    const ramp = document.querySelector('.legend-ramp');
    if (ramp) ramp.style.background = `linear-gradient(90deg, ${this.themeTokens.availRamp.join(', ')})`;
  }

  #onCountryLeave() {
    this.gCountries.classed('region-hover', false);
    this.gCountries.selectAll('.country').classed('hovered-region', false).classed('hovered-country', false);
    this.tooltip.hide();
  }

  /* ---------- projection & geometry ---------- */

  applyProjection() {
    this.width = innerWidth;
    this.height = innerHeight;
    this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
    const s = this.strategy;
    this.projection = s.create(d3).rotate(s.rotate(this.rotation));
    this.baseScale = s.baseScale(this.width, this.height);
    this.offsetY = this.clampOffsetY(this.offsetY); // pan bounds change with viewport/scale
    this.geoPath = d3.geoPath(this.projection);
    this.render();
  }

  #panY() {
    return this.strategy.supportsVerticalPan ? this.offsetY : 0;
  }

  clampOffsetY(v) {
    // keep the viewport center inside the projected map
    const s = this.strategy;
    if (!s.supportsVerticalPan) return 0;
    const limit = Math.max(0, s.halfHeightRatio * this.baseScale * this.scaleK - this.height / 2);
    return Math.max(-limit, Math.min(limit, v));
  }

  render() {
    this.projection
      .scale(this.baseScale * this.scaleK)
      .translate([this.width / 2, this.height / 2 + this.#panY()])
      .rotate(this.strategy.rotate(this.rotation));
    this.gSphere.selectAll('path').attr('d', this.geoPath);
    this.gGraticule.select('path').attr('d', this.geoPath);
    this.gCountries.selectAll('path').attr('d', this.geoPath);
    this.positionNodes();
  }

  /** Cheap updates that follow filter changes (no path regeneration). */
  repaint() {
    this.paintCountries();
    this.positionNodes();
  }

  paintCountries() {
    const counts = this.store.select.regionCounts();
    const max = Math.max(1, ...Object.keys(REGION_META).map((k) => counts[k]));
    this.gCountries.selectAll('path').attr('fill', (d) => {
      const region = this.countryRegion[d.id];
      if (!region) return this.themeTokens.noRegionFill;
      return this.#availColor(Math.sqrt(counts[region] / max));
    });
  }

  positionNodes() {
    const counts = this.store.select.regionCounts();
    const max = Math.max(1, ...Object.keys(REGION_META).map((k) => counts[k]));
    const rScale = d3.scaleSqrt().domain([0, max]).range([5, 24]);
    const state = this.store.getState();
    const nodeColor = state.domain === 'all'
      ? accentColor(state.theme)
      : domainColor(state.domain, state.theme);
    const s = this.strategy;

    const self = this;
    // scope to the node class — each node contains a nested count-badge <g>
    this.gNodes.selectAll('g.region-node').each(function ([key, meta]) {
      const g = d3.select(this);
      const visible = s.isVisible(d3, self.projection, meta.centroid);
      g.attr('display', visible ? null : 'none');
      if (!visible) return;
      const [x, y] = self.projection(meta.centroid);
      const count = counts[key];
      const r = rScale(count);
      g.attr('transform', `translate(${x},${y})`)
        .classed('selected', state.region === key)
        .style('opacity', count === 0 ? 0.35 : 1);
      g.select('.halo').attr('r', r + 9).attr('fill', nodeColor).attr('opacity', 0.14);
      g.select('.core').attr('r', r).attr('fill', nodeColor).attr('fill-opacity', 0.4);
      g.select('.node-name').attr('y', -r - 10).text(meta.name);

      const badge = g.select('.count-badge');
      const label = badge.select('text').text(count).attr('y', 3.5);
      const w = Math.max(22, label.node().getComputedTextLength() + 13);
      badge.select('rect')
        .attr('x', -w / 2)
        .attr('y', -9)
        .attr('width', w)
        .attr('height', 18)
        .attr('rx', 9)
        .attr('stroke', nodeColor);
    });
  }

  /* ---------- interactions ---------- */

  #attachInteractions() {
    this.svg.on('pointerdown.autorotate', () => this.stopAutoRotate());

    const drag = d3.drag()
      .on('start', () => {
        this.stopAutoRotate();
        this.svg.interrupt('focus');
      })
      .on('drag', (event) => {
        const k = 75 / (this.baseScale * this.scaleK);
        const dyPan = this.strategy.applyDrag(this.rotation, event.dx, event.dy, k);
        if (dyPan) this.offsetY = this.clampOffsetY(this.offsetY + dyPan);
        this.render();
      });
    this.svg.call(drag);

    this.svg.on('wheel', (event) => {
      event.preventDefault();
      this.stopAutoRotate();
      const factor = Math.pow(1.0016, -event.deltaY);
      this.scaleK = Math.max(0.7, Math.min(6, this.scaleK * factor));
      this.offsetY = this.clampOffsetY(this.offsetY);
      this.render();
    }, { passive: false });

    addEventListener('resize', () => this.applyProjection());
  }

  startAutoRotate() {
    if (this.autoTimer || !this.strategy.autoRotates || this.interacted) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let last = 0;
    this.autoTimer = d3.timer((elapsed) => {
      this.rotation[0] += (elapsed - last) * 0.004;
      last = elapsed;
      this.render();
    });
  }

  /** Halt the timer without recording a user interaction (programmatic pauses). */
  #haltTimer() {
    if (this.autoTimer) {
      this.autoTimer.stop();
      this.autoTimer = null;
    }
  }

  /** User pointer interaction: halt and never auto-resume. */
  stopAutoRotate() {
    this.interacted = true;
    this.#haltTimer();
  }

  focusRegion(key) {
    const meta = REGION_META[key];
    if (!meta) return;
    this.stopAutoRotate();
    const [lon, lat] = meta.centroid;
    let dl = (-lon - this.rotation[0]) % 360;
    if (dl > 180) dl -= 360;
    if (dl < -180) dl += 360;
    const targetLon = this.rotation[0] + dl;
    const targetLat = this.strategy.focusLat(lat, this.rotation);
    const targetOffsetY = this.strategy.supportsVerticalPan
      ? this.clampOffsetY(this.offsetY + (this.height / 2 - this.projection([lon, lat])[1]))
      : this.offsetY;
    const interp = d3.interpolate(
      [this.rotation[0], this.rotation[1], this.offsetY],
      [targetLon, targetLat, targetOffsetY]
    );
    this.svg.transition('focus').duration(750).ease(d3.easeCubicOut).tween('rotate', () => (t) => {
      const r = interp(t);
      this.rotation[0] = r[0];
      this.rotation[1] = r[1];
      this.offsetY = r[2];
      this.render();
    });
  }

  /* ---------- store reaction ---------- */

  #onStateChange() {
    const { projection, region, theme } = this.store.getState();
    if (theme !== this.lastTheme) {
      this.lastTheme = theme;
      this.#paintLegend();
    }
    if (projection !== this.lastProjectionKey) {
      this.lastProjectionKey = projection;
      this.offsetY = 0;
      // a projection toggle is not a map interaction: ambient rotation may
      // resume when the user returns to the globe untouched
      this.#haltTimer();
      this.applyProjection();
      this.startAutoRotate();
    }
    if (region !== this.lastRegion) {
      this.lastRegion = region;
      if (region && REGION_META[region]) this.focusRegion(region);
    }
    this.repaint();
  }
}
