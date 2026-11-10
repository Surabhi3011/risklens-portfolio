// Map basemap and EA flood overlays. All open: OpenFreeMap (ODbL data) and EA WMS (OGL). No keys.
// WMS endpoints from environment.data.gov.uk (checked 2026-11-10: GetCapabilities lists EPSG:3857).
// The overlays are visual context only. Asset flood bands are always pre-computed in the ETL.

export const BASEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

export interface FloodOverlay {
  id: 'rofrs' | 'zones' | 'rofsw';
  label: string;
  description: string;
  wmsUrl: string;
  layer: string;
}

export const FLOOD_OVERLAYS: readonly FloodOverlay[] = [
  {
    id: 'rofrs',
    label: 'Rivers and sea',
    description: 'EA Risk of Flooding from Rivers and Sea',
    wmsUrl: 'https://environment.data.gov.uk/spatialdata/nafra2-risk-of-flooding-from-rivers-and-sea/wms',
    layer: 'rofrs_4band',
  },
  {
    id: 'zones',
    label: 'Flood Zones 2 and 3',
    description: 'EA Flood Map for Planning',
    wmsUrl: 'https://environment.data.gov.uk/spatialdata/flood-map-for-planning-flood-zones/wms',
    layer: 'Flood_Zones_2_3_Rivers_and_Sea',
  },
  {
    id: 'rofsw',
    label: 'Surface water',
    description: 'EA Risk of Flooding from Surface Water',
    wmsUrl: 'https://environment.data.gov.uk/spatialdata/nafra2-risk-of-flooding-from-surface-water/wms',
    layer: 'rofsw',
  },
];

/** MapLibre raster tile template for a WMS 1.3.0 layer in Web Mercator. */
export function wmsTileUrl(o: FloodOverlay): string {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    LAYERS: o.layer,
    STYLES: '',
    CRS: 'EPSG:3857',
    WIDTH: '256',
    HEIGHT: '256',
    FORMAT: 'image/png',
    TRANSPARENT: 'true',
  });
  // {bbox-epsg-3857} must stay unencoded for MapLibre to substitute it.
  return `${o.wmsUrl}?${params.toString()}&BBOX={bbox-epsg-3857}`;
}

export const FLOOD_ATTRIBUTION = 'Flood data © Environment Agency (OGL)';
