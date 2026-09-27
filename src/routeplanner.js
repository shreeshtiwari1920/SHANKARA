// =============================================================================
// INTEGRATION POINT for the teammate's route-planning ML model.
// =============================================================================
// Today this file contains a real, working fallback (a lawnmower / boustrophedon
// coverage-path generator, clipped to the actual drawn polygon - not just its
// bounding box) so the mission-setup flow is functional end-to-end without
// waiting on the model. When the model is ready, replace the body of
// `generateCoveragePaths` with a call out to it (HTTP call to a model server,
// a child_process call to a Python script, whatever it ends up being) as long
// as it returns the same shape described below - nothing else in the app needs
// to change.
//
// Expected output shape (per drone):
//   { droneId: "drone-1", waypoints: [ {lat, lon, alt}, ... ] }
// =============================================================================

const EARTH_RADIUS_M = 6378137;
const METERS_PER_DEG_LAT = (Math.PI / 180) * EARTH_RADIUS_M;
const MAX_ROWS_PER_DRONE = 400; // safety cap, avoids runaway loops on odd inputs

function boundingBox(polygon) {
  const lats = polygon.map((p) => p.lat);
  const lons = polygon.map((p) => p.lon);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
  };
}

// Ray-casting point-in-polygon test (used by callers that just need a yes/no).
function pointInPolygon(lat, lon, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lon, yi = polygon[i].lat;
    const xj = polygon[j].lon, yj = polygon[j].lat;
    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// The actual fix: for a horizontal line at a given latitude, find where it
// crosses the polygon's edges and return the inside segments as [lonA, lonB]
// pairs, sorted left-to-right. This is what keeps every waypoint on the row
// genuinely inside the drawn shape instead of spanning the full bounding box.
function polygonRowIntersections(polygon, lat) {
  const xs = [];
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    const aLat = a.lat, bLat = b.lat;
    // Does this edge straddle the row's latitude?
    if ((aLat <= lat && bLat > lat) || (bLat <= lat && aLat > lat)) {
      const t = (lat - aLat) / (bLat - aLat);
      xs.push(a.lon + t * (b.lon - a.lon));
    }
  }
  xs.sort((x, y) => x - y);
  const segments = [];
  for (let i = 0; i + 1 < xs.length; i += 2) {
    segments.push([xs[i], xs[i + 1]]);
  }
  return segments; // simple polygon => even number of crossings per row
}

/**
 * Split a search polygon into N horizontal bands (one per drone) and generate
 * a lawnmower sweep path inside each band, clipped row-by-row to wherever the
 * polygon actually is at that latitude (handles concave / irregular shapes,
 * not just rectangles).
 *
 * @param {Array<{lat:number, lon:number}>} polygon
 * @param {number} numDrones
 * @param {number} altitude meters
 * @param {number} overlapPct 0-100, controls sweep-line spacing
 * @returns {Array<{droneId:string, waypoints:Array}>}
 */
function generateCoveragePaths(polygon, numDrones, altitude, overlapPct) {
  if (!polygon || polygon.length < 3) {
    throw new Error("polygon must have at least 3 points");
  }
  numDrones = Math.max(1, Math.min(8, numDrones || 1));
  altitude = altitude || 60;
  const overlap = Math.min(90, Math.max(0, overlapPct || 20));

  const bbox = boundingBox(polygon);
  // Camera-footprint assumption used only to space sweep rows sensibly.
  const swathMeters = 30 * (1 - overlap / 100) + 5; // narrower spacing at high overlap
  const rowSpacingDeg = swathMeters / METERS_PER_DEG_LAT;
  const latSpanDeg = bbox.maxLat - bbox.minLat;

  const results = [];

  for (let d = 0; d < numDrones; d++) {
    const bandLatMin = bbox.minLat + (latSpanDeg * d) / numDrones;
    const bandLatMax = bbox.minLat + (latSpanDeg * (d + 1)) / numDrones;

    const waypoints = [];
    let goingRight = true;
    let rows = 0;

    for (
      let lat = bandLatMin;
      lat <= bandLatMax + rowSpacingDeg / 2 && rows < MAX_ROWS_PER_DRONE;
      lat += rowSpacingDeg, rows++
    ) {
      const segments = polygonRowIntersections(polygon, lat);
      if (!segments.length) continue; // this row misses the polygon entirely (e.g. near a pointed apex)

      const ordered = goingRight ? segments : segments.slice().reverse();
      for (const [lonA, lonB] of ordered) {
        const [enter, exit] = goingRight ? [lonA, lonB] : [lonB, lonA];
        waypoints.push({ lat, lon: enter, alt: altitude });
        waypoints.push({ lat, lon: exit, alt: altitude });
      }
      goingRight = !goingRight;
    }

    results.push({ droneId: `drone-${d + 1}`, waypoints });
  }

  return results;
}

module.exports = { generateCoveragePaths, pointInPolygon, boundingBox, polygonRowIntersections };