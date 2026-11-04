import * as THREE from "./vendor/three/three.module.js";
import { createChunkVisual } from "./scene-world.js";
import {
  createPlayer,
  animatePlayer,
  createSentinel,
  animateSentinel,
  createLandmark,
  createBeacon,
  createStructure,
} from "./scene-actors.js?v=6";
import {
  heightFromStream,
  movementForCamera,
  cameraHeading,
  tileFromStream,
} from "./spatial.js";
import { getWorldPhase } from "./game.js?v=5";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (n) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const terrainColors = {
  water: "#246c7a",
  shallows: "#60a8a3",
  sand: "#d7bd7b",
  meadow: "#83a95c",
  forest: "#477e57",
  marsh: "#638c72",
  hill: "#a1a17c",
  mountain: "#939aa0",
  path: "#c4ac70",
};
function disposeObject(object) {
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  object.traverse((child) => {
    if (child.isInstancedMesh) child.dispose();
    if (child.geometry) geometries.add(child.geometry);
    for (const material of Array.isArray(child.material)
      ? child.material
      : [child.material])
      if (material) {
        materials.add(material);
        if (material.map) textures.add(material.map);
      }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
  object.removeFromParent();
}
function label(text, color = "#f0e6b9") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const g = canvas.getContext("2d");
  g.fillStyle = "#102b29cc";
  g.beginPath();
  g.roundRect(4, 13, 504, 70, 12);
  g.fill();
  g.fillStyle = color;
  g.font = "28px Georgia";
  g.textAlign = "center";
  g.fillText(text, 256, 58);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  );
  sprite.scale.set(4.6, 0.86, 1);
  return sprite;
}

