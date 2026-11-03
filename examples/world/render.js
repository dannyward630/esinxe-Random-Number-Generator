const TILE = 32;
const palette = {
  water: "#244c60",
  shallows: "#387982",
  sand: "#c6b77d",
  meadow: "#789358",
  forest: "#476c4e",
  marsh: "#526f66",
  hill: "#8c8d66",
  mountain: "#686d70",
  path: "#ad9d72",
};
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.backgrounds = new WeakMap();
    this.camera = { x: 0, y: 0 };
    this.particles = [];
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  burst(x, y, color = "#f7d58b") {
    if (this.reduced) return;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * 2,
        vy: Math.sin(angle) * 2,
        life: 0.5,
        color,
      });
    }
    this.particles = this.particles.slice(-160);
  }
  background(chunk) {
    if (this.backgrounds.has(chunk)) return this.backgrounds.get(chunk);
    const c = document.createElement("canvas");
    c.width = c.height = 16 * TILE;
    const g = c.getContext("2d");
    for (const t of chunk.tiles) {
      const x = (t.x - chunk.cx * 16) * TILE,
        y = (t.y - chunk.cy * 16) * TILE;
      g.fillStyle = palette[t.terrain] || palette.meadow;
      g.fillRect(x, y, TILE + 1, TILE + 1);
      g.fillStyle = `rgba(255,255,220,${0.02 + (t.texture || 0) * 0.05})`;
      g.fillRect(x + 3, y + 5, 7, 2);
      g.fillStyle = "#172e2310";
      g.fillRect(x + 19, y + 20, 5, 3);
    }
    this.backgrounds.set(chunk, c);
    return c;
  }
  draw(state, stream, sites, dt, time, showMap = false) {
    const { canvas, ctx: g } = this,
      w = canvas.width,
      h = canvas.height;
    const ease = this.reduced ? 1 : 1 - Math.exp(-dt * 15);
    this.camera.x += (state.player.x - this.camera.x) * ease;
    this.camera.y += (state.player.y - this.camera.y) * ease;
    const ox = w / 2 - (this.camera.x + 0.5) * TILE,
      oy = h / 2 - (this.camera.y + 0.5) * TILE;
    g.fillStyle = "#152c2d";
    g.fillRect(0, 0, w, h);
    g.save();
    g.translate(ox, oy);
    const minX = this.camera.x - w / TILE / 2 - 2,
      maxX = this.camera.x + w / TILE / 2 + 2,
      minY = this.camera.y - h / TILE / 2 - 3,
      maxY = this.camera.y + h / TILE / 2 + 3;
    for (const c of stream.cache.values()) {
      if (
        c.cx * 16 > maxX ||
        c.cx * 16 + 16 < minX ||
        c.cy * 16 > maxY ||
        c.cy * 16 + 16 < minY
      )
        continue;
      g.drawImage(this.background(c), c.cx * 16 * TILE, c.cy * 16 * TILE);
      for (const t of c.tiles) {
        if (t.terrain === "water" || t.terrain === "shallows") {
          g.strokeStyle = "#b2e0d61b";
          const wave = this.reduced
            ? 0
            : Math.sin(time * 0.002 + t.x * 0.7 + t.y) * 3;
          g.beginPath();
          g.moveTo(t.x * TILE + 8, t.y * TILE + 15 + wave);
          g.lineTo(t.x * TILE + 22, t.y * TILE + 15 + wave);
          g.stroke();
        }
      }
      for (const blade of c.grass || []) {
        if (
          blade.x < minX ||
          blade.x > maxX ||
          blade.y < minY ||
          blade.y > maxY
        )
          continue;
        const bend = this.reduced ? 0 : Math.sin(time * 0.002 + blade.x) * 2;
        g.strokeStyle = "#a8b47780";
        g.beginPath();
        g.moveTo(blade.x * TILE + 9, blade.y * TILE + 23);
        g.lineTo(blade.x * TILE + 10 + bend, blade.y * TILE + 16);
        g.stroke();
      }
    }
    const dead = new Set(state.harvested);
    const objects = [];
    for (const c of stream.cache.values())
      for (const e of c.entities) {
        if (
          e.type === "sentinel" ||
          dead.has(e.id) ||
          e.x < minX ||
          e.x > maxX ||
          e.y < minY ||
          e.y > maxY
        )
          continue;
        objects.push(e);
      }
    objects.sort((a, b) => a.y - b.y);
    for (const e of objects) {
      const x = (e.x + 0.5) * TILE,
        y = (e.y + 0.5) * TILE;
      g.fillStyle = "#12281d40";
      g.beginPath();
      g.ellipse(x, y + 8, 11, 5, 0, 0, 7);
      g.fill();
      if (e.type === "tree") {
        g.fillStyle = "#79573c";
        g.fillRect(x - 3, y - 8, 6, 20);
        g.fillStyle = "#284a39";
        g.beginPath();
        g.moveTo(x, y - 33);
        g.lineTo(x - 16, y + 1);
        g.lineTo(x + 16, y + 1);
        g.fill();
        g.fillStyle = "#426e4d";
        g.beginPath();
        g.moveTo(x, y - 31);
        g.lineTo(x - 12, y - 8);
        g.lineTo(x + 9, y - 8);
        g.fill();
      } else if (e.type === "rock") {
        g.fillStyle = "#89928a";
        g.beginPath();
        g.moveTo(x - 11, y + 7);
        g.lineTo(x - 9, y - 8);
        g.lineTo(x + 3, y - 13);
        g.lineTo(x + 12, y - 3);
        g.lineTo(x + 9, y + 9);
        g.fill();
        g.fillStyle = "#b3b7a0";
        g.fillRect(x - 6, y - 6, 7, 3);
      } else if (e.type === "berry") {
        g.fillStyle = "#365943";
        g.beginPath();
        g.arc(x, y, 10, 0, 7);
        g.fill();
        g.fillStyle = "#e7a683";
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.arc(x - 5 + i * 5, y - 3 + (i % 2) * 5, 2.5, 0, 7);
          g.fill();
        }
      } else {
        g.fillStyle = e.type === "cache" ? "#cfae61" : "#bbc3a1";
        g.fillRect(x - 9, y - 9, 18, 16);
        g.strokeStyle = "#756b48";
        g.strokeRect(x - 9, y - 9, 18, 16);
        g.fillStyle = "#f6de91";
        g.fillRect(x - 2, y - 6, 4, 10);
      }
    }
    for (const s of state.structures) {
      const x = (s.x + 0.5) * TILE,
        y = (s.y + 0.5) * TILE;
      if (s.kind === "bridge") {
        g.fillStyle = "#634c37";
        g.fillRect(x - 16, y - 16, 32, 32);
        g.fillStyle = "#bc9667";
        for (let i = 0; i < 4; i++) g.fillRect(x - 14, y - 14 + i * 8, 28, 5);
      } else if (s.kind === "recovery-cache") {
        g.fillStyle = "#dab566";
        g.fillRect(x - 10, y - 8, 20, 16);
        g.fillStyle = "#6a4c32";
        g.fillRect(x - 10, y - 1, 20, 3);
        g.fillStyle = "#ffe4a2";
        g.fillRect(x - 2, y - 3, 4, 6);
      } else {
        g.fillStyle = "#5b5140";
        g.beginPath();
        g.ellipse(x, y + 3, 13, 7, 0, 0, 7);
        g.fill();
        g.fillStyle = "#ef994b";
        g.beginPath();
        g.moveTo(x - 7, y + 3);
        g.lineTo(
          x + 2,
          y - 19 + (this.reduced ? 0 : Math.sin(time * 0.01) * 3),
        );
        g.lineTo(x + 8, y + 3);
        g.fill();
      }
    }
    for (const site of sites) {
      const x = (site.x + 0.5) * TILE,
        y = (site.y + 0.5) * TILE,
        found = state.discoveries.includes(site.id);
      g.strokeStyle = site.color || "#a5d8cc";
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(x, y, 46, 22, 0, 0, 7);
      g.stroke();
      g.fillStyle = found ? "#c1aa75" : site.color || "#aaccc7";
      for (const side of [-1, 1]) {
        g.fillRect(x + side * 27 - 5, y - 38, 10, 44);
        g.fillRect(x + side * 27 - 8, y - 40, 16, 5);
      }
      g.fillStyle = "#1b3334";
      g.fillRect(x - 18, y - 30, 36, 30);
      g.fillStyle = site.color || "#b7daca";
      g.save();
      g.translate(x, y - 22);
      g.rotate(Math.PI / 4);
      g.fillRect(-7, -7, 14, 14);
      g.restore();
      if (site.kind === "drowned-observatory") {
        g.strokeStyle = site.color;
        g.lineWidth = 4;
        g.beginPath();
        g.arc(x, y - 30, 25, Math.PI, Math.PI * 2);
        g.stroke();
        g.fillStyle = "#d9f4e8";
        g.beginPath();
        g.arc(x + 5, y - 30, 9, 0, 7);
        g.fill();
      }
      if (site.kind === "glass-grove") {
        for (let i = -1; i <= 1; i++) {
          g.fillStyle = i === 0 ? "#d6f1bc" : "#79b8a3";
          g.beginPath();
          g.moveTo(x + i * 20, y - 48 - Math.abs(i) * 7);
          g.lineTo(x + i * 20 - 9, y - 19);
          g.lineTo(x + i * 20, y - 5);
          g.lineTo(x + i * 20 + 9, y - 19);
          g.closePath();
          g.fill();
        }
      }
      if (site.kind === "ash-archive") {
        g.fillStyle = "#b9886b";
        for (let i = 0; i < 3; i++)
          g.fillRect(x - 28 + i * 4, y + 12 - i * 6, 56 - i * 8, 5);
        g.fillStyle = "#ead3a0";
        g.fillRect(x - 12, y - 35, 24, 18);
        g.strokeStyle = "#a27b55";
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.moveTo(x - 8, y - 31 + i * 5);
          g.lineTo(x + 8, y - 31 + i * 5);
          g.stroke();
        }
      }
      g.font = "12px system-ui";
      g.textAlign = "center";
      g.fillText(found ? "✦ " + site.title : site.title, x, y - 52);
    }
    // The camp beacon stays a strong visual landmark.
    g.fillStyle = "#667b76";
    g.fillRect(-7, -28, 46, 48);
    g.fillStyle = state.restored ? "#e9e1a6" : "#7ab3be";
    g.beginPath();
    g.moveTo(16, -54);
    g.lineTo(29, -32);
    g.lineTo(16, -12);
    g.lineTo(3, -32);
    g.closePath();
    g.fill();
    if (state.restored) {
      g.strokeStyle = "#e9e1a660";
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(16, -54);
      g.lineTo(16, -1000);
      g.stroke();
    }
    for (const e of state.enemies) {
      if (dead.has(e.id) || e.hp <= 0) continue;
      const x = (e.x + 0.5) * TILE,
        y = (e.y + 0.5) * TILE;
      const wind = e.windup || e.attackTimer || 0;
      g.fillStyle = wind > 0 ? "#ffe1a2" : "#c96e63";
      g.save();
      g.translate(x, y + (this.reduced ? 0 : Math.sin(time * 0.004 + e.x) * 2));
      g.rotate(Math.PI / 4);
      g.fillRect(-9, -9, 18, 18);
      g.restore();
      g.fillStyle = "#ffe1b6";
      g.fillRect(x - 6, y - 3, 12, 3);
      if (wind > 0) {
        g.strokeStyle = "#ffb095";
        g.beginPath();
        g.arc(x, y, 26, 0, 7);
        g.stroke();
      }
    }
    const p = state.player,
      x = (p.x + 0.5) * TILE,
      y = (p.y + 0.5) * TILE;
    g.fillStyle = "#122c2980";
    g.beginPath();
    g.ellipse(x, y + 10, 9, 4, 0, 0, 7);
    g.fill();
    g.globalAlpha =
      p.invulnerability > 0 && Math.floor(time / 90) % 2 ? 0.4 : 1;
    g.fillStyle = "#eadfb8";
    g.fillRect(x - 6, y - 14, 12, 10);
    g.fillStyle = "#d69b68";
    g.fillRect(x - 5, y - 4, 10, 11);
    g.fillStyle = "#284744";
    g.fillRect(x - 6, y + 7, 4, 5);
    g.fillRect(x + 2, y + 7, 4, 5);
    g.fillStyle = "#6bbeb8";
    g.fillRect(x - 8, y - 4, 4, 10);
    g.globalAlpha = 1;
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      g.fillStyle = particle.color;
      g.globalAlpha = Math.max(0, particle.life * 2);
      g.fillRect((particle.x + 0.5) * TILE, (particle.y + 0.5) * TILE, 4, 4);
    }
    g.globalAlpha = 1;
    this.particles = this.particles.filter((p) => p.life > 0);
    g.restore();
    const cycle = (state.time % 180) / 180,
      night = Math.max(0, Math.sin((cycle - 0.35) * Math.PI * 2)) * 0.64;
    if (night > 0) {
      g.save();
      g.fillStyle = `rgba(5,15,37,${night})`;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "screen";
      const radius = state.tools.lantern ? 250 : 110,
        glow = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, radius);
      glow.addColorStop(0, "#ffc87135");
      glow.addColorStop(1, "#ffc87100");
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);
      g.restore();
    }
    if (!this.reduced) {
      g.fillStyle = "#d7e8d532";
      for (let i = 0; i < 25; i++) {
        const a = (i * 73 + time * 0.025) % w,
          b = (i * 137 + time * 0.015) % h;
        g.fillRect(a, b, 2, 2);
      }
    }
    if (showMap) {
      g.fillStyle = "#102e2ee8";
      g.fillRect(w - 230, 18, 210, 190);
      g.strokeStyle = "#6e9f8e";
      g.strokeRect(w - 230, 18, 210, 190);
      g.fillStyle = "#d5c593";
      g.font = "12px system-ui";
      g.textAlign = "left";
      g.fillText("ISLAND SURVEY", w - 214, 39);
      const mx = w - 125,
        my = 113,
        scale = 1.8;
      g.fillRect(mx - 3, my - 3, 6, 6);
      for (const s of sites) {
        g.fillStyle = s.color || "#b5dbcb";
        g.beginPath();
        g.arc(mx + s.x * scale, my + s.y * scale, 5, 0, 7);
        g.fill();
      }
      g.fillStyle = "#fff5ce";
      g.beginPath();
      g.arc(mx + state.player.x * scale, my + state.player.y * scale, 3, 0, 7);
      g.fill();
    }
  }
}
