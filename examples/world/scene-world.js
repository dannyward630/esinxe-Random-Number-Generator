import { cornerHeight, surfaceHeight } from "./spatial.js";

const CHUNK_SIZE = 16;
const GROUND_BOTTOM = -1.4;

const TERRAIN = {
  water: "#376b76",
  shallows: "#548b83",
  sand: "#c6b57b",
  meadow: "#779861",
  forest: "#527651",
  marsh: "#55766a",
  hill: "#92916b",
  mountain: "#777f7c",
  path: "#c8ad72",
};

const FOLIAGE = ["#3d704d", "#4c8052", "#5b8b58", "#6a925c"];
const PINE = ["#285746", "#32664a", "#3b704d", "#46784f"];
const ROCK = ["#858d82", "#92978a", "#a19f8b", "#777f7d"];
const BLOOM = ["#f2d177", "#efb6a1", "#e9e1be", "#d7b7d8"];
const TREE_INSTANCE_PARTS = new Set(["trunk", "pine", "canopy"]);

function hash01(x, y, salt = 0) {
  let h = 2166136261;
  const value = `${x},${y},${salt}`;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h += h << 13;
  h ^= h >>> 7;
  h += h << 3;
  h ^= h >>> 17;
  h += h << 5;
  return (h >>> 0) / 4294967296;
}

function colorOf(THREE, value) {
  return value instanceof THREE.Color ? value.clone() : new THREE.Color(value);
}

function addTriangle(positions, colors, a, b, c, ca, cb, cc) {
  positions.push(...a, ...b, ...c);
  colors.push(...ca, ...cb, ...cc);
}

function scaledRgb(THREE, color, amount = 1) {
  const rgb = colorOf(THREE, color);
  rgb.multiplyScalar(amount);
  return [rgb.r, rgb.g, rgb.b];
}

function tileColor(THREE, tile) {
  const palette = tile.trail
    ? TERRAIN.path
    : tile.startingClearing || tile.siteClearing || tile.clearing
      ? "#82a36a"
      : TERRAIN[tile.terrain] || TERRAIN.meadow;
  const shade = 0.95 + hash01(tile.x, tile.y, 271) * 0.1;
  return scaledRgb(THREE, palette, shade);
}

function localCorners(tile, sampleTile, baseX, baseZ) {
  const left = tile.x - 0.5;
  const right = tile.x + 0.5;
  const north = tile.y - 0.5;
  const south = tile.y + 0.5;
  return [
    {
      x: tile.x - baseX - 0.5,
      z: tile.y - baseZ - 0.5,
      y: cornerHeight(sampleTile, left, north),
    },
    {
      x: tile.x - baseX + 0.5,
      z: tile.y - baseZ - 0.5,
      y: cornerHeight(sampleTile, right, north),
    },
    {
      x: tile.x - baseX + 0.5,
      z: tile.y - baseZ + 0.5,
      y: cornerHeight(sampleTile, right, south),
    },
    {
      x: tile.x - baseX - 0.5,
      z: tile.y - baseZ + 0.5,
      y: cornerHeight(sampleTile, left, south),
    },
  ];
}

