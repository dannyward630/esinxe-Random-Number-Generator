const COLORS = Object.freeze({
  ink: "#203941",
  deepTeal: "#24605f",
  teal: "#3f8b83",
  seafoam: "#8cd7bd",
  paleMint: "#c4f1cf",
  cream: "#f3dfb5",
  skin: "#e9b88b",
  rose: "#bd7867",
  ochre: "#bd8851",
  gold: "#f3bd62",
  charcoal: "#34454b",
  slate: "#65777a",
  paleStone: "#b6b6a0",
  darkStone: "#4b5c5c",
  glass: "#83dfc8",
  glassLight: "#c3f6d8",
  ember: "#f28c48",
  emberLight: "#ffe08b",
});

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function makeKit(THREE) {
  const group = new THREE.Group();
  const geometries = new Map();
  const materials = new Map();

  function geometry(key) {
    if (!geometries.has(key)) {
      const constructors = {
        box: () => new THREE.BoxGeometry(1, 1, 1),
        cone: () => new THREE.ConeGeometry(1, 1, 6, 1),
        cylinder: () => new THREE.CylinderGeometry(1, 1, 1, 8, 1),
        taper: () => new THREE.CylinderGeometry(0.68, 1, 1, 7, 1),
        icosahedron: () => new THREE.IcosahedronGeometry(1, 0),
        dodecahedron: () => new THREE.DodecahedronGeometry(1, 0),
        sphere: () => new THREE.SphereGeometry(1, 8, 5),
        torus: () => new THREE.TorusGeometry(1, 0.075, 5, 14),
        smallTorus: () => new THREE.TorusGeometry(1, 0.045, 4, 12),
      };
      if (!constructors[key]) throw new TypeError(`unknown actor geometry: ${key}`);
      geometries.set(key, constructors[key]());
    }
    return geometries.get(key);
  }

  function material(key, color, options = {}) {
    if (!materials.has(key)) {
      materials.set(key, new THREE.MeshStandardMaterial({
        color,
        roughness: 0.78,
        flatShading: true,
        ...options,
      }));
    }
    return materials.get(key);
  }

  function mesh(parent, name, shape, mat, position, scale, rotation = [0, 0, 0]) {
    const object = new THREE.Mesh(geometry(shape), mat);
    object.name = name;
    object.position.set(position[0], position[1], position[2]);
    object.scale.set(scale[0], scale[1], scale[2]);
    object.rotation.set(rotation[0], rotation[1], rotation[2]);
    object.castShadow = !mat.transparent;
    object.receiveShadow = !mat.transparent;
    parent.add(object);
    return object;
  }

  function child(parent, name, position = [0, 0, 0]) {
    const object = new THREE.Group();
    object.name = name;
    object.position.set(position[0], position[1], position[2]);
    parent.add(object);
    return object;
  }

  function mat(name, color, options) {
    return material(name, color, options);
  }

  return { group, geometry, material, mesh, child, mat };
}

function addBoot(kit, parent, side, x) {
  const pivot = kit.child(parent, `${side}-leg`, [x, 0.38, 0]);
  kit.mesh(pivot, `${side}-trouser`, "taper", kit.mat("trousers", COLORS.deepTeal),
    [0, -0.13, 0.015], [0.115, 0.27, 0.13]);
  kit.mesh(pivot, `${side}-boot`, "box", kit.mat("boots", COLORS.ochre),
    [0, -0.29, -0.045], [0.205, 0.17, 0.31]);
  kit.mesh(pivot, `${side}-boot-cap`, "box", kit.mat("boot-cap", "#e4b36c"),
    [0, -0.255, -0.15], [0.19, 0.07, 0.12]);
  return pivot;
}

function addAxe(kit, parent) {
  const axe = kit.child(parent, "harvest-axe", [0.015, -0.34, -0.015]);
  kit.mesh(axe, "axe-handle", "cylinder", kit.mat("axe-handle", "#815739"),
    [0, 0, 0], [0.037, 0.28, 0.037]);
  kit.mesh(axe, "axe-head", "icosahedron", kit.mat("axe-head", "#b8c9c1", {
    metalness: 0.35,
    roughness: 0.48,
  }), [0.09, 0.14, 0], [0.15, 0.12, 0.055], [0, 0, -0.15]);
  kit.mesh(axe, "axe-cap", "box", kit.mat("axe-cap", COLORS.gold),
    [0, -0.15, 0], [0.075, 0.055, 0.075]);
  axe.visible = false;
  return axe;
}

function addLantern(kit, parent) {
  const lantern = kit.child(parent, "hand-lantern", [-0.01, -0.34, -0.035]);
  kit.mesh(lantern, "lantern-cage", "box", kit.mat("lantern-frame", COLORS.ink),
    [0, -0.01, 0], [0.16, 0.2, 0.14]);
  kit.mesh(lantern, "lantern-glass", "icosahedron", kit.mat("lantern-glow", COLORS.emberLight, {
    emissive: "#e69a3b",
    emissiveIntensity: 0.85,
  }), [0, 0, -0.018], [0.088, 0.115, 0.085]);
  kit.mesh(lantern, "lantern-handle", "torus", kit.mat("lantern-handle", COLORS.ink),
    [0, 0.115, 0], [0.075, 0.07, 0.075], [Math.PI / 2, 0, 0]);
  lantern.visible = false;
  return lantern;
}

