/**
 * The map stage: renders the world, region availability tint, and region
 * nodes; owns drag/zoom/auto-rotate interaction. Depends on the store's
 * narrow interface and a projection strategy — never on other UI components.
 */
import { d3, topojson } from '../lib.js';
import { REGION_META, DOMAIN_META, THEMES, domainColor, accentColor } from '../config.js';
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
    this.#attachZoomControls();
    this.startAutoRotate();

    store.subscribe(() => this.#onStateChange());
    this.repaint();
    // a deep link may arrive with a region already selected — center it
    if (this.lastRegion && REGION_META[this.lastRegion]) this.focusRegion(this.lastRegion);
  }

  get strategy() {
    return PROJECTIONS[this.store.getState().projection] || PROJECTIONS.globe;
  }

  get themeTokens() {
    return THEMES[this.store.getState().theme] || THEMES.light;
  }

  /**
   * The choropleth ramp follows the ACTIVE DOMAIN's hue — selecting
   * Agriculture paints the world in greens, Climate in blues — so the map
   * itself identifies what you are looking at. Ramps stay single-hue
   * tint→shade (monotonic lightness), derived from the validated domain
   * color; 'all domains' uses the validated accent ramp from THEMES.
   */
  #rampFor(domainKey) {
    const theme = this.store.getState().theme;
    if (domainKey === 'all') return this.themeTokens.availRamp;
    const cacheKey = `${theme}:${domainKey}`;
    if (!this.rampCache) this.rampCache = new Map();
    if (!this.rampCache.has(cacheKey)) {
      const c = domainColor(domainKey, theme);
      const ramp = theme === 'light'
        ? [
            d3.interpolateRgb('#f2f6f9', c)(0.14),
            d3.interpolateRgb('#f2f6f9', c)(0.45),
            c,
            d3.interpolateRgb(c, '#101b26')(0.35),
          ]
        : [
            d3.interpolateRgb('#0c1424', c)(0.18),
            d3.interpolateRgb('#0c1424', c)(0.48),
            c,
            d3.interpolateRgb(c, '#ffffff')(0.3),
          ];
      this.rampCache.set(cacheKey, ramp);
    }
    return this.rampCache.get(cacheKey);
  }

  #availColor(t) {
    return d3.interpolateRgbBasis(this.#rampFor(this.store.getState().domain))(t * 0.92);
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
    // in "All domains" mode each node wears a donut ring of its domain mix
    nodes.append('g').attr('class', 'domain-ring');
    nodes.append('text').attr('class', 'node-name');
    // the count renders in a solid pill so the number stays legible over
    // any map fill, in either theme
    const badge = nodes.append('g').attr('class', 'count-badge');
    badge.append('rect');
    badge.append('text');

    this.svg.on('click', (event) => {
      if (event.detail > 1) return; // part of a double-click zoom, not a deselect
      this.store.actions.selectRegion(null);
    });
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

  /** The legend gradient and label follow the active domain's ramp. */
  #paintLegend() {
    const { domain } = this.store.getState();
    const ramp = document.querySelector('.legend-ramp');
    if (ramp) ramp.style.background = `linear-gradient(90deg, ${this.#rampFor(domain).join(', ')})`;
    const label = document.querySelector('.legend-label');
    if (label) {
      label.textContent = domain === 'all'
        ? 'data availability'
        : `${DOMAIN_META[domain].name} data availability`;
    }
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

    // per-region domain mix for the "All domains" donut rings
    let regionDomainMix = null;
    if (state.domain === 'all') {
      regionDomainMix = {};
      for (const d of this.store.select.filtered()) {
        if (!REGION_META[d.region]) continue;
        (regionDomainMix[d.region] ||= {})[d.domain] =
          ((regionDomainMix[d.region] || {})[d.domain] || 0) + 1;
      }
    }

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
        .style('opacity', count === 0 ? 0.35 : 1)
        .attr('aria-label', `Browse ${meta.name} datasets — ${count} matching`);
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

      // "All domains": a donut ring showing this region's domain mix,
      // in fixed domain order with gaps between segments
      const ring = g.select('.domain-ring');
      if (!regionDomainMix || count === 0) {
        ring.selectAll('path').remove();
      } else {
        const mix = regionDomainMix[key] || {};
        const ordered = Object.keys(DOMAIN_META)
          .map((dk) => [dk, mix[dk] || 0])
          .filter(([, v]) => v > 0);
        const arcs = d3.pie().sort(null).padAngle(0.08).value((e) => e[1])(ordered);
        const arcGen = d3.arc().innerRadius(r + 2).outerRadius(r + 6).cornerRadius(1.5);
        ring.selectAll('path')
          .data(arcs)
          .join('path')
          .attr('d', arcGen)
          .attr('fill', (a) => domainColor(a.data[0], state.theme));
      }
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
        if (this.pinching) return; // two fingers = zoom, not rotation
        const k = 75 / (this.baseScale * this.scaleK);
        const dyPan = this.strategy.applyDrag(this.rotation, event.dx, event.dy, k);
        if (dyPan) this.offsetY = this.clampOffsetY(this.offsetY + dyPan);
        this.render();
      });
    this.svg.call(drag);

    this.svg.on('wheel', (event) => {
      event.preventDefault();
      this.stopAutoRotate();
      this.zoomBy(Math.pow(1.0016, -event.deltaY));
    }, { passive: false });

    // pinch zoom: two-finger distance ratio. Registered in the CAPTURE phase
    // so the handlers run before d3-drag's bubble-phase touch handlers (which
    // otherwise swallow the gesture); the pinching flag suppresses rotation.
    const node = this.svg.node();
    let pinchDist = 0;
    node.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        this.pinching = true;
        pinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: true, capture: true });
    node.addEventListener('touchmove', (e) => {
      if (this.pinching && e.touches.length === 2) {
        e.preventDefault();
        e.stopImmediatePropagation(); // keep d3-drag from fighting the pinch
        this.stopAutoRotate();
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
        if (pinchDist > 0) this.zoomBy(d / pinchDist);
        pinchDist = d;
      }
    }, { passive: false, capture: true });
    const endPinch = (e) => {
      if (!e.touches || e.touches.length < 2) this.pinching = false;
    };
    node.addEventListener('touchend', endPinch, { capture: true });
    node.addEventListener('touchcancel', endPinch, { capture: true });

    // double-tap / double-click steps the zoom in
    this.svg.on('dblclick', (event) => {
      event.preventDefault();
      this.stopAutoRotate();
      this.zoomBy(1.5);
    });

    addEventListener('resize', () => this.applyProjection());
  }

  /** Multiply the zoom factor, clamped, and re-render. */
  zoomBy(factor) {
    this.scaleK = Math.max(0.7, Math.min(6, this.scaleK * factor));
    this.offsetY = this.clampOffsetY(this.offsetY);
    this.render();
  }

  #attachZoomControls() {
    const zin = document.getElementById('zoom-in');
    const zout = document.getElementById('zoom-out');
    if (zin) zin.onclick = () => { this.stopAutoRotate(); this.zoomBy(1.35); };
    if (zout) zout.onclick = () => { this.stopAutoRotate(); this.zoomBy(1 / 1.35); };
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
    const { projection, region, theme, domain } = this.store.getState();
    if (theme !== this.lastTheme || domain !== this.lastDomain) {
      this.lastTheme = theme;
      this.lastDomain = domain;
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