function buildGround(THREE, chunk, sampleTile, baseX, baseZ) {
  const positions = [];
  const colors = [];
  const wallColor = (color) => color.map((channel) => channel * 0.58);

  for (const tile of chunk.tiles) {
    const centerX = tile.x - baseX;
    const centerZ = tile.y - baseZ;
    const centerY = surfaceHeight(tile);
    const center = [centerX, centerY, centerZ];
    const corners = localCorners(tile, sampleTile, baseX, baseZ);
    const faceColor = tileColor(THREE, tile);
    const centerColor = faceColor.map((channel) =>
      Math.min(1, channel * 1.045),
    );
    const cornerColor = faceColor.map((channel) => channel * 0.96);

    // A four-sided fan preserves an exact sample at each tile center while
    // sharing averaged corner heights into a gently faceted, continuous top.
    for (let i = 0; i < 4; i++) {
      const northToEast = corners[(i + 1) % 4];
      const westToNorth = corners[i];
      addTriangle(
        positions,
        colors,
        center,
        [northToEast.x, northToEast.y, northToEast.z],
        [westToNorth.x, westToNorth.y, westToNorth.z],
        centerColor,
        cornerColor,
        cornerColor,
      );
    }

    const sides = [];
    if (!sampleTile(tile.x - 1, tile.y))
      sides.push([corners[0], corners[3], -1, 0]);
    if (!sampleTile(tile.x + 1, tile.y))
      sides.push([corners[1], corners[2], 1, 0]);
    if (!sampleTile(tile.x, tile.y - 1))
      sides.push([corners[0], corners[1], 0, -1]);
    if (!sampleTile(tile.x, tile.y + 1))
      sides.push([corners[3], corners[2], 0, 1]);

    for (const [a, b, nx, nz] of sides) {
      const bottomA = [a.x, GROUND_BOTTOM, a.z];
      const bottomB = [b.x, GROUND_BOTTOM, b.z];
      const topA = [a.x, a.y, a.z];
      const topB = [b.x, b.y, b.z];
      const normal = new THREE.Vector3(nx, 0, nz);
      for (const triangle of [
        [topA, bottomA, bottomB],
        [topA, bottomB, topB],
      ]) {
        const u = new THREE.Vector3(...triangle[1]).sub(
          new THREE.Vector3(...triangle[0]),
        );
        const v = new THREE.Vector3(...triangle[2]).sub(
          new THREE.Vector3(...triangle[0]),
        );
        if (u.cross(v).dot(normal) < 0)
          [triangle[1], triangle[2]] = [triangle[2], triangle[1]];
        addTriangle(
          positions,
          colors,
          triangle[0],
          triangle[1],
          triangle[2],
          wallColor(faceColor),
          wallColor(faceColor),
          wallColor(faceColor),
        );
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function transformedGeometry(
  THREE,
  geometry,
  x = 0,
  y = 0,
  z = 0,
  sx = 1,
  sy = 1,
  sz = 1,
) {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion(),
    new THREE.Vector3(sx, sy, sz),
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

function combineGeometry(THREE, pieces) {
  const positions = [];
  const indices = [];
  let offset = 0;
  for (const piece of pieces) {
    const geometry = piece.geometry;
    transformedGeometry(
      THREE,
      geometry,
      ...(piece.position || [0, 0, 0]),
      ...(piece.scale || [1, 1, 1]),
    );
    const source = geometry.getAttribute("position").array;
    positions.push(...source);
    const sourceIndices = geometry.index?.array;
    if (sourceIndices)
      for (const index of sourceIndices) indices.push(index + offset);
    else for (let i = 0; i < source.length / 3; i++) indices.push(offset + i);
    offset += source.length / 3;
    geometry.dispose();
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  result.setIndex(indices);
  result.computeVertexNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}

function makeGeometry(THREE, kind) {
  if (kind === "trunk")
    return transformedGeometry(
      THREE,
      new THREE.CylinderGeometry(0.09, 0.16, 1.45, 6, 1),
      0,
      0.725,
      0,
    );
  if (kind === "pine") {
    const sizes = [
      [0.53, 1.05, 1.08],
      [0.43, 0.9, 1.54],
      [0.33, 0.72, 1.94],
    ];
    return combineGeometry(
      THREE,
      sizes.map(([radius, height, y]) => ({
        geometry: new THREE.ConeGeometry(radius, height, 7, 1),
        position: [0, y, 0],
      })),
    );
  }
  if (kind === "canopy") {
    return combineGeometry(THREE, [
      {
        geometry: new THREE.DodecahedronGeometry(0.53, 0),
        position: [0, 1.45, 0],
      },
      {
        geometry: new THREE.DodecahedronGeometry(0.43, 0),
        position: [-0.35, 1.28, 0.05],
        scale: [1.05, 0.9, 0.95],
      },
      {
        geometry: new THREE.DodecahedronGeometry(0.45, 0),
        position: [0.33, 1.34, -0.08],
        scale: [0.95, 0.95, 1.05],
      },
      {
        geometry: new THREE.DodecahedronGeometry(0.39, 0),
        position: [0, 1.75, 0.1],
      },
    ]);
  }
  if (kind === "rock") {
    return combineGeometry(THREE, [
      {
        geometry: new THREE.DodecahedronGeometry(0.42, 0),
        position: [0, 0.29, 0],
        scale: [1.05, 0.75, 0.85],
      },
      {
        geometry: new THREE.DodecahedronGeometry(0.27, 0),
        position: [0.25, 0.2, -0.05],
        scale: [0.9, 0.75, 1.05],
      },
    ]);
  }
  if (kind === "shrub") {
    return combineGeometry(THREE, [
      {
        geometry: new THREE.DodecahedronGeometry(0.28, 0),
        position: [0, 0.24, 0],
        scale: [1.2, 0.86, 1],
      },
      {
        geometry: new THREE.DodecahedronGeometry(0.24, 0),
        position: [-0.22, 0.2, -0.08],
      },
      {
        geometry: new THREE.DodecahedronGeometry(0.23, 0),
        position: [0.2, 0.19, 0.06],
        scale: [1, 0.9, 0.95],
      },
    ]);
  }
  if (kind === "berry") return new THREE.IcosahedronGeometry(0.065, 0);
  if (kind === "grass") {
    const points = [];
    const angles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
    for (const angle of angles) {
      const dx = Math.cos(angle),
        dz = Math.sin(angle);
      const wx = -dz * 0.035,
        wz = dx * 0.035;
      const bx = dx * 0.055,
        bz = dz * 0.055;
      const tipX = dx * 0.11 + dz * 0.06;
      const tipZ = dz * 0.11 - dx * 0.06;
      points.push(
        -wx,
        0,
        -wz,
        wx,
        0,
        wz,
        tipX,
        0.33,
        tipZ,
        -wx,
        0,
        -wz,
        tipX,
        0.33,
        tipZ,
        -wx * 0.32 + tipX * 0.66,
        0.19,
        -wz * 0.32 + tipZ * 0.66,
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3),
    );
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
  if (kind === "flowerStem")
    return transformedGeometry(
      THREE,
      new THREE.CylinderGeometry(0.014, 0.022, 0.24, 5),
      0,
      0.12,
      0,
    );
  if (kind === "flowerHead")
    return transformedGeometry(
      THREE,
      new THREE.DodecahedronGeometry(0.09, 0),
      0,
      0.25,
      0,
    );
  if (kind === "reed")
    return transformedGeometry(
      THREE,
      new THREE.CylinderGeometry(0.014, 0.026, 0.66, 5),
      0,
      0.33,
      0,
    );
  if (kind === "reedHead")
    return transformedGeometry(
      THREE,
      new THREE.CylinderGeometry(0.035, 0.04, 0.15, 5),
      0,
      0.72,
      0,
    );
  if (kind === "puddle") {
    const geometry = new THREE.CircleGeometry(0.29, 8);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }
  if (kind === "lily") {
    const geometry = new THREE.CircleGeometry(0.2, 7, 0.22, Math.PI * 1.8);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }
  if (kind === "foam") return new THREE.BoxGeometry(0.82, 0.026, 0.1);
  if (kind === "chestBody")
    return transformedGeometry(
      THREE,
      new THREE.BoxGeometry(0.54, 0.35, 0.42),
      0,
      0.19,
      0,
    );
  if (kind === "chestLid")
    return transformedGeometry(
      THREE,
      new THREE.BoxGeometry(0.58, 0.17, 0.46),
      0,
      0.45,
      0,
    );
  if (kind === "chestBand")
    return transformedGeometry(
      THREE,
      new THREE.BoxGeometry(0.6, 0.045, 0.48),
      0,
      0.3,
      0,
    );
  if (kind === "chestLatch")
    return transformedGeometry(
      THREE,
      new THREE.BoxGeometry(0.09, 0.14, 0.035),
      0,
      0.34,
      0.25,
    );
  if (kind === "chestGlow")
    return transformedGeometry(
      THREE,
      new THREE.DodecahedronGeometry(0.075, 0),
      0,
      0.35,
      0.275,
    );
  return new THREE.BoxGeometry(1, 1, 1);
}

function mat(THREE, color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    flatShading: true,
    ...options,
  });
}

function addTreeDitherShader(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float instanceFade;\nvarying float vInstanceFade;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvInstanceFade = instanceFade;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vInstanceFade;\nfloat sceneWorldFadeHash(vec2 pixel) { return fract(sin(dot(floor(pixel), vec2(12.9898, 78.233))) * 43758.5453); }",
      )
      .replace(
        "#include <clipping_planes_fragment>",
        "#include <clipping_planes_fragment>\nif (vInstanceFade < 0.999 && sceneWorldFadeHash(gl_FragCoord.xy) > vInstanceFade) discard;",
      );
  };
  material.customProgramCacheKey = () => "scene-world-tree-instance-dither-v1";
  material.needsUpdate = true;
}

function hashOffset(x, y, salt, amount) {
  return (hash01(x, y, salt) - 0.5) * amount;
}

export function createChunkVisual(THREE, chunk, sampleTile) {
  if (!THREE?.Group || !THREE?.Mesh || !Array.isArray(chunk?.tiles))
    throw new TypeError(
      "createChunkVisual expects Three.js and a generated chunk",
    );

  const cx = Number.isSafeInteger(chunk.cx) ? chunk.cx : 0;
  const cy = Number.isSafeInteger(chunk.cy) ? chunk.cy : 0;
  const baseX = cx * CHUNK_SIZE;
  const baseZ = cy * CHUNK_SIZE;
  const group = new THREE.Group();
  group.name = `terrain-chunk-${cx}-${cy}`;
  group.position.set(baseX, 0, baseZ);

  const geometryMap = new Map();
  const materialMap = new Map();
  const batchMap = new Map();
  const tileByCoord = new Map(
    chunk.tiles.map((tile) => [`${tile.x},${tile.y}`, tile]),
  );
  const sample =
    typeof sampleTile === "function"
      ? sampleTile
      : (x, y) => tileByCoord.get(`${x},${y}`);
  const entityByCoord = new Map(
    (chunk.entities || []).map((entity) => [`${entity.x},${entity.y}`, entity]),
  );
  const grassByCoord = new Map(
    (chunk.grass || []).map((blade) => [`${blade.x},${blade.y}`, blade]),
  );
  const harvestRecords = [];
  const fadeRecords = [];
  const occluders = [];
  const meshes = [];

  const geometry = (key) => {
    if (!geometryMap.has(key)) geometryMap.set(key, makeGeometry(THREE, key));
    return geometryMap.get(key);
  };
  const material = (key) => {
    if (materialMap.has(key)) return materialMap.get(key);
    let value;
    if (key === "ground")
      value = mat(THREE, 0xffffff, { vertexColors: true, roughness: 1 });
    else if (TREE_INSTANCE_PARTS.has(key)) {
      value = mat(THREE, 0xffffff);
      addTreeDitherShader(value);
    } else if (key === "bark") value = mat(THREE, "#74543b");
    else if (key === "pine") value = mat(THREE, 0xffffff);
    else if (key === "leaf") value = mat(THREE, 0xffffff);
    else if (key === "rock") value = mat(THREE, 0xffffff, { roughness: 1 });
    else if (key === "berry") value = mat(THREE, 0xffffff, { roughness: 0.52 });
    else if (key === "grass")
      value = mat(THREE, 0xffffff, { side: THREE.DoubleSide, roughness: 1 });
    else if (key === "flowerStem") value = mat(THREE, "#4d7950");
    else if (key === "flowerHead")
      value = mat(THREE, 0xffffff, { roughness: 0.72 });
    else if (key === "reed") value = mat(THREE, 0xffffff, { roughness: 0.78 });
    else if (key === "reedHead") value = mat(THREE, "#776047");
    else if (key === "puddle")
      value = mat(THREE, "#315e59", {
        side: THREE.DoubleSide,
        roughness: 0.58,
      });
    else if (key === "lily")
      value = mat(THREE, 0xffffff, { side: THREE.DoubleSide, roughness: 0.86 });
    else if (key === "foam")
      value = mat(THREE, "#d5eee0", {
        roughness: 0.48,
        transparent: true,
        opacity: 0.78,
      });
    else if (key === "chestWood") value = mat(THREE, "#9b673f");
    else if (key === "chestLid") value = mat(THREE, "#bd8950");
    else if (key === "chestBand")
      value = mat(THREE, "#d2b35f", { metalness: 0.36, roughness: 0.42 });
    else if (key === "chestLatch")
      value = mat(THREE, "#f0cf75", { metalness: 0.5, roughness: 0.3 });
    else if (key === "chestGlow")
      value = mat(THREE, "#f8d477", {
        emissive: "#f6b83d",
        emissiveIntensity: 0.72,
        roughness: 0.22,
      });
    else value = mat(THREE, "#ffffff");
    materialMap.set(key, value);
    return value;
  };

  function addInstance(
    key,
    x,
    y,
    z,
    {
      rotation = 0,
      scale = 1,
      scaleX = scale,
      scaleY = scale,
      scaleZ = scale,
      color = "#ffffff",
      entityId = null,
    } = {},
  ) {
    let batch = batchMap.get(key);
    if (!batch) {
      batch = { geometry: geometry(key), material: material(key), items: [] };
      batchMap.set(key, batch);
    }
    const position = new THREE.Vector3(x, y, z);
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, rotation, 0),
    );
    const scaleVector = new THREE.Vector3(scaleX, scaleY, scaleZ);
    const matrix = new THREE.Matrix4().compose(
      position,
      quaternion,
      scaleVector,
    );
    batch.items.push({ matrix, color: colorOf(THREE, color), entityId });
  }

  const groundGeometry = buildGround(THREE, chunk, sample, baseX, baseZ);
  geometryMap.set("ground", groundGeometry);
  const ground = new THREE.Mesh(groundGeometry, material("ground"));
  ground.name = `terrain-ground-${cx}-${cy}`;
  ground.receiveShadow = true;
  ground.userData.chunkKey = chunk.key || `${cx},${cy}`;
  group.add(ground);
  meshes.push(ground);

  function addTree(x, z, floor, id, evergreen, seedX, seedY, ambient = false) {
    id ||= `visual-tree:${cx}:${cy}:${seedX}:${seedY}:${x}:${z}`;
    occluders.push({ id, x: baseX + x, y: baseZ + z });
    const rotation = hash01(seedX, seedY, ambient ? 821 : 823) * Math.PI * 2;
    const scale = ambient
      ? 0.64 + hash01(seedX, seedY, 827) * 0.35
      : 0.9 + hash01(seedX, seedY, 829) * 0.2;
    addInstance("trunk", x, floor, z, {
      rotation,
      scale,
      scaleY: scale,
      color: ambient ? "#75583c" : "#77553a",
      entityId: id,
    });
    addInstance(evergreen ? "pine" : "canopy", x, floor, z, {
      rotation,
      scale,
      scaleY: scale,
      color: (evergreen ? PINE : FOLIAGE)[
        Math.floor(hash01(seedX, seedY, 833) * 4)
      ],
      entityId: id,
    });
  }

  function addChest(entity, tile, x, z, floor) {
    const submerged = tile.terrain === "water";
    const size = submerged ? 0.86 : 1;
    const entityId = entity.id;
    const spin = hash01(entity.x, entity.y, 853) * Math.PI * 2;
    const details = [
      ["chestBody", "chestWood", 1],
      ["chestLid", "chestLid", 1],
      ["chestBand", "chestBand", 1],
      ["chestLatch", "chestLatch", 1],
      ["chestGlow", "chestGlow", 1],
    ];
    for (const [part, materialKey] of details) {
      let batch = batchMap.get(part);
      if (!batch) {
        batch = {
          geometry: geometry(part),
          material: material(materialKey),
          items: [],
        };
        batchMap.set(part, batch);
      }
      const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(x, floor + (submerged ? 0.035 : 0.025), z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, spin, 0)),
        new THREE.Vector3(size, size, size),
      );
      batch.items.push({ matrix, color: colorOf(THREE, "#ffffff"), entityId });
    }
  }

  for (const tile of chunk.tiles) {
    const x = tile.x - baseX;
    const z = tile.y - baseZ;
    const floor = surfaceHeight(tile);
    const key = `${tile.x},${tile.y}`;
    const entity = entityByCoord.get(key);
    const clearing =
      tile.trail || tile.startingClearing || tile.siteClearing || tile.clearing;
    const blockedByEntity =
      entity &&
      ["tree", "rock", "berry", "cache", "chest"].includes(entity.type);

    if (
      tile.terrain === "forest" &&
      !clearing &&
      !blockedByEntity &&
      hash01(tile.x, tile.y, 401) < 0.115
    ) {
      const ox = hashOffset(tile.x, tile.y, 403, 0.44);
      const oz = hashOffset(tile.x, tile.y, 407, 0.44);
      addTree(
        x + ox,
        z + oz,
        floor,
        null,
        hash01(tile.x, tile.y, 409) < 0.74,
        tile.x,
        tile.y,
        true,
      );
    }

    if ((tile.terrain === "hill" || tile.terrain === "mountain") && !clearing) {
      const chance = tile.terrain === "mountain" ? 0.26 : 0.1;
      if (hash01(tile.x, tile.y, 419) < chance) {
        addInstance(
          "rock",
          x + hashOffset(tile.x, tile.y, 421, 0.38),
          floor,
          z + hashOffset(tile.x, tile.y, 423, 0.38),
          {
            scale: 0.48 + hash01(tile.x, tile.y, 425) * 0.36,
            scaleY: 0.58 + hash01(tile.x, tile.y, 427) * 0.4,
            color: ROCK[Math.floor(hash01(tile.x, tile.y, 431) * ROCK.length)],
          },
        );
      }
    }

    if (!clearing && (tile.terrain === "meadow" || tile.terrain === "forest")) {
      const grass = grassByCoord.get(key);
      const suppliedGrass = chunk.grass ? Boolean(grass) : undefined;
      const hasGrass =
        suppliedGrass ??
        hash01(tile.x, tile.y, 439) < (tile.terrain === "forest" ? 0.16 : 0.27);
      if (hasGrass) {
        const turn =
          grass?.variant ?? Math.floor(hash01(tile.x, tile.y, 443) * 4);
        addInstance(
          "grass",
          x + hashOffset(tile.x, tile.y, 445, 0.56),
          floor + 0.025,
          z + hashOffset(tile.x, tile.y, 449, 0.56),
          {
            rotation: (turn * Math.PI) / 2,
            scale: 0.62 + hash01(tile.x, tile.y, 451) * 0.55,
            scaleY: 0.72 + hash01(tile.x, tile.y, 457) * 0.65,
            color: ["#789d5b", "#8eaa66", "#638c55", "#a5ad68"][turn % 4],
          },
        );
      }
      const flowerChance = tile.terrain === "meadow" ? 0.16 : 0.035;
      if (hash01(tile.x, tile.y, 461) < flowerChance) {
        const ox = hashOffset(tile.x, tile.y, 463, 0.58);
        const oz = hashOffset(tile.x, tile.y, 467, 0.58);
        const bloom =
          BLOOM[Math.floor(hash01(tile.x, tile.y, 469) * BLOOM.length)];
        addInstance("flowerStem", x + ox, floor + 0.025, z + oz, {
          scale: 0.75 + hash01(tile.x, tile.y, 473) * 0.5,
        });
        addInstance("flowerHead", x + ox, floor + 0.025, z + oz, {
          scale: 0.82 + hash01(tile.x, tile.y, 479) * 0.46,
          color: bloom,
        });
      }
    }

    if (tile.terrain === "marsh" && !clearing) {
      if (hash01(tile.x, tile.y, 487) < 0.25)
        addInstance(
          "puddle",
          x + hashOffset(tile.x, tile.y, 491, 0.26),
          floor + 0.012,
          z + hashOffset(tile.x, tile.y, 493, 0.26),
          { rotation: hash01(tile.x, tile.y, 497) * Math.PI * 2 },
        );
      if (hash01(tile.x, tile.y, 499) < 0.54) {
        for (let i = 0; i < 3; i++) {
          const ox = hashOffset(tile.x, tile.y, 503 + i * 7, 0.5);
          const oz = hashOffset(tile.x, tile.y, 509 + i * 7, 0.5);
          const reedScale = 0.72 + hash01(tile.x, tile.y, 521 + i) * 0.65;
          addInstance("reed", x + ox, floor + 0.02, z + oz, {
            rotation: hash01(tile.x, tile.y, 523 + i) * Math.PI * 2,
            scale: reedScale,
            scaleY: reedScale,
            color: ["#718a59", "#84955c", "#697f57"][i],
          });
          if (i !== 1 || hash01(tile.x, tile.y, 541) > 0.42)
            addInstance("reedHead", x + ox, floor + 0.02, z + oz, {
              rotation: hash01(tile.x, tile.y, 547 + i) * Math.PI * 2,
              scale: reedScale,
            });
        }
      }
    }

    if (tile.terrain === "water" || tile.terrain === "shallows") {
      const lilyChance = tile.terrain === "shallows" ? 0.24 : 0.075;
      if (hash01(tile.x, tile.y, 557) < lilyChance) {
        const lilyY = tile.terrain === "water" ? 0.035 : 0.025;
        addInstance(
          "lily",
          x + hashOffset(tile.x, tile.y, 563, 0.56),
          lilyY,
          z + hashOffset(tile.x, tile.y, 569, 0.56),
          {
            rotation: hash01(tile.x, tile.y, 571) * Math.PI * 2,
            scale: 0.72 + hash01(tile.x, tile.y, 577) * 0.75,
            color: hash01(tile.x, tile.y, 587) > 0.75 ? "#718e58" : "#648b53",
          },
        );
      }
      const neighbours = [
        [tile.x - 1, tile.y, x - 0.39, z, Math.PI / 2],
        [tile.x + 1, tile.y, x + 0.39, z, Math.PI / 2],
        [tile.x, tile.y - 1, x, z - 0.39, 0],
        [tile.x, tile.y + 1, x, z + 0.39, 0],
      ];
      for (let i = 0; i < neighbours.length; i++) {
        const [nx, nz, fx, fz, angle] = neighbours[i];
        const neighbor = tileByCoord.get(`${nx},${nz}`);
        if (neighbor && ["water", "shallows"].includes(neighbor.terrain))
          continue;
        // A chunk-edge neighbor is unknown here; the adjoining streamed chunk
        // owns that shoreline segment once both tiles are available.
        if (!neighbor) continue;
        addInstance("foam", fx, 0.02, fz, {
          rotation: angle,
          scale: 0.84 + hash01(tile.x, tile.y, 601 + i) * 0.24,
        });
      }
    }

    if (!entity || entity.type === "sentinel" || entity.type === "ruin")
      continue;
    if (entity.type === "tree") {
      addTree(
        x,
        z,
        floor,
        entity.id,
        hash01(entity.x, entity.y, 607) < 0.55,
        entity.x,
        entity.y,
      );
    } else if (entity.type === "rock") {
      addInstance("rock", x, floor, z, {
        rotation: hash01(entity.x, entity.y, 613) * Math.PI * 2,
        scale: 0.92 + hash01(entity.x, entity.y, 617) * 0.18,
        scaleY: 0.82 + hash01(entity.x, entity.y, 619) * 0.35,
        color: ROCK[Math.floor(hash01(entity.x, entity.y, 621) * ROCK.length)],
        entityId: entity.id,
      });
    } else if (entity.type === "berry") {
      const id = entity.id;
      const foliageColor =
        FOLIAGE[Math.floor(hash01(entity.x, entity.y, 631) * FOLIAGE.length)];
      addInstance("shrub", x, floor, z, {
        rotation: hash01(entity.x, entity.y, 641) * Math.PI * 2,
        color: foliageColor,
        entityId: id,
      });
      for (let i = 0; i < 7; i++) {
        const angle = hash01(entity.x, entity.y, 643 + i) * Math.PI * 2;
        const radius = 0.08 + hash01(entity.x, entity.y, 653 + i) * 0.22;
        addInstance(
          "berry",
          x + Math.cos(angle) * radius,
          floor + 0.29 + hashOffset(entity.x, entity.y, 661 + i, 0.13),
          z + Math.sin(angle) * radius,
          {
            scale: 0.78 + hash01(entity.x, entity.y, 673 + i) * 0.52,
            color: ["#d76755", "#e58b62", "#bc5965"][i % 3],
            entityId: id,
          },
        );
      }
    } else if (["cache", "chest"].includes(entity.type)) {
      addChest(entity, tile, x, z, floor);
    }
  }

  for (const [key, batch] of batchMap) {
    if (!batch.items.length) continue;
    let instanceGeometry = batch.geometry;
    let fadeAttribute = null;
    if (TREE_INSTANCE_PARTS.has(key)) {
      // A per-batch clone keeps the instanced fade values independent from
      // source geometry and from every other chunk's geometry attributes.
      instanceGeometry = batch.geometry.clone();
      batch.geometry.dispose();
      batch.geometry = instanceGeometry;
      geometryMap.set(key, instanceGeometry);
      fadeAttribute = new THREE.InstancedBufferAttribute(
        new Float32Array(batch.items.length).fill(1),
        1,
      );
      fadeAttribute.setUsage(THREE.DynamicDrawUsage);
      instanceGeometry.setAttribute("instanceFade", fadeAttribute);
    }
    const mesh = new THREE.InstancedMesh(
      instanceGeometry,
      batch.material,
      batch.items.length,
    );
    mesh.name = `chunk-${cx}-${cy}-${key}`;
    mesh.userData.instancePart = key;
    mesh.userData.entityIds = batch.items.map((item) => item.entityId);
    if (fadeAttribute) mesh.userData.instanceFade = fadeAttribute;
    for (let i = 0; i < batch.items.length; i++) {
      const item = batch.items[i];
      mesh.setMatrixAt(i, item.matrix);
      mesh.setColorAt(i, item.color);
      if (item.entityId)
        harvestRecords.push({
          mesh,
          index: i,
          entityId: item.entityId,
          matrix: item.matrix.clone(),
        });
      if (fadeAttribute && item.entityId)
        fadeRecords.push({
          mesh,
          index: i,
          entityId: item.entityId,
          attribute: fadeAttribute,
        });
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    group.add(mesh);
    meshes.push(mesh);
  }

  const chestGlow = materialMap.get("chestGlow");
  let disposed = false;

  function updateHarvested(harvestedSet) {
    const removed =
      harvestedSet && typeof harvestedSet.has === "function"
        ? harvestedSet
        : new Set();
    const zero = new THREE.Vector3(0, 0, 0);
    const hiddenMatrix = new THREE.Matrix4();
    const identityQuaternion = new THREE.Quaternion();
    const origin = new THREE.Vector3();
    for (const record of harvestRecords) {
      if (removed.has(record.entityId)) {
        hiddenMatrix.compose(origin, identityQuaternion, zero);
        record.mesh.setMatrixAt(record.index, hiddenMatrix);
      } else record.mesh.setMatrixAt(record.index, record.matrix);
    }
    for (const mesh of meshes) {
      if (!(mesh instanceof THREE.InstancedMesh)) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
    }
  }

  function animate(timeSeconds, reducedMotion = false) {
    if (disposed || !chestGlow) return;
    chestGlow.emissiveIntensity = reducedMotion
      ? 0.72
      : 0.56 +
        (0.5 +
          Math.sin((Number.isFinite(timeSeconds) ? timeSeconds : 0) * 2.3) *
            0.5) *
          0.42;
  }

  function setOccluded(ids, dt, reducedMotion = false) {
    if (disposed) return;
    const occluded = ids && typeof ids.has === "function" ? ids : new Set();
    const seconds = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
    const easing = reducedMotion ? 1 : 1 - Math.exp(-seconds * 12);
    const dirty = new Set();
    for (const record of fadeRecords) {
      const values = record.attribute.array;
      const current = values[record.index];
      const target = occluded.has(record.entityId) ? 0.18 : 1;
      const next = reducedMotion
        ? target
        : current + (target - current) * easing;
      const value = Math.abs(target - next) < 0.001 ? target : next;
      if (Math.abs(value - current) <= 0.0001) continue;
      values[record.index] = value;
      dirty.add(record.attribute);
    }
    for (const attribute of dirty) attribute.needsUpdate = true;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    group.parent?.remove(group);
    for (const mesh of meshes)
      if (mesh instanceof THREE.InstancedMesh) mesh.dispose();
    group.clear();
    for (const value of geometryMap.values()) value.dispose();
    for (const value of materialMap.values()) value.dispose();
    geometryMap.clear();
    materialMap.clear();
    batchMap.clear();
    meshes.length = 0;
    harvestRecords.length = 0;
    fadeRecords.length = 0;
    occluders.length = 0;
  }

  updateHarvested(new Set());
  return {
    group,
    ground,
    occluders,
    updateHarvested,
    setOccluded,
    animate,
    dispose,
  };
}