export function createPlayer(THREE) {
  const kit = makeKit(THREE);
  const model = kit.group;
  model.name = "player-explorer";

  const animated = kit.child(model, "animated-explorer");
  const body = kit.child(animated, "body-pivot", [0, 0.62, 0]);
  kit.mesh(body, "trail-coat", "taper", kit.mat("coat", COLORS.teal),
    [0, -0.045, 0], [0.29, 0.43, 0.225]);
  kit.mesh(body, "coat-front", "box", kit.mat("coat-front", "#66a391"),
    [0, -0.06, -0.213], [0.26, 0.34, 0.035]);
  kit.mesh(body, "belt", "box", kit.mat("belt", COLORS.ochre),
    [0, -0.235, -0.004], [0.31, 0.065, 0.245]);
  kit.mesh(body, "belt-clasp", "icosahedron", kit.mat("clasp", COLORS.gold),
    [0, -0.235, -0.142], [0.055, 0.055, 0.03]);

  const pack = kit.child(body, "backpack", [0, 0.12, 0.205]);
  kit.mesh(pack, "pack-body", "box", kit.mat("pack", COLORS.ochre),
    [0, 0, 0.025], [0.34, 0.34, 0.22]);
  kit.mesh(pack, "pack-flap", "box", kit.mat("pack-flap", "#d3a263"),
    [0, 0.115, -0.02], [0.28, 0.11, 0.225]);
  kit.mesh(pack, "pack-roll", "cylinder", kit.mat("pack-roll", COLORS.cream),
    [0, 0.2, 0.045], [0.19, 0.07, 0.07], [Math.PI / 2, 0, 0]);
  for (const side of [-1, 1]) {
    kit.mesh(body, `pack-strap-${side}`, "box", kit.mat("pack-straps", "#d7b57e"),
      [side * 0.205, 0.06, -0.01], [0.052, 0.27, 0.05], [0, 0, side * -0.16]);
  }

  // The dark hood sits behind the face, leaving the cheeks and eyes readable.
  kit.mesh(body, "hood", "sphere", kit.mat("hood", COLORS.deepTeal),
    [0, 0.39, 0.045], [0.275, 0.3, 0.245]);
  kit.mesh(body, "hood-crown", "icosahedron", kit.mat("hood-crown", COLORS.teal),
    [0, 0.575, 0.055], [0.22, 0.19, 0.22]);
  kit.mesh(body, "face", "sphere", kit.mat("face", COLORS.skin),
    [0, 0.395, -0.108], [0.184, 0.2, 0.125]);
  kit.mesh(body, "face-shadow", "icosahedron", kit.mat("face-shadow", COLORS.rose),
    [0, 0.285, -0.157], [0.085, 0.035, 0.022]);
  for (const side of [-1, 1]) {
    kit.mesh(body, `eye-${side}`, "sphere", kit.mat("eyes", COLORS.ink),
      [side * 0.063, 0.422, -0.222], [0.023, 0.032, 0.018]);
  }
  kit.mesh(body, "nose", "icosahedron", kit.mat("nose", "#d99872"),
    [0, 0.36, -0.229], [0.025, 0.03, 0.024]);

  kit.mesh(body, "scarf-collar", "torus", kit.mat("scarf", COLORS.ember),
    [0, 0.155, -0.005], [0.245, 0.19, 0.205], [Math.PI / 2, 0, 0]);
  const scarf = kit.child(body, "scarf-tail", [0.17, 0.12, 0.13]);
  kit.mesh(scarf, "scarf-ribbon", "icosahedron", kit.mat("scarf-tail", "#f29b59"),
    [0.055, -0.105, 0.015], [0.09, 0.22, 0.075], [0.18, 0, -0.38]);
  kit.mesh(scarf, "scarf-tip", "cone", kit.mat("scarf-tip", COLORS.gold),
    [0.07, -0.25, 0.015], [0.065, 0.12, 0.055], [0, 0, -0.2]);

  const leftArm = kit.child(body, "left-arm-pivot", [-0.285, 0.145, 0]);
  const rightArm = kit.child(body, "right-arm-pivot", [0.285, 0.145, 0]);
  for (const [side, arm] of [["left", leftArm], ["right", rightArm]]) {
    kit.mesh(arm, `${side}-sleeve`, "taper", kit.mat("sleeves", "#4d8980"),
      [0, -0.105, 0], [0.125, 0.245, 0.135]);
    kit.mesh(arm, `${side}-cuff`, "torus", kit.mat("cuffs", COLORS.cream),
      [0, -0.235, -0.008], [0.089, 0.09, 0.09], [Math.PI / 2, 0, 0]);
    kit.mesh(arm, `${side}-hand`, "sphere", kit.mat("hands", COLORS.skin),
      [0, -0.275, -0.01], [0.087, 0.078, 0.078]);
  }
  const axe = addAxe(kit, rightArm);
  const lantern = addLantern(kit, leftArm);
  const leftLeg = addBoot(kit, animated, "left", -0.145);
  const rightLeg = addBoot(kit, animated, "right", 0.145);

  model.userData.animation = {
    animated,
    body,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    scarf,
    axe,
    lantern,
  };
  model.userData.kind = "player";
  return model;
}

