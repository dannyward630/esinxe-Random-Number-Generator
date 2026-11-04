export const WATER_LEVEL = 0;

export function cameraHeading(yaw) {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][
    ((-Math.round(yaw / (Math.PI / 4)) % 8) + 8) % 8
  ];
}

// The simulation's persistent x/y plane is rendered as Three.js x/z, with y up.
// Heights depend on the decorated tile so biome overlays and old trails agree.
export function surfaceHeight(tile) {
  if (!tile) return 0.14;
  if (tile.startingClearing || tile.siteClearing || tile.trail) return 0.14;
  const elevation = Number.isFinite(tile.elevation) ? tile.elevation : 0.5;
  const texture = Number.isFinite(tile.texture) ? tile.texture : 0.5;
  const detail = (texture - 0.5) * 0.05;
  switch (tile.terrain) {
    case "water":
      return -0.85;
    case "shallows":
      return -0.16 + detail;
    case "sand":
      return 0.08 + detail;
    case "marsh":
      return 0.06 + detail;
    case "forest":
      return 0.22 + (elevation - 0.5) * 0.5 + detail;
    case "hill":
      return 0.85 + elevation * 0.9 + detail;
    case "mountain":
      return 1.8 + elevation * 1.8 + detail;
    default:
      return 0.15 + (elevation - 0.5) * 0.5 + detail;
  }
}

export function movementForCamera(x, y, yaw) {
  const length = Math.max(1, Math.hypot(x, y));
  const a = x / length,
    b = y / length;
  return {
    x: a * Math.cos(yaw) + b * Math.sin(yaw),
    y: -a * Math.sin(yaw) + b * Math.cos(yaw),
  };
}

export function tileFromStream(stream, x, y) {
  const ix = Math.floor(x + 0.5),
    iy = Math.floor(y + 0.5);
  const cx = Math.floor(ix / 16),
    cy = Math.floor(iy / 16);
  return stream.cache.get(`${cx},${cy}`)?.tiles[
    (iy - cy * 16) * 16 + ix - cx * 16
  ];
}

export function heightFromStream(stream, x, y) {
  return groundHeight((tx, ty) => tileFromStream(stream, tx, ty), x, y);
}

// Shared grid vertices use the same four global samples on either side of a
// chunk boundary. Rendering and foot placement share the exact four-face fan.
export function cornerHeight(sampleTile, x, z) {
  let total = 0,
    count = 0;
  for (const tx of [Math.floor(x), Math.floor(x) + 1])
    for (const tz of [Math.floor(z), Math.floor(z) + 1]) {
      const tile = sampleTile(tx, tz);
      if (tile) {
        total += surfaceHeight(tile);
        count++;
      }
    }
  return count ? total / count : surfaceHeight();
}

export function groundHeight(sampleTile, x, z) {
  const cx = Math.floor(x + 0.5),
    cz = Math.floor(z + 0.5);
  const tile = sampleTile(cx, cz);
  if (!tile) return surfaceHeight();
  const h = surfaceHeight(tile),
    dx = x - cx,
    dz = z - cz;
  if (Math.abs(dx) >= Math.abs(dz)) {
    if (dx >= 0)
      return (
        h * (1 - 2 * dx) +
        cornerHeight(sampleTile, cx + 0.5, cz - 0.5) * (dx - dz) +
        cornerHeight(sampleTile, cx + 0.5, cz + 0.5) * (dx + dz)
      );
    return (
      h * (1 + 2 * dx) +
      cornerHeight(sampleTile, cx - 0.5, cz + 0.5) * (-dx + dz) +
      cornerHeight(sampleTile, cx - 0.5, cz - 0.5) * (-dx - dz)
    );
  }
  if (dz >= 0)
    return (
      h * (1 - 2 * dz) +
      cornerHeight(sampleTile, cx + 0.5, cz + 0.5) * (dz + dx) +
      cornerHeight(sampleTile, cx - 0.5, cz + 0.5) * (dz - dx)
    );
  return (
    h * (1 + 2 * dz) +
    cornerHeight(sampleTile, cx - 0.5, cz - 0.5) * (-dz - dx) +
    cornerHeight(sampleTile, cx + 0.5, cz - 0.5) * (-dz + dx)
  );
}