export class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.is3D = true;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.2;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#b6d7ca");
    this.scene.fog = new THREE.FogExp2("#b6d7ca", 0.028);
    this.viewCamera = new THREE.PerspectiveCamera(60, 1, 0.08, 180);
    this.yaw = 0.5;
    this.pitch = 0.38;
    this.distance = 11;
    this.target = new THREE.Vector3();
    this.origin = { x: 0, y: 0 };
    this.camera = { x: 0, y: 0 };
    this.initialized = false;
    this.worldRoot = new THREE.Group();
    this.scene.add(this.worldRoot);
    this.chunks = new Map();
    this.enemies = new Map();
    this.structures = new Map();
    this.labels = [];
    this.particles = [];
    this.serial = 0;
    this.lastHarvest = -1;
    this.lastPlayer = null;
    this.player = createPlayer(THREE);
    this.worldRoot.add(this.player);
    this.hemi = new THREE.HemisphereLight("#d9f3de", "#647747", 2.2);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight("#fff0c5", 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -19;
    this.sun.shadow.camera.right = 19;
    this.sun.shadow.camera.top = 19;
    this.sun.shadow.camera.bottom = -19;
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 65;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun, this.sun.target);
    this.lantern = new THREE.PointLight("#ffd592", 0, 8, 1.4);
    this.scene.add(this.lantern);
    this.fireLight = new THREE.PointLight("#ffbd77", 0, 7, 1.5);
    this.scene.add(this.fireLight);
    this.beaconLight = new THREE.PointLight("#7cf6e5", 1.5, 9, 2);
    this.worldRoot.add(this.beaconLight);
    this.makeSky();
    this.makeWater();
    this.makeParticles();
    this.makePreview();
    this.map = document.querySelector("#survey");
    this.mapContext = this.map.getContext("2d");
    this.mapTimer = 0;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.setQuality("balanced");
  }
  setQuality(quality) {
    this.quality = ["low", "balanced", "high"].includes(quality)
      ? quality
      : "balanced";
    this.gl.shadowMap.enabled = this.quality !== "low";
    const size = this.quality === "high" ? 1536 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    if (this.width) this.resize(this.width, this.height);
  }
  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const dpr = Math.min(
      devicePixelRatio || 1,
      this.quality === "high" ? 1.6 : this.quality === "low" ? 1 : 1.25,
    );
    const pixels =
      this.quality === "high"
        ? 2400000
        : this.quality === "low"
          ? 800000
          : 1400000;
    const scale = Math.min(dpr, Math.sqrt(pixels / (this.width * this.height)));
    this.gl.setPixelRatio(1);
    this.gl.setSize(
      Math.round(this.width * scale),
      Math.round(this.height * scale),
      false,
    );
    this.viewCamera.aspect = this.width / this.height;
    this.viewCamera.updateProjectionMatrix();
  }
  makeSky() {
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(130, 24, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color("#74b7cf") },
          bottom: { value: new THREE.Color("#e1e7bd") },
        },
        vertexShader:
          "varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader:
          "uniform vec3 top;uniform vec3 bottom;varying vec3 vDirection;void main(){float h=pow(max(normalize(vDirection).y,0.0),0.65);gl_FragColor=vec4(mix(bottom,top,h),1.0); #include <tonemapping_fragment>\n #include <colorspace_fragment>\n}",
      }),
    );
    // Shader includes must start on their own line on all WebGL drivers.
    this.sky.material.fragmentShader = this.sky.material.fragmentShader.replace(
      " #include",
      "\n#include",
    );
    this.scene.add(this.sky);
    const cloudGeometry = new THREE.IcosahedronGeometry(1, 1),
      cloudMaterial = new THREE.MeshLambertMaterial({
        color: "#fff8df",
        transparent: true,
        opacity: 0.82,
        flatShading: true,
        depthWrite: false,
      });
    this.clouds = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, 42);
    this.clouds.frustumCulled = false;
    this.scene.add(this.clouds);
    this.cloudDummy = new THREE.Object3D();
    const starPositions = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) {
      const a = hash(i + 1) * Math.PI * 2,
        h = 0.12 + hash(i + 222) * 0.88,
        r = Math.sqrt(1 - h * h);
      starPositions.set(
        [Math.cos(a) * r * 95, h * 95, Math.sin(a) * r * 95],
        i * 3,
      );
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3),
    );
    this.stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: "#e9f7ec",
        size: 0.17,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.scene.add(this.stars);
    this.sunDisk = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 12, 8),
      new THREE.MeshBasicMaterial({ color: "#fff0b6", fog: false }),
    );
    this.scene.add(this.sunDisk);
  }
  makeWater() {
    const geometry = new THREE.PlaneGeometry(220, 220, 76, 76);
    geometry.rotateX(-Math.PI / 2);
    this.waterTime = { value: 0 };
    const material = new THREE.MeshPhongMaterial({
      color: "#43a7ad",
      specular: "#c6f5db",
      shininess: 130,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.waterTime = this.waterTime;
      shader.vertexShader =
        "uniform float waterTime; varying vec3 waterPosition;\n" +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n transformed.y += 0.027*sin(position.x*1.8+waterTime*1.6)+0.018*cos(position.z*1.4-waterTime);waterPosition=(modelMatrix*vec4(transformed,1.0)).xyz;",
      );
      shader.fragmentShader =
        "uniform float waterTime; varying vec3 waterPosition;\n" +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        "#include <color_fragment>\n float wave=sin(waterPosition.x*4.0+waterTime)*sin(waterPosition.z*3.2-waterTime*0.8);diffuseColor.rgb+=vec3(0.07,0.11,0.08)*smoothstep(0.65,0.95,wave);",
      );
    };
    this.sea = new THREE.Mesh(geometry, material);
    this.sea.receiveShadow = true;
    this.scene.add(this.sea);
    this.wakes = [];
    const ring = new THREE.RingGeometry(0.2, 0.26, 20);
    ring.rotateX(-Math.PI / 2);
    for (let i = 0; i < 18; i++) {
      const mesh = new THREE.Mesh(
        ring,
        new THREE.MeshBasicMaterial({
          color: "#d9ffea",
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      mesh.visible = false;
      this.worldRoot.add(mesh);
      this.wakes.push({ mesh, life: 0 });
    }
    this.lastWake = { x: 0, y: 0 };
  }
  makeParticles() {
    const positions = new Float32Array(180 * 3),
      colors = new Float32Array(180 * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setDrawRange(0, 0);
    this.sparks = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.095,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    this.sparks.frustumCulled = false;
    this.scene.add(this.sparks);
    const moteGeometry = new THREE.BufferGeometry();
    moteGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(70 * 3), 3),
    );
    this.motes = new THREE.Points(
      moteGeometry,
      new THREE.PointsMaterial({
        color: "#ecf4b2",
        size: 0.055,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);
  }
  makePreview() {
    const geometry = new THREE.BoxGeometry(0.96, 0.1, 0.96);
    this.preview = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: "#bdf392",
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    this.preview.visible = false;
    this.worldRoot.add(this.preview);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: "#e9ffd1" }),
    );
    this.preview.add(edges);
  }
  resetWorld(stream, sites, biomes) {
    for (const value of this.chunks.values()) value.visual.dispose();
    this.chunks.clear();
    for (const value of this.enemies.values()) disposeObject(value);
    this.enemies.clear();
    for (const value of this.structures.values()) disposeObject(value);
    this.structures.clear();
    for (const value of this.siteModels || []) disposeObject(value);
    this.siteModels = [];
    this.labels = [];
    this.stream = stream;
    this.lastHarvest = -1;
    this.initialized = false;
    this.lastPlayer = null;
    this.particles = [];
    for (const wake of this.wakes) {
      wake.life = 0;
      wake.mesh.visible = false;
    }
    this.beacon = createBeacon(THREE);
    this.beacon.position.set(0, heightFromStream(stream, 0, 0), 0);
    this.worldRoot.add(this.beacon);
    this.siteModels.push(this.beacon);
    const homeLabel = label("The listening beacon");
    homeLabel.position.set(0, 4.8, 0);
    this.worldRoot.add(homeLabel);
    this.siteModels.push(homeLabel);
    this.labels.push({ object: homeLabel, x: 0, y: 0 });
    for (const site of sites) {
      const model = createLandmark(THREE, site);
      model.position.set(
        site.x,
        heightFromStream(stream, site.x, site.y),
        site.y,
      );
      this.worldRoot.add(model);
      this.siteModels.push(model);
      model.userData.site = site;
      const tag = label(site.title, site.color);
      tag.position.set(site.x, 5.5, site.y);
      this.worldRoot.add(tag);
      this.siteModels.push(tag);
      this.labels.push({ object: tag, x: site.x, y: site.y });
    }
    for (const site of biomes) {
      const tag = label(site.title, site.color);
      tag.position.set(site.x, 4.2, site.y);
      this.worldRoot.add(tag);
      this.siteModels.push(tag);
      this.labels.push({ object: tag, x: site.x, y: site.y });
    }
  }
  syncChunks(state, stream) {
    for (const [key, entry] of this.chunks)
      if (stream.cache.get(key) !== entry.chunk) {
        entry.visual.dispose();
        this.chunks.delete(key);
      }
    const harvested = new Set(state.harvested),
      changed = this.lastHarvest !== state.harvested.length;
    for (const [key, chunk] of stream.cache) {
      let entry = this.chunks.get(key);
      const neighbors = [];
      for (let y = -1; y <= 1; y++)
        for (let x = -1; x <= 1; x++)
          neighbors.push(stream.cache.get(`${chunk.cx + x},${chunk.cy + y}`));
      const changedNeighbors =
        entry &&
        neighbors.some((value, index) => value !== entry.neighbors[index]);
      if (!entry || (changedNeighbors && !stream.pending?.size)) {
        entry?.visual.dispose();
        const visual = createChunkVisual(THREE, chunk, (x, y) =>
          tileFromStream(stream, x, y),
        );
        this.worldRoot.add(visual.group);
        entry = { chunk, visual, neighbors };
        this.chunks.set(key, entry);
        visual.updateHarvested(harvested);
      } else if (changed) entry.visual.updateHarvested(harvested);
      entry.visual.group.visible =
        Math.hypot(
          chunk.cx * 16 + 8 - state.player.x,
          chunk.cy * 16 + 8 - state.player.y,
        ) < 49;
    }
    this.lastHarvest = state.harvested.length;
    this.harvestedIds = harvested;
  }
  groundHeight(state, stream, x, y) {
    if (
      state.structures.some(
        (s) =>
          s.kind === "bridge" &&
          s.x === Math.floor(x + 0.5) &&
          s.y === Math.floor(y + 0.5),
      )
    )
      return 0.18;
    return heightFromStream(stream, x, y);
  }
  updateOrigin(player) {
    const x = Math.floor(player.x / 16) * 16,
      y = Math.floor(player.y / 16) * 16;
    if (x !== this.origin.x || y !== this.origin.y) {
      const dx = this.origin.x - x,
        dy = this.origin.y - y;
      this.viewCamera.position.x += dx;
      this.viewCamera.position.z += dy;
      this.target.x += dx;
      this.target.z += dy;
      this.origin = { x, y };
      this.worldRoot.position.set(-x, 0, -y);
    }
  }
  orbit(horizontal, vertical = 0) {
    this.yaw += horizontal;
    this.pitch = clamp(this.pitch + vertical, 0.05, 1.35);
  }
  zoom(amount) {
    this.distance = clamp(this.distance + amount, 5.5, 23);
  }
  resetCamera() {
    this.yaw = 0.5;
    this.pitch = 0.38;
    this.distance = 11;
  }
  movement(x, y) {
    return movementForCamera(x, y, this.yaw);
  }
  pick(clientX, clientY) {
    if (!this.stream || this.showMap) return null;
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((clientX - r.left) / r.width) * 2 - 1,
      (-(clientY - r.top) / r.height) * 2 + 1,
    );
    this.viewCamera.updateMatrixWorld();
    this.worldRoot.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointer, this.viewCamera);
    const hits = this.raycaster.intersectObjects(
      [
        this.sea,
        ...[...this.chunks.values()]
          .filter((e) => e.visual.group.visible)
          .map((e) => e.visual.ground),
      ],
      false,
    );
    if (!hits.length) return null;
    const point = hits[0].point;
    return {
      x: Math.floor(point.x + this.origin.x + 0.5),
      y: Math.floor(point.z + this.origin.y + 0.5),
    };
  }
  burst(x, y, color = "#f7d58b") {
    if (this.reduced) return;
    const h = this.stream ? heightFromStream(this.stream, x, y) : 0.14;
    for (let i = 0; i < 10; i++) {
      const n = ++this.serial,
        a = hash(n) * Math.PI * 2;
      this.particles.push({
        x,
        y: h + 0.6,
        z: y,
        vx: Math.cos(a) * (1 + hash(n + 1)),
        vy: 1 + hash(n + 2) * 2,
        vz: Math.sin(a) * (1 + hash(n + 3)),
        life: 0.5 + hash(n + 4) * 0.35,
        color: new THREE.Color(color),
      });
    }
    this.particles = this.particles.slice(-180);
  }
  feedback(event) {
    if (event.type === "damage") this.hurtUntil = performance.now() + 350;
    if (
      this.reduced ||
      !["attack", "harvest", "land", "discovery"].includes(event.type)
    )
      return;
    const ring = this.wakes.find((w) => w.life <= 0) || this.wakes[0];
    ring.life = 0.65;
    ring.mesh.position.set(
      event.x,
      heightFromStream(this.stream, event.x, event.y) + 0.045,
      event.y,
    );
    ring.mesh.material.color.set(
      event.type === "discovery" ? "#ffd889" : "#bdf3c9",
    );
  }
  updateEffects(state, dt, time) {
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 5 * dt;
      return p.life > 0;
    });
    const positions = this.sparks.geometry.attributes.position,
      colors = this.sparks.geometry.attributes.color;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      positions.setXYZ(i, p.x - this.origin.x, p.y, p.z - this.origin.y);
      colors.setXYZ(i, p.color.r, p.color.g, p.color.b);
    }
    positions.needsUpdate = true;
    colors.needsUpdate = true;
    this.sparks.geometry.setDrawRange(0, this.particles.length);
    const p = state.player;
    if (
      p.swimming &&
      !this.reduced &&
      Math.hypot(p.x - this.lastWake.x, p.y - this.lastWake.y) > 0.35
    ) {
      const wake = this.wakes.find((w) => w.life <= 0) || this.wakes[0];
      wake.life = 1;
      wake.mesh.position.set(p.x, 0.035, p.y);
      wake.mesh.material.color.set("#d9ffea");
      this.lastWake = { x: p.x, y: p.y };
    }
    for (const wake of this.wakes) {
      wake.life = Math.max(0, wake.life - dt);
      wake.mesh.visible = wake.life > 0;
      wake.mesh.material.opacity = wake.life * 0.55;
      wake.mesh.scale.setScalar(1 + (1 - wake.life) * 3);
    }
    const motes = this.motes.geometry.attributes.position;
    this.motes.visible = !this.reduced;
    for (let i = 0; i < 70; i++) {
      const radius = hash(i + 28) * (p.diving ? 6 : 17),
        angle = hash(i + 53) * Math.PI * 2 + time * 0.03;
      const x = p.x + Math.cos(angle) * radius,
        z = p.y + Math.sin(angle) * radius;
      const y = p.diving
        ? -0.8 + ((hash(i + 70) + time * 0.2) % 1) * 0.8
        : heightFromStream(this.stream, x, z) +
          0.8 +
          hash(i + 91) * 2 +
          Math.sin(time + i) * 0.2;
      motes.setXYZ(i, x - this.origin.x, y, z - this.origin.y);
    }
    motes.needsUpdate = true;
    this.motes.material.color.set(
      p.diving
        ? "#b4f4ed"
        : getWorldPhase(state.time).isNight
          ? "#e7f3a2"
          : "#e9e4b2",
    );
  }
  updateActors(state, stream, time, dt) {
    const p = state.player;
    const speed = this.lastPlayer
      ? Math.min(
          5,
          Math.hypot(p.x - this.lastPlayer.x, p.y - this.lastPlayer.y) /
            Math.max(dt, 0.001),
        )
      : 0;
    const ground = this.groundHeight(state, stream, p.x, p.y),
      targetY = p.swimming
        ? p.diving
          ? -0.76
          : -0.53
        : ground + (p.lift || 0);
    this.player.position.x = p.x;
    this.player.position.z = p.y;
    this.player.position.y = this.initialized
      ? THREE.MathUtils.damp(
          this.player.position.y,
          targetY,
          p.lift ? 28 : 17,
          dt,
        )
      : targetY;
    const rotation = Math.atan2(-p.facing.x, -p.facing.y),
      difference = Math.atan2(
        Math.sin(rotation - this.player.rotation.y),
        Math.cos(rotation - this.player.rotation.y),
      );
    this.player.rotation.y +=
      difference * (this.reduced ? 1 : 1 - Math.exp(-dt * 18));
    animatePlayer(
      this.player,
      {
        ...p,
        hasAxe: Boolean(state.tools.axe),
        hasLantern: Boolean(state.tools.lantern),
      },
      time,
      speed,
      this.reduced,
    );
    this.lastPlayer = { x: p.x, y: p.y };
    const ids = new Set(state.enemies.map((e) => e.id));
    for (const [id, model] of this.enemies)
      if (!ids.has(id)) {
        disposeObject(model);
        this.enemies.delete(id);
      }
    for (const enemy of state.enemies) {
      let model = this.enemies.get(enemy.id);
      if (!model) {
        model = createSentinel(THREE);
        this.worldRoot.add(model);
        this.enemies.set(enemy.id, model);
      }
      model.position.set(
        enemy.x,
        heightFromStream(stream, enemy.x, enemy.y) + 0.06,
        enemy.y,
      );
      model.rotation.y = Math.atan2(enemy.x - p.x, enemy.y - p.y);
      animateSentinel(model, enemy, time, this.reduced);
    }
    const structures = new Set(state.structures.map((s) => s.id));
    for (const [id, model] of this.structures)
      if (!structures.has(id)) {
        disposeObject(model);
        this.structures.delete(id);
      }
    for (const item of state.structures) {
      let model = this.structures.get(item.id);
      if (!model) {
        model = createStructure(THREE, item);
        this.worldRoot.add(model);
        this.structures.set(item.id, model);
      }
      model.visible = !state.harvested.includes(item.id);
      model.position.set(
        item.x,
        item.kind === "bridge" ? 0 : heightFromStream(stream, item.x, item.y),
        item.y,
      );
      const flame = model.getObjectByName("flame");
      if (flame)
        flame.scale.y = this.reduced
          ? 1
          : 1 + Math.sin(time * 9 + item.x) * 0.12;
    }
    this.beacon.position.y = heightFromStream(stream, 0, 0);
    if (this.beacon.userData.beam)
      this.beacon.userData.beam.visible = state.restored;
    for (const crystal of this.beacon.userData.crystals || []) {
      crystal.rotation.y = this.reduced ? 0 : time * 0.6;
    }
    for (const object of this.siteModels)
      if (object.userData.site) {
        const site = object.userData.site;
        object.position.y = heightFromStream(stream, site.x, site.y);
      }
    this.beaconLight.position.set(0, 2.2, 0);
    this.beaconLight.intensity = state.restored ? 5 : 1.5;
    for (const entry of this.labels)
      entry.object.visible = Math.hypot(entry.x - p.x, entry.y - p.y) < 22;
    this.lantern.position.set(
      p.x - this.origin.x,
      this.player.position.y + 1,
      p.y - this.origin.y,
    );
    this.lantern.intensity = state.tools.lantern ? 3.5 : 0;
    const fire = state.structures
      .filter((s) => s.kind === "campfire")
      .sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
      )[0];
    this.fireLight.intensity =
      fire && Math.hypot(fire.x - p.x, fire.y - p.y) < 10 ? 3.2 : 0;
    if (fire)
      this.fireLight.position.set(
        fire.x - this.origin.x,
        heightFromStream(stream, fire.x, fire.y) + 0.55,
        fire.y - this.origin.y,
      );
  }
  updateSky(state, time) {
    if (this.reduced) time = 0;
    const night = getWorldPhase(state.time).night / 0.64,
      diving = state.player.diving;
    const top = new THREE.Color("#71b8cf").lerp(
        new THREE.Color("#102b49"),
        night,
      ),
      bottom = new THREE.Color("#e3e6bf").lerp(
        new THREE.Color("#5b7180"),
        night,
      );
    this.sky.material.uniforms.top.value.copy(top);
    this.sky.material.uniforms.bottom.value.copy(bottom);
    this.scene.fog.color.copy(diving ? new THREE.Color("#176f79") : bottom);
    this.scene.fog.density = diving ? 0.14 : 0.027;
    this.hemi.intensity = 2.2 - night * 0.95;
    this.sun.intensity = 3 - night * 2.4;
    this.sun.color.set(night > 0.4 ? "#b5d6f0" : "#fff0c5");
    this.sun.position.set(
      this.target.x + 15,
      this.target.y + 23,
      this.target.z + 11,
    );
    this.sun.target.position.copy(this.target);
    this.sky.position.copy(this.viewCamera.position);
    this.stars.position.copy(this.viewCamera.position);
    this.stars.material.opacity = night * 0.85;
    this.sunDisk.position
      .copy(this.viewCamera.position)
      .add(new THREE.Vector3(-35, 12, -90));
    this.sunDisk.material.color.set(night > 0.5 ? "#d9edf0" : "#fff0b6");
    for (let i = 0; i < 42; i++) {
      const cluster = Math.floor(i / 3),
        part = i % 3,
        d = this.cloudDummy;
      const x =
        ((((hash(cluster + 12) * 120 + time * 0.42 + state.player.x) % 120) +
          120) %
          120) -
        60;
      const z = hash(cluster + 65) * 110 - 55;
      d.position.set(
        this.target.x + x + part * 1.4,
        12 + hash(cluster + 75) * 4 + part * 0.3,
        this.target.z + z,
      );
      d.scale.set(
        2.3 + hash(i + 22),
        0.55 + hash(i + 23) * 0.4,
        1.2 + hash(i + 24),
      );
      d.rotation.set(0, hash(i + 25) * 3, 0);
      d.updateMatrix();
      this.clouds.setMatrixAt(i, d.matrix);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    this.clouds.material.opacity = 0.82 - night * 0.4;
  }
  updateCamera(state, stream, dt) {
    const p = state.player,
      desiredTarget = new THREE.Vector3(
        p.x - this.origin.x,
        this.player.position.y + (p.diving ? 0.1 : 0.9),
        p.y - this.origin.y,
      );
    this.sea.material.opacity = p.diving ? 0.88 : 0.7;
    const teleport = this.target.distanceTo(desiredTarget) > 14;
    if (!this.initialized || this.reduced || teleport)
      this.target.copy(desiredTarget);
    else this.target.lerp(desiredTarget, 1 - Math.exp(-dt * 10));
    const distance = p.diving ? Math.min(this.distance, 4.5) : this.distance;
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch) * distance,
      Math.sin(this.pitch) * distance,
      Math.cos(this.yaw) * Math.cos(this.pitch) * distance,
    );
    const desired = this.target.clone().add(offset);
    if (p.diving) {
      // Keep the submerged camera in the same wet corridor as the swimmer.
      // A long orbit otherwise passes through islands and exposes their backs.
      let safe = 0.05;
      for (let i = 1; i <= 20; i++) {
        const t = i / 20;
        const x = this.target.x + offset.x * t + this.origin.x;
        const z = this.target.z + offset.z * t + this.origin.y;
        const tile = tileFromStream(stream, x, z);
        if (tile?.terrain !== "water" || heightFromStream(stream, x, z) > -0.33)
          break;
        safe = t;
      }
      desired.x = this.target.x + offset.x * safe;
      desired.z = this.target.z + offset.z * safe;
      desired.y = -0.17;
    } else {
      for (let i = 1; i <= 8; i++) {
        const t = i / 8,
          x = THREE.MathUtils.lerp(this.target.x, desired.x, t) + this.origin.x,
          z = THREE.MathUtils.lerp(this.target.z, desired.z, t) + this.origin.y;
        const h = this.groundHeight(state, stream, x, z) + 0.8;
        if (THREE.MathUtils.lerp(this.target.y, desired.y, t) < h)
          desired.y = Math.max(
            desired.y,
            this.target.y + (h - this.target.y) / t,
          );
      }
    }
    if (!this.initialized || this.reduced || teleport)
      this.viewCamera.position.copy(desired);
    else this.viewCamera.position.lerp(desired, 1 - Math.exp(-dt * 12));
    this.viewCamera.lookAt(this.target);
    this.camera = { x: p.x, y: p.y };
    this.initialized = true;
  }
  updateOcclusion(state, stream, dt) {
    const camera = this.viewCamera.position;
    const x = camera.x + this.origin.x,
      z = camera.z + this.origin.y;
    const dx = state.player.x - x,
      dz = state.player.y - z;
    const length = dx * dx + dz * dz;
    const hidden = new Set();
    const trees = [];
    for (const entry of this.chunks.values())
      if (entry.visual.group.visible && entry.visual.occluders)
        trees.push(...entry.visual.occluders);
    if (!trees.length)
      trees.push(
        ...stream
          .entitiesNear(state.player.x, state.player.y, 25)
          .filter((entity) => entity.type === "tree"),
      );
    if (length > 0.01)
      for (const entity of trees) {
        if (this.harvestedIds?.has(entity.id)) continue;
        const t = ((entity.x - x) * dx + (entity.y - z) * dz) / length;
        if (t <= 0 || t >= 1) continue;
        const lateral = Math.hypot(
          entity.x - (x + dx * t),
          entity.y - (z + dz * t),
        );
        if (lateral > 1.25) continue;
        const rayY = THREE.MathUtils.lerp(
          camera.y,
          this.player.position.y + 0.9,
          t,
        );
        const base = heightFromStream(stream, entity.x, entity.y);
        if (rayY > base + 0.25 && rayY < base + 3.8) hidden.add(entity.id);
      }
    for (const entry of this.chunks.values())
      if (entry.visual.group.visible)
        entry.visual.setOccluded?.(hidden, dt, this.reduced);
  }
  drawMap(state, stream, sites, biomes) {
    const w = Math.min(1100, Math.round(this.width)),
      h = Math.min(800, Math.round(this.height));
    if (this.map.width !== w || this.map.height !== h) {
      this.map.width = w;
      this.map.height = h;
    }
    const g = this.mapContext,
      p = state.player;
    g.fillStyle = "#102d2c";
    g.fillRect(0, 0, w, h);
    const destinations = [
        { x: 0, y: 0, title: "Home beacon" },
        ...sites,
        ...biomes,
      ],
      range = Math.max(
        32,
        Math.min(
          160,
          Math.max(
            ...destinations.map((s) => Math.hypot(s.x - p.x, s.y - p.y) + 8),
          ),
        ),
      );
    const scale = Math.min(w, h) / (range * 2),
      screen = (x, y) => [w / 2 + (x - p.x) * scale, h / 2 + (y - p.y) * scale];
    for (const chunk of stream.cache.values())
      for (const tile of chunk.tiles) {
        const [x, y] = screen(tile.x, tile.y);
        g.fillStyle =
          terrainColors[tile.trail ? "path" : tile.terrain] || "#799e62";
        g.fillRect(x - scale * 0.5, y - scale * 0.5, scale + 1, scale + 1);
      }
    for (const site of destinations) {
      const [x, y] = screen(site.x, site.y);
      if (x < 8 || x > w - 8 || y < 28 || y > h - 20) continue;
      g.fillStyle = site.color || "#ffe1a0";
      g.beginPath();
      g.arc(x, y, site.kind ? 5 : 6, 0, 7);
      g.fill();
      g.fillStyle = "#f3edd5";
      g.font = "12px system-ui";
      g.textAlign = "center";
      g.fillText(site.title, x, y - 11);
    }
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(Math.atan2(p.facing.x, -p.facing.y));
    g.fillStyle = "#fff7cb";
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(-5, 6);
    g.lineTo(5, 6);
    g.closePath();
    g.fill();
    g.restore();
    g.fillStyle = "#f5e9c1";
    g.font = "20px Georgia";
    g.textAlign = "left";
    g.fillText("Island survey", 20, 32);
    g.font = "12px system-ui";
    g.fillText("N ↑ · M to return · World paused", 20, h - 20);
  }
  draw(
    state,
    stream,
    sites,
    dt,
    now,
    showMap = false,
    biomes = [],
    placement = null,
  ) {
    const time = now / 1000;
    this.showMap = showMap;
    this.map.hidden = !showMap;
    if (stream !== this.stream) this.resetWorld(stream, sites, biomes);
    this.updateOrigin(state.player);
    this.syncChunks(state, stream);
    const hit = document.querySelector("#hit-veil");
    if (hit)
      hit.style.opacity = showMap
        ? "0"
        : String(Math.max(0, ((this.hurtUntil || 0) - now) / 350) * 0.55);
    this.updateActors(state, stream, time, dt);
    if (showMap) {
      this.drawMap(state, stream, sites, biomes);
      return;
    }
    this.updateCamera(state, stream, dt);
    this.updateOcclusion(state, stream, dt);
    this.updateSky(state, time);
    this.updateEffects(state, dt, time);
    for (const entry of this.chunks.values())
      if (entry.visual.group.visible) entry.visual.animate(time, this.reduced);
    this.waterTime.value = this.reduced ? 0 : time;
    this.sea.position.set(
      state.player.x - this.origin.x,
      0,
      state.player.y - this.origin.y,
    );
    this.preview.visible = Boolean(placement?.kind && placement.point);
    if (this.preview.visible) {
      const point = placement.point;
      this.preview.position.set(
        point.x,
        this.groundHeight(state, stream, point.x, point.y) + 0.075,
        point.y,
      );
      this.preview.material.color.set(placement.valid ? "#b6f69b" : "#ff8268");
    }
    this.gl.render(this.scene, this.viewCamera);
    this.frameCount = (this.frameCount || 0) + 1;
    if (!this.metricStart) this.metricStart = now;
    if (now - this.metricStart > 750) {
      this.fps = Math.round(
        (this.frameCount * 1000) / (now - this.metricStart),
      );
      this.canvas.dataset.renderStats = JSON.stringify({
        ...this.metrics(),
        fps: this.fps,
      });
      this.frameCount = 0;
      this.metricStart = now;
    }
    const compass = document.querySelector("#camera-heading");
    if (compass)
      compass.textContent =
        cameraHeading(this.yaw) +
        (this.canvas.dataset.mouseLook !== "off" &&
        this.canvas.dataset.mouseLook
          ? " · Mouse look · Esc releases"
          : " · Click world to look · Q / T orbit");
  }
  metrics() {
    return {
      calls: this.gl.info.render.calls,
      triangles: this.gl.info.render.triangles,
      geometries: this.gl.info.memory.geometries,
      textures: this.gl.info.memory.textures,
      chunks: this.chunks.size,
      particles: this.particles.length,
      quality: this.quality,
    };
  }
  dispose() {
    for (const entry of this.chunks.values()) entry.visual.dispose();
    this.chunks.clear();
    disposeObject(this.scene);
    this.gl.dispose();
  }
}