export function animatePlayer(model, player = {}, timeSeconds = 0, speed = 0, reducedMotion = false) {
  const pose = model?.userData?.animation;
  if (!pose) return;

  const time = finite(timeSeconds);
  const delta = pose.lastTime === undefined ? 0 : clamp(time - pose.lastTime, 0, 0.05);
  pose.lastTime = time;
  const targetSpeed = clamp(finite(speed), 0, 4);
  const oldSpeed = pose.moveSpeed || 0;
  const decay = Math.exp(-delta * 14);
  const moveSpeed = targetSpeed + (oldSpeed - targetSpeed) * decay;
  pose.moveSpeed = moveSpeed;
  const motionScale = reducedMotion ? 0.38 : 1;
  const walking = moveSpeed / 4;
  // Integrate cadence and the speed blend, rather than multiplying absolute
  // time by changing speed. The exact integral also agrees across refresh rates.
  const travel = targetSpeed * delta + (oldSpeed - targetSpeed) * (1 - decay) / 14;
  pose.phase = ((pose.phase || 0) + delta * 3.1 + travel * 1.35) % (Math.PI * 40);
  const phase = pose.phase;
  const swimming = Boolean(player?.swimming);
  const diving = swimming && Boolean(player?.diving);
  const lift = clamp(finite(player?.lift), 0, 2.5);
  const mode = swimming ? (diving ? "dive" : "swim") : lift > 0.02 ? "air" : "ground";
  const parts = [pose.body, pose.leftArm, pose.rightArm, pose.leftLeg, pose.rightLeg];
  if (pose.mode !== undefined && pose.mode !== mode && !reducedMotion) {
    pose.transition = {
      elapsed: 0,
      rotations: parts.map(part => ({ x: part.rotation.x, y: part.rotation.y, z: part.rotation.z })),
      bodyY: pose.body.position.y,
    };
  }
  pose.mode = mode;
  if (reducedMotion) pose.transition = null;
  const dash = clamp(finite(player?.dashRemaining) / 0.24, 0, 1);
  const attack = clamp(finite(player?.attackWindup) / 0.16, 0, 1);
  const gait = Math.sin(phase) * walking * motionScale;

  pose.axe.visible = Boolean(player?.hasAxe || player?.tools?.axe);
  pose.lantern.visible = Boolean(player?.hasLantern || player?.tools?.lantern);
  const idleBob = lift > 0.02 || reducedMotion
    ? 0
    : Math.sin(time * 3.4) * 0.018 * (1 - walking);
  // The renderer applies physical lift to the model root; child motion stays decorative.
  pose.animated.position.y = idleBob;
  pose.body.position.y = 0.62 - (diving ? 0.11 : swimming ? 0.035 : 0);
  pose.body.rotation.set(0, 0, 0);
  pose.leftArm.rotation.set(0, 0, 0);
  pose.rightArm.rotation.set(0, 0, 0);
  pose.leftLeg.rotation.set(0, 0, 0);
  pose.rightLeg.rotation.set(0, 0, 0);

  pose.leftLeg.rotation.x = gait;
  pose.rightLeg.rotation.x = -gait;
  pose.leftArm.rotation.x = -gait * 0.82;
  pose.rightArm.rotation.x = gait * 0.82;
  pose.body.rotation.x = -0.11 * walking;

  if (swimming) {
    pose.body.rotation.x = diving ? -1.46 : -1.16;
    pose.body.rotation.z = Math.sin(phase * 0.55) * 0.035 * motionScale;
    pose.leftArm.rotation.x = -0.6 + Math.sin(phase) * 0.48 * motionScale;
    pose.rightArm.rotation.x = -0.6 - Math.sin(phase) * 0.48 * motionScale;
    pose.leftLeg.rotation.x = 0.4 + Math.sin(phase * 1.4) * 0.22 * motionScale;
    pose.rightLeg.rotation.x = 0.4 - Math.sin(phase * 1.4) * 0.22 * motionScale;
  } else if (lift > 0.02) {
    const airborne = clamp(lift / 0.6, 0, 1);
    pose.leftLeg.rotation.x = -0.42 * airborne;
    pose.rightLeg.rotation.x = -0.42 * airborne;
    pose.leftArm.rotation.x = 0.55 * airborne;
    pose.rightArm.rotation.x = 0.55 * airborne;
  }

  if (dash > 0 && !swimming) {
    pose.body.rotation.x = -0.11 * walking - 0.42 * dash;
    pose.leftArm.rotation.x -= 0.46 * dash;
    pose.rightArm.rotation.x -= 0.46 * dash;
  }
  if (attack > 0 && !swimming) {
    pose.rightArm.rotation.x = 0.32 + 0.95 * attack;
    pose.rightArm.rotation.z = -0.2 * attack;
    pose.body.rotation.z = -0.055 * attack;
  }

  if (pose.transition) {
    const transition = pose.transition;
    const progress = clamp(transition.elapsed / 0.16, 0, 1);
    const blend = progress * progress * (3 - 2 * progress);
    parts.forEach((part, index) => {
      const from = transition.rotations[index];
      for (const axis of ["x", "y", "z"])
        part.rotation[axis] = from[axis] + (part.rotation[axis] - from[axis]) * blend;
    });
    pose.body.position.y = transition.bodyY + (pose.body.position.y - transition.bodyY) * blend;
    transition.elapsed += delta;
    if (progress >= 1) pose.transition = null;
  }

  pose.scarf.rotation.z = Math.sin(time * (swimming ? 5 : 6.5))
    * (reducedMotion ? 0.045 : 0.16) * (0.35 + walking + dash);
  pose.scarf.rotation.x = swimming ? -0.24 : 0.08 * Math.sin(phase * 0.5) * motionScale;
  pose.lantern.rotation.z = reducedMotion ? 0 : Math.sin(time * 3.2) * 0.08;
}

