import type { FeatureCollection, Point } from 'geojson';
import {
  GeoJSONSource,
  type LngLatBoundsLike,
  type MapLayerMouseEvent,
  Map as MlMap,
  NavigationControl,
  setWorkerUrl,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre 6 loads its worker from a separate module. Vite's dep pre-bundling breaks the default relative URL,
// so emit the (self-contained) worker as an asset and point MapLibre at it.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BASEMAP_STYLE_URL, FLOOD_ATTRIBUTION, FLOOD_OVERLAYS, type FloodOverlay, wmsTileUrl } from '../config/layers';
import { TIER_COLOUR, TIER_LABEL, TIER_ORDER } from '../lib/tiers';
import type { PortfolioAsset, Tier } from '../types';
import styles from './RiskMap.module.css';

interface RiskMapProps {
  assets: readonly PortfolioAsset[];
  selectedId: string | null;
  onSelect: (assetId: string | null) => void;
}

setWorkerUrl(maplibreWorkerUrl);

const ASSET_SOURCE = 'assets';
const ASSET_LAYER = 'assets-circles';
const SELECTED_LAYER = 'assets-selected';
const overlayLayerId = (o: FloodOverlay): string => `flood-${o.id}`;

function toFeatureCollection(assets: readonly PortfolioAsset[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: assets.map((a) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.lon, a.lat] },
      properties: { asset_id: a.asset_id, tier: a.tier, value: a.value_gbp ?? 0 },
    })),
  };
}

function boundsOf(assets: readonly PortfolioAsset[]): LngLatBoundsLike | null {
  if (assets.length === 0) return null;
  let [w, s, e, n] = [180, 90, -180, -90];
  for (const a of assets) {
    w = Math.min(w, a.lon);
    e = Math.max(e, a.lon);
    s = Math.min(s, a.lat);
    n = Math.max(n, a.lat);
  }
  return [
    [w, s],
    [e, n],
  ];
}

export function RiskMap({ assets, selectedId, onSelect }: RiskMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const [overlays, setOverlays] = useState<Record<FloodOverlay['id'], boolean>>({
    rofrs: false,
    zones: false,
    rofsw: false,
  });
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  const initialAssets = useRef(assets);

  const selected = useMemo(() => assets.find((a) => a.asset_id === selectedId) ?? null, [assets, selectedId]);

  const tierCounts = useMemo(() => {
    const c: Record<Tier, number> = { act: 0, watch: 0, low: 0 };
    for (const a of assets) c[a.tier] += 1;
    return c;
  }, [assets]);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MlMap({
      container: containerRef.current,
      style: BASEMAP_STYLE_URL,
      center: [-1.0, 52.8],
      zoom: 5.6,
      attributionControl: { compact: false, customAttribution: FLOOD_ATTRIBUTION },
      cooperativeGestures: false,
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;
    if (import.meta.env.DEV) (window as unknown as { __riskMap?: MlMap }).__riskMap = map; // dev-only debug handle

    map.on('load', () => {
      // Flood overlays sit under the asset points and start hidden.
      for (const o of FLOOD_OVERLAYS) {
        map.addSource(overlayLayerId(o), {
          type: 'raster',
          tiles: [wmsTileUrl(o)],
          tileSize: 256,
          attribution: FLOOD_ATTRIBUTION,
        });
        map.addLayer({
          id: overlayLayerId(o),
          type: 'raster',
          source: overlayLayerId(o),
          layout: { visibility: 'none' },
          paint: { 'raster-opacity': 0.6 },
        });
      }
      map.addSource(ASSET_SOURCE, { type: 'geojson', data: toFeatureCollection(initialAssets.current) });
      map.addLayer({
        id: ASSET_LAYER,
        type: 'circle',
        source: ASSET_SOURCE,
        paint: {
          'circle-color': [
            'match',
            ['get', 'tier'],
            'act',
            TIER_COLOUR.act,
            'watch',
            TIER_COLOUR.watch,
            TIER_COLOUR.low,
          ],
          // Radius scales lightly with value (0 to about £3m).
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'value'],
            0,
            5,
            3_000_000,
            9,
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.25,
          'circle-opacity': 0.9,
        },
      });
      map.addLayer({
        id: SELECTED_LAYER,
        type: 'circle',
        source: ASSET_SOURCE,
        filter: ['==', ['get', 'asset_id'], ''],
        paint: {
          'circle-color': 'rgba(0,0,0,0)',
          'circle-radius': 12,
          'circle-stroke-color': '#1d2329',
          'circle-stroke-width': 2.5,
        },
      });

      map.on('click', ASSET_LAYER, (e: MapLayerMouseEvent) => {
        const id: unknown = e.features?.[0]?.properties.asset_id;
        if (typeof id === 'string') onSelectRef.current(id);
      });
      map.on('mouseenter', ASSET_LAYER, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', ASSET_LAYER, () => {
        map.getCanvas().style.cursor = '';
      });

      const b = boundsOf(initialAssets.current);
      if (b) map.fitBounds(b, { padding: 40, duration: 0 });
      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Keep points in sync with the (filtered) asset list.
  useEffect(() => {
    const src = mapRef.current?.getSource(ASSET_SOURCE);
    if (ready && src instanceof GeoJSONSource) void src.setData(toFeatureCollection(assets));
  }, [assets, ready]);

  // Highlight the selected asset.
  useEffect(() => {
    const map = mapRef.current;
    if (ready && map) map.setFilter(SELECTED_LAYER, ['==', ['get', 'asset_id'], selectedId ?? '']);
  }, [selectedId, ready]);

  // Flood overlay visibility.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const o of FLOOD_OVERLAYS) {
      map.setLayoutProperty(overlayLayerId(o), 'visibility', overlays[o.id] ? 'visible' : 'none');
    }
  }, [overlays, ready]);

  return (
    <div className={styles.wrap}>
      <div
        ref={containerRef}
        className={styles.map}
        role="region"
        aria-label="Map of portfolio assets coloured by risk tier. Use the asset table for keyboard access."
      />
      <div className={styles.panel}>
        <fieldset className={styles.group}>
          <legend className={styles.legendTitle}>Risk tier</legend>
          <ul className={styles.tiers}>
            {TIER_ORDER.map((t) => (
              <li key={t} className={styles.tierItem}>
                <span className={styles.swatch} style={{ background: TIER_COLOUR[t] }} aria-hidden="true" />
                <span>{TIER_LABEL[t]}</span>
                <span className={styles.count}>{tierCounts[t]}</span>
              </li>
            ))}
          </ul>
        </fieldset>
        {selected && (
          <p className={styles.selected} data-testid="map-selected">
            Selected <strong>{selected.asset_id}</strong> · {selected.la_name} · {TIER_LABEL[selected.tier]}
          </p>
        )}
        <fieldset className={styles.group}>
          <legend className={styles.legendTitle}>Flood layers (EA)</legend>
          {FLOOD_OVERLAYS.map((o) => (
            <label key={o.id} className={styles.toggle} title={o.description}>
              <input
                type="checkbox"
                checked={overlays[o.id]}
                onChange={(e) => {
                  setOverlays((prev) => ({ ...prev, [o.id]: e.target.checked }));
                }}
              />
              {o.label}
            </label>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