function addShardLimb(kit, parent, side, x, y, z) {
  const pivot = kit.child(parent, `${side}-shard-arm`, [x, y, z]);
  kit.mesh(pivot, `${side}-shoulder-stone`, "dodecahedron", kit.mat("sentinel-stone", COLORS.darkStone),
    [0, 0, 0], [0.19, 0.2, 0.18]);
  kit.mesh(pivot, `${side}-forearm-shard`, "icosahedron", kit.mat("sentinel-shard", COLORS.slate),
    [side === "left" ? -0.1 : 0.1, -0.23, -0.015], [0.16, 0.27, 0.145],
    [0, 0, side === "left" ? 0.18 : -0.18]);
  kit.mesh(pivot, `${side}-wrist-stone`, "dodecahedron", kit.mat("sentinel-stone", COLORS.darkStone),
    [side === "left" ? -0.15 : 0.15, -0.43, -0.015], [0.14, 0.13, 0.13]);
  return pivot;
}

export function createSentinel(THREE) {
  const kit = makeKit(THREE);
  const model = kit.group;
  model.name = "floating-stone-sentinel";
  const floatRig = kit.child(model, "sentinel-hover-rig", [0, 0.98, 0]);

  kit.mesh(floatRig, "back-stone", "dodecahedron", kit.mat("sentinel-stone", COLORS.darkStone),
    [0, 0, 0.105], [0.49, 0.55, 0.35], [0, 0.17, 0]);
  kit.mesh(floatRig, "face-plate", "icosahedron", kit.mat("sentinel-plate", "#708081"),
    [0, 0.015, -0.16], [0.42, 0.39, 0.24]);
  kit.mesh(floatRig, "left-brow", "dodecahedron", kit.mat("sentinel-brow", "#849392"),
    [-0.17, 0.25, -0.34], [0.22, 0.12, 0.1], [0, 0, 0.25]);
  kit.mesh(floatRig, "right-brow", "dodecahedron", kit.mat("sentinel-brow", "#849392"),
    [0.17, 0.25, -0.34], [0.22, 0.12, 0.1], [0, 0, -0.25]);

  const eyeFrame = kit.mat("sentinel-eye-frame", COLORS.ink, { metalness: 0.25, roughness: 0.45 });
  kit.mesh(floatRig, "eye-socket", "smallTorus", eyeFrame,
    [0, 0.045, -0.415], [0.29, 0.29, 0.29], [0, 0, 0]);
  const eyeMaterial = kit.mat("sentinel-eye", COLORS.seafoam, {
    emissive: "#55d8b3",
    emissiveIntensity: 1.25,
    roughness: 0.32,
  });
  kit.mesh(floatRig, "glowing-eye", "sphere", eyeMaterial,
    [0, 0.045, -0.43], [0.145, 0.145, 0.095]);
  kit.mesh(floatRig, "eye-glint", "icosahedron", kit.mat("sentinel-glint", COLORS.paleMint, {
    emissive: "#b8ffe7",
    emissiveIntensity: 1.1,
  }), [-0.035, 0.09, -0.514], [0.035, 0.04, 0.025]);

  const calmRingMaterial = kit.mat("sentinel-ring", "#81918b", { metalness: 0.25, roughness: 0.48 });
  kit.mesh(floatRig, "orbit-ring-low", "torus", calmRingMaterial,
    [0, -0.01, 0.02], [0.72, 0.72, 0.72], [Math.PI / 2, 0.12, 0]);
  kit.mesh(floatRig, "orbit-ring-high", "smallTorus", kit.mat("sentinel-ring-light", COLORS.seafoam, {
    emissive: "#3d9c88",
    emissiveIntensity: 0.5,
  }), [0, 0.08, 0.02], [0.81, 0.81, 0.81], [Math.PI / 2, -0.08, 0]);
  const warningMaterial = kit.mat("sentinel-warning", COLORS.ember, {
    emissive: "#ef642f",
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.92,
  });
  const warning = kit.mesh(floatRig, "windup-warning-ring", "torus", warningMaterial,
    [0, 0.045, -0.44], [0.42, 0.42, 0.42], [0, 0, 0]);
  warning.visible = false;

  const leftArm = addShardLimb(kit, floatRig, "left", -0.49, -0.08, 0.02);
  const rightArm = addShardLimb(kit, floatRig, "right", 0.49, -0.08, 0.02);
  for (const [index, x, z, tilt] of [
    [0, -0.22, 0.04, -0.4],
    [1, 0.22, 0.06, 0.4],
    [2, 0, 0.24, 0],
  ]) {
    kit.mesh(floatRig, `crown-shard-${index}`, "icosahedron", kit.mat("sentinel-shard", COLORS.slate),
      [x, 0.43, z], [0.12, 0.25, 0.115], [0, 0, tilt]);
  }
  kit.mesh(floatRig, "lower-keystone", "dodecahedron", kit.mat("sentinel-keystone", "#566868"),
    [0, -0.5, 0.03], [0.24, 0.22, 0.23], [0, 0.2, 0]);

  model.userData.animation = {
    floatRig,
    leftArm,
    rightArm,
    warning,
    warningMaterial,
    eyeMaterial,
  };
  model.userData.kind = "sentinel";
  return model;
}

export function animateSentinel(model, enemy = {}, timeSeconds = 0, reducedMotion = false) {
  const pose = model?.userData?.animation;
  if (!pose) return;
  const time = finite(timeSeconds);
  const windup = enemy?.mode === "windup" || finite(enemy?.windup) > 0;
  const hurt = finite(enemy?.hurt) > 0;
  const pulse = reducedMotion ? 0.5 : (Math.sin(time * 17) + 1) / 2;
  const ease = reducedMotion ? 0 : Math.sin(time * 2.2);

  pose.floatRig.position.y = 0.98 + ease * (reducedMotion ? 0.006 : 0.055);
  pose.floatRig.rotation.set(
    hurt ? -0.2 : 0.025 * Math.sin(time * 1.8),
    reducedMotion ? 0 : 0.09 * Math.sin(time * 0.7),
    hurt ? 0.18 : 0.025 * Math.sin(time * 1.4),
  );
  pose.leftArm.rotation.set(0, 0, 0.12 + (windup ? -0.54 : 0) + (hurt ? 0.28 : 0));
  pose.rightArm.rotation.set(0, 0, -0.12 + (windup ? 0.54 : 0) - (hurt ? 0.28 : 0));
  pose.warning.visible = windup;
  const urgency = windup ? 0.88 + pulse * (reducedMotion ? 0.12 : 0.34) : 1;
  pose.warning.scale.setScalar(windup ? urgency : 1);
  pose.warningMaterial.opacity = windup ? 0.7 + pulse * 0.25 : 0.92;
  pose.warningMaterial.emissiveIntensity = windup ? 1.3 + pulse * (reducedMotion ? 0.3 : 1.15) : 1.4;

  if (hurt) {
    pose.eyeMaterial.color.set("#fff2d1");
    pose.eyeMaterial.emissive.set("#ffd89a");
    pose.eyeMaterial.emissiveIntensity = 1.8;
  } else if (windup) {
    pose.eyeMaterial.color.set("#ffb06b");
    pose.eyeMaterial.emissive.set("#ff572e");
    pose.eyeMaterial.emissiveIntensity = 1.4 + pulse * (reducedMotion ? 0.35 : 1.25);
  } else {
    pose.eyeMaterial.color.set(COLORS.seafoam);
    pose.eyeMaterial.emissive.set("#55d8b3");
    pose.eyeMaterial.emissiveIntensity = 1.25;
  }
}

function addPillar(kit, parent, name, x, z, height, color, shape = "cylinder") {
  kit.mesh(parent, `${name}-foot`, "box", kit.mat(`${name}-foot-material`, color),
    [x, 0.1, z], [0.52, 0.2, 0.52]);
  kit.mesh(parent, name, shape, kit.mat(`${name}-material`, color),
    [x, height / 2 + 0.1, z], [0.2, height, 0.2]);
  kit.mesh(parent, `${name}-capital`, "box", kit.mat(`${name}-capital-material`, color),
    [x, height + 0.2, z], [0.48, 0.2, 0.48]);
}

function addCrystal(kit, parent, name, x, y, z, height, color = COLORS.glass) {
  const crystalMaterial = kit.mat(`${name}-material`, color, {
    emissive: color,
    emissiveIntensity: 0.28,
    roughness: 0.31,
    metalness: 0.08,
  });
  const stem = kit.mesh(parent, `${name}-stem`, "taper", kit.mat(`${name}-stem-material`, COLORS.teal),
    [x, y + height * 0.24, z], [0.1, height * 0.48, 0.1]);
  const shard = kit.mesh(parent, name, "cone", crystalMaterial,
    [x, y + height * 0.68, z], [0.23, height * 0.64, 0.23], [0, 0, 0.05]);
  shard.rotation.y = 0.18;
  return { stem, shard };
}

function createObservatory(kit) {
  const group = kit.group;
  const stone = kit.mat("observatory-stone", "#b5c3ad");
  for (const [index, x, z] of [
    [0, -1.62, -0.55], [1, 1.62, -0.55],
    [2, -1.62, 1.48], [3, 1.62, 1.48],
  ]) {
    addPillar(kit, group, `observatory-pillar-${index}`, x, z, index < 2 ? 2.75 : 3.05,
      index % 2 ? "#b8c7b0" : "#9eafa3");
  }
  // Side and rear lintels frame the sight line while leaving the approach open.
  kit.mesh(group, "observatory-left-lintel", "box", stone,
    [-1.62, 2.97, 0.47], [0.42, 0.3, 2.15], [0, 0, -0.03]);
  kit.mesh(group, "observatory-right-lintel", "box", stone,
    [1.62, 2.97, 0.47], [0.42, 0.3, 2.15], [0, 0, 0.03]);
  kit.mesh(group, "observatory-rear-lintel", "box", stone,
    [0, 3.37, 1.48], [3.65, 0.36, 0.42]);
  kit.mesh(group, "observatory-rear-pedestal", "box", kit.mat("observatory-pedestal", "#728d87"),
    [0, 0.26, 1.55], [1.05, 0.52, 0.82]);
  kit.mesh(group, "observatory-lens-orb", "icosahedron", kit.mat("observatory-lens", COLORS.glassLight, {
    emissive: "#67d9ce",
    emissiveIntensity: 0.9,
    metalness: 0.15,
  }), [0, 1.83, 1.47], [0.38, 0.38, 0.38]);
  kit.mesh(group, "observatory-lens-ring", "torus", kit.mat("observatory-ring", "#7caaa3", {
    emissive: "#3a918c",
    emissiveIntensity: 0.42,
    metalness: 0.35,
  }), [0, 1.83, 1.47], [0.72, 0.72, 0.72], [Math.PI / 2, 0, 0]);
  kit.mesh(group, "observatory-upper-ring", "torus", kit.mat("observatory-ring-upper", "#d0d7be", {
    metalness: 0.32,
  }), [0, 3.66, 1.48], [0.83, 0.83, 0.83], [0.3, 0, 0]);
  addCrystal(kit, group, "observatory-side-crystal-left", -1.1, 0.08, 1.05, 1.05, "#73cfc4");
  addCrystal(kit, group, "observatory-side-crystal-right", 1.1, 0.08, 1.05, 1.22, "#b2d99a");
}

function createGlassGrove(kit) {
  const group = kit.group;
  const treeSites = [
    [-1.72, -1.42, 0.9], [1.72, -1.42, 1.05],
    [-1.72, 0.25, 1.25], [1.72, 0.25, 1.1],
    [-1.32, 1.72, 1.5], [1.32, 1.72, 1.34],
  ];
  treeSites.forEach(([x, z, height], index) => {
    kit.mesh(group, `glass-trunk-${index}`, "taper", kit.mat("grove-trunk", "#507d71"),
      [x, height * 0.48, z], [0.13, height * 0.96, 0.13], [0, 0, (index % 2 ? -1 : 1) * 0.035]);
    addCrystal(kit, group, `glass-crown-${index}`, x, height * 0.7, z, 1.15 + (index % 3) * 0.18,
      index % 2 ? "#a4edcf" : "#78d9cb");
    kit.mesh(group, `glass-leaf-${index}`, "icosahedron", kit.mat("grove-leaves", "#b6efc4", {
      emissive: "#49aa91",
      emissiveIntensity: 0.18,
    }), [x + (index % 2 ? -0.22 : 0.22), height + 0.55, z], [0.31, 0.54, 0.28],
    [0, 0, index % 2 ? -0.22 : 0.22]);
  });
  // A small cluster at the back acts as the grove's focal point without filling its trail.
  addCrystal(kit, group, "grove-heart-left", -0.48, 0.08, 1.8, 2.25, "#9cf0d2");
  addCrystal(kit, group, "grove-heart-center", 0.05, 0.08, 1.92, 2.9, "#d1f6bd");
  addCrystal(kit, group, "grove-heart-right", 0.55, 0.08, 1.76, 2.05, "#78d9cb");
  kit.mesh(group, "grove-root-stone-left", "icosahedron", kit.mat("grove-root", "#799783"),
    [-1.2, 0.16, -0.1], [0.56, 0.17, 0.36]);
  kit.mesh(group, "grove-root-stone-right", "icosahedron", kit.mat("grove-root", "#799783"),
    [1.2, 0.16, -0.1], [0.56, 0.17, 0.36]);
}

function createAshArchive(kit) {
  const group = kit.group;
  for (const side of [-1, 1]) {
    const label = side < 0 ? "west" : "east";
    const x = side * 1.63;
    for (let index = 0; index < 3; index++) {
      const z = -1.25 + index * 1.2;
      const height = 2.7 + ((index + (side > 0 ? 1 : 0)) % 2) * 0.66;
      addPillar(kit, group, `archive-${label}-column-${index}`, x, z, height,
        index % 2 ? "#9b9990" : "#b2a696", "box");
    }
    kit.mesh(group, `archive-${label}-shelf-low`, "box", kit.mat("archive-shelves", "#877f73"),
      [x, 1.05, -0.05], [0.42, 0.16, 2.34]);
    kit.mesh(group, `archive-${label}-shelf-high`, "box", kit.mat("archive-shelves", "#a49b8a"),
      [x, 2.05, -0.05], [0.38, 0.14, 2.34]);
    for (let index = 0; index < 3; index++) {
      kit.mesh(group, `archive-${label}-tablet-${index}`, "box", kit.mat("archive-tablets", "#c4b9a6"),
        [x + side * 0.045, 1.35 + index * 0.34, -0.78 + index * 0.74],
        [0.22, 0.25, 0.17], [0, side * 0.08, side * -0.08]);
    }
  }
  kit.mesh(group, "archive-rear-stela", "box", kit.mat("archive-stela", "#b9ad97"),
    [0, 1.35, 1.72], [0.75, 2.7, 0.3]);
  kit.mesh(group, "archive-stela-cap", "dodecahedron", kit.mat("archive-cap", "#dfb87e"),
    [0, 2.95, 1.72], [0.48, 0.33, 0.35]);
  kit.mesh(group, "archive-header", "box", kit.mat("archive-header", "#8c897f"),
    [0, 3.57, 1.62], [3.35, 0.3, 0.4]);
  kit.mesh(group, "archive-header-break-left", "icosahedron", kit.mat("archive-break", "#a69f90"),
    [-1.4, 3.78, 1.62], [0.37, 0.27, 0.34], [0, 0, -0.24]);
  kit.mesh(group, "archive-header-break-right", "icosahedron", kit.mat("archive-break", "#a69f90"),
    [1.4, 3.77, 1.62], [0.34, 0.3, 0.34], [0, 0, 0.2]);
  kit.mesh(group, "archive-front-left-step", "box", kit.mat("archive-stone", "#928d80"),
    [-1.32, 0.13, -1.5], [0.9, 0.26, 0.56]);
  kit.mesh(group, "archive-front-right-step", "box", kit.mat("archive-stone", "#928d80"),
    [1.32, 0.13, -1.5], [0.9, 0.26, 0.56]);
}

export function createLandmark(THREE, site = {}) {
  const kit = makeKit(THREE);
  const kind = site?.kind;
  kit.group.name = `landmark-${kind || "observatory"}`;
  if (kind === "glass-grove") createGlassGrove(kit);
  else if (kind === "ash-archive") createAshArchive(kit);
  else createObservatory(kit);
  kit.group.userData.kind = kind || "drowned-observatory";
  kit.group.userData.siteId = site?.id;
  return kit.group;
}

export function createBeacon(THREE) {
  const kit = makeKit(THREE);
  const model = kit.group;
  model.name = "broken-beacon";
  const stone = kit.mat("beacon-stone", "#81938b");
  kit.mesh(model, "beacon-base-left", "box", stone,
    [-0.48, 0.16, 0], [0.58, 0.32, 0.58]);
  kit.mesh(model, "beacon-base-right", "box", kit.mat("beacon-stone-light", "#a1ad99"),
    [0.48, 0.16, 0], [0.58, 0.32, 0.58]);
  kit.mesh(model, "beacon-foot-rear", "box", stone,
    [0, 0.1, 0.38], [1.28, 0.2, 0.34]);
  kit.mesh(model, "beacon-left-spire", "taper", kit.mat("beacon-left", "#9cab9f"),
    [-0.48, 1.68, 0.02], [0.34, 3.1, 0.34], [0, 0, 0.09]);
  kit.mesh(model, "beacon-right-spire", "taper", kit.mat("beacon-right", "#718780"),
    [0.48, 2.05, 0.08], [0.31, 3.75, 0.31], [0, 0, -0.11]);
  kit.mesh(model, "beacon-split-cap", "icosahedron", kit.mat("beacon-cap", "#a6b5a4"),
    [0, 3.63, 0.08], [0.34, 0.48, 0.31], [0, 0, 0.12]);
  kit.mesh(model, "beacon-cross-stone", "box", stone,
    [0, 2.42, 0.12], [1.36, 0.28, 0.34], [0, 0, -0.03]);

  const crystals = [
    addCrystal(kit, model, "beacon-crystal-one", -0.82, 0.04, -0.34, 0.92, "#74d9cc").shard,
    addCrystal(kit, model, "beacon-crystal-two", 0.82, 0.04, -0.34, 1.02, "#a4e6a7").shard,
    addCrystal(kit, model, "beacon-crystal-three", 0, 0.04, 0.52, 0.86, "#f2c36c").shard,
  ];
  kit.mesh(model, "beacon-heart", "icosahedron", kit.mat("beacon-heart", COLORS.seafoam, {
    emissive: "#49d4bf",
    emissiveIntensity: 0.78,
  }), [0, 1.62, -0.19], [0.24, 0.29, 0.18]);
  const beam = kit.child(model, "beacon-signal-beam", [0, 3.6, 0]);
  const beamMaterial = kit.mat("beacon-beam-material", "#b5fff0", {
    emissive: "#79e6d7",
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  kit.mesh(beam, "signal-column", "cone", beamMaterial,
    [0, 2.25, 0], [0.42, 4.5, 0.42], [0, 0, Math.PI]);
  beam.visible = false;
  model.userData.kind = "beacon";
  model.userData.crystals = crystals;
  model.userData.beam = beam;
  return model;
}

function createCampfire(kit) {
  const group = kit.group;
  const stone = kit.mat("fire-stones", "#807a68");
  for (let index = 0; index < 7; index++) {
    const angle = (index / 7) * Math.PI * 2;
    kit.mesh(group, `fire-stone-${index}`, "icosahedron", stone,
      [Math.cos(angle) * 0.38, 0.1, Math.sin(angle) * 0.34], [0.16, 0.14, 0.15]);
  }
  for (let index = 0; index < 3; index++) {
    const angle = index * (Math.PI / 3);
    kit.mesh(group, `firewood-${index}`, "cylinder", kit.mat("firewood", "#694b35"),
      [Math.cos(angle) * 0.03, 0.2 + index * 0.025, Math.sin(angle) * 0.03],
      [0.08, 0.55, 0.08], [Math.PI / 2, 0.12, angle]);
  }
  const flame = kit.child(group, "flame", [0, 0.28, 0]);
  kit.mesh(flame, "flame-outer", "cone", kit.mat("flame-outer", COLORS.ember, {
    emissive: "#eb6230",
    emissiveIntensity: 1.2,
    roughness: 0.42,
  }), [0, 0.38, 0], [0.23, 0.8, 0.2]);
  kit.mesh(flame, "flame-inner", "cone", kit.mat("flame-inner", COLORS.emberLight, {
    emissive: "#ffb33e",
    emissiveIntensity: 1.1,
    roughness: 0.38,
  }), [0, 0.26, -0.01], [0.12, 0.55, 0.12]);
  group.userData.flame = flame;
}

function createBridge(kit, structure) {
  const group = kit.group;
  for (let index = 0; index < 5; index++) {
    const z = -0.42 + index * 0.21;
    kit.mesh(group, `bridge-plank-${index}`, "box", kit.mat("bridge-planks", index % 2 ? "#9e724b" : "#ad8053"),
      [0, 0.11, z], [0.88, 0.14, 0.18]);
  }
  for (const side of [-1, 1]) {
    kit.mesh(group, `bridge-rail-${side}`, "cylinder", kit.mat("bridge-rails", "#77563e"),
      [side * 0.43, 0.26, 0], [0.07, 0.74, 0.07], [Math.PI / 2, 0, 0]);
    for (const z of [-0.37, 0.37]) {
      kit.mesh(group, `bridge-post-${side}-${z}`, "box", kit.mat("bridge-posts", "#806044"),
        [side * 0.43, 0.24, z], [0.12, 0.32, 0.12]);
    }
  }
  if (Number.isFinite(structure?.rotation)) group.rotation.y = structure.rotation;
}

function createRecoveryCache(kit) {
  const group = kit.group;
  kit.mesh(group, "cache-stone-foot", "box", kit.mat("cache-stone", "#8d978b"),
    [0, 0.08, 0], [0.86, 0.16, 0.7]);
  kit.mesh(group, "cache-chest", "box", kit.mat("cache-wood", "#9a6843"),
    [0, 0.34, 0], [0.68, 0.42, 0.55]);
  kit.mesh(group, "cache-lid", "box", kit.mat("cache-lid", "#bd8851"),
    [0, 0.59, -0.015], [0.73, 0.13, 0.59], [-0.06, 0, 0]);
  kit.mesh(group, "cache-front-band", "box", kit.mat("cache-band", "#bda66f", { metalness: 0.2 }),
    [0, 0.37, -0.282], [0.13, 0.4, 0.035]);
  kit.mesh(group, "cache-latch", "icosahedron", kit.mat("cache-latch", COLORS.gold, { metalness: 0.25 }),
    [0, 0.38, -0.315], [0.065, 0.075, 0.035]);
}

export function createStructure(THREE, structure = {}) {
  const kit = makeKit(THREE);
  const kind = structure?.kind;
  kit.group.name = `structure-${kind || "unknown"}`;
  if (kind === "campfire") createCampfire(kit);
  else if (kind === "bridge") createBridge(kit, structure);
  else if (kind === "recovery-cache") createRecoveryCache(kit);
  kit.group.userData.kind = kind;
  kit.group.userData.structureId = structure?.id;
  return kit.group;
}
