import { useEffect, useRef } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { OrigamiProject } from "./catalog";

type Mode = "folded" | "pattern" | "exploded";
type Props = {
  project: OrigamiProject;
  progress: number;
  mode: Mode;
  selectedSection: string;
  onSelect: (id: string) => void;
};
type Panel = { vertices: T.Vector3[]; section: string; color: string };

const palette = (project: OrigamiProject) => project.palette;
const point = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
const mix = (a: T.Vector3, b: T.Vector3, amount: number) =>
  a.clone().lerp(b, amount);

function addQuad(
  panels: Panel[],
  a: T.Vector3,
  b: T.Vector3,
  c: T.Vector3,
  d: T.Vector3,
  section: string,
  color: string,
) {
  panels.push({ vertices: [a, b, c], section, color });
  panels.push({ vertices: [a.clone(), c.clone(), d], section, color });
}

function gridProject(project: OrigamiProject, progress: number): Panel[] {
  const panels: Panel[] = [],
    colors = palette(project),
    size = 24;
  const rows = project.rows,
    cols = project.columns;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = (col - cols / 2) * size;
      const z = (row - rows / 2) * size;
      const sign = (row + col) % 2 ? -1 : 1;
      const amp = project.id === "hypar-surface" ? 18 : 12;
      const lift = progress * amp * sign;
      const a = point(x, lift, z),
        b = point(x + size, progress * amp * -sign, z),
        c = point(x + size, progress * amp * sign, z + size),
        d = point(x, progress * amp * -sign, z + size);
      const section =
        project.id === "miura-field"
          ? row === 0 && col === 0
            ? "cell"
            : row % 2 === 0
              ? "ridge"
              : "valley"
          : row % 2
            ? "cross"
            : col % 2
              ? "high"
              : "low";
      addQuad(panels, a, b, c, d, section, colors[(row + col) % 2 ? 1 : 2]);
    }
  }
  return panels;
}

function radialProject(project: OrigamiProject, progress: number): Panel[] {
  const panels: Panel[] = [],
    colors = palette(project);
  const count = project.columns,
    radius = project.id === "waterbomb-orbit" ? 72 : 84,
    inner = project.id === "star-lantern" ? 34 : 0;
  for (let i = 0; i < count; i++) {
    const t0 = (i / count) * Math.PI * 2,
      t1 = ((i + 1) / count) * Math.PI * 2,
      wave = project.id === "waterbomb-orbit" ? (i % 2 ? -1 : 1) : 1;
    const z0 = progress * 34 * wave,
      z1 = progress * 34 * -wave;
    const center = point(
      0,
      progress * (project.id === "lotus-radial" ? 20 : 9),
      0,
    );
    const a = point(Math.cos(t0) * inner, 0, Math.sin(t0) * inner);
    const b = point(
      Math.cos(t0) * radius,
      progress * (44 + 12 * wave),
      Math.sin(t0) * radius,
    );
    const c = point(
      Math.cos(t1) * radius,
      progress * (44 + 12 * -wave),
      Math.sin(t1) * radius,
    );
    const d = point(Math.cos(t1) * inner, 0, Math.sin(t1) * inner);
    if (inner)
      addQuad(
        panels,
        a,
        b,
        c,
        d,
        i === 0 ? "core" : i % 2 ? "petal" : "back",
        colors[i % 2 ? 1 : 2],
      );
    else {
      panels.push({
        vertices: [center, b, c],
        section: i === 0 ? "vertex" : i % 2 ? "mountains" : "valleys",
        color: colors[i % 2 ? 1 : 2],
      });
    }
  }
  return panels;
}

function birdProject(project: OrigamiProject, progress: number): Panel[] {
  const panels: Panel[] = [],
    colors = palette(project);
  const center = point(0, progress * 7, 0),
    bodyTop = point(0, progress * 30, -16),
    bodyBottom = point(0, progress * 10, 24);
  addQuad(
    panels,
    point(-20, 0, 0),
    bodyTop,
    point(20, 0, 0),
    bodyBottom,
    "body",
    colors[2],
  );
  const flaps = [
    [point(-20, 0, 0), point(-90, progress * 42, -40), center],
    [point(20, 0, 0), point(90, progress * 42, -40), center],
    [point(-12, 0, 18), point(-54, progress * 17, 82), center],
    [point(12, 0, 18), point(54, progress * 17, 82), center],
  ];
  flaps.forEach((vertices, index) =>
    panels.push({
      vertices,
      section: index < 2 ? "wing" : index === 2 ? "tail" : "head",
      color: colors[index % 2 ? 1 : 2],
    }),
  );
  return panels;
}

function cubeProject(progress: number): Panel[] {
  const panels: Panel[] = [],
    colors = ["#cf775c", "#d98c63", "#3f7775", "#55908a", "#ba8f68", "#e2d3b7"];
  const s = 34;
  const face = (
    center: T.Vector3,
    normal: T.Vector3,
    section: string,
    color: string,
  ) => {
    const u = new T.Vector3(1, 0, 0),
      v = new T.Vector3(0, 0, 1);
    if (Math.abs(normal.x) > 0.5) v.set(0, 1, 0);
    if (Math.abs(normal.y) > 0.5) (u.set(1, 0, 0), v.set(0, 0, 1));
    if (Math.abs(normal.z) > 0.5) (u.set(1, 0, 0), v.set(0, 1, 0));
    const q = (du: number, dv: number) =>
      center.clone().addScaledVector(u, du).addScaledVector(v, dv);
    addQuad(panels, q(-s, -s), q(s, -s), q(s, s), q(-s, s), section, color);
  };
  const flat = [
    [point(-s, 0, 0), "net"],
    [point(s, 0, 0), "hinges"],
    [point(3 * s, 0, 0), "lid"],
    [point(-s, 0, 2 * s), "hinges"],
    [point(-s, 0, -2 * s), "hinges"],
    [point(-s, 0, 4 * s), "layers"],
  ] as const;
  flat.forEach(([position, section], index) => {
    const target = [
      point(0, 0, 0),
      point(s, 0, 0),
      point(0, s * 2, 0),
      point(-s, 0, 0),
      point(0, 0, -s),
      point(0, 0, s),
    ][index];
    const c = mix(position, target, progress);
    const normal = [
      point(0, 1, 0),
      point(1, 0, 0),
      point(0, 1, 0),
      point(-1, 0, 0),
      point(0, 0, -1),
      point(0, 0, 1),
    ][index];
    face(c, normal, section, colors[index]);
  });
  return panels;
}

function towerProject(project: OrigamiProject, progress: number): Panel[] {
  const panels: Panel[] = [],
    colors = palette(project),
    bands = project.rows,
    sides = project.columns;
  for (let band = 0; band < bands; band++) {
    const y = progress * (band - bands / 2) * 25;
    const radius = 52 - band * 3;
    for (let side = 0; side < sides; side++) {
      const a0 = (side / sides) * Math.PI * 2 + progress * band * 0.24;
      const a1 = ((side + 1) / sides) * Math.PI * 2 + progress * band * 0.24;
      const nextY = progress * (band + 1 - bands / 2) * 25;
      const a = point(Math.cos(a0) * radius, y, Math.sin(a0) * radius);
      const b = point(Math.cos(a1) * radius, y, Math.sin(a1) * radius);
      const c = point(
        Math.cos(a1) * (radius - 4),
        nextY,
        Math.sin(a1) * (radius - 4),
      );
      const d = point(
        Math.cos(a0) * (radius - 4),
        nextY,
        Math.sin(a0) * (radius - 4),
      );
      addQuad(
        panels,
        a,
        b,
        c,
        d,
        band === 0
          ? "base"
          : band === bands - 1
            ? "cap"
            : side % 2
              ? "turn"
              : "spine",
        colors[(band + side) % 2 ? 1 : 2],
      );
    }
  }
  return panels;
}

function buildPanels(project: OrigamiProject, progress: number): Panel[] {
  if (project.id === "modular-cube") return cubeProject(progress);
  if (project.id === "bird-base") return birdProject(project, progress);
  if (project.id === "twist-tower") return towerProject(project, progress);
  if (project.family === "radial") return radialProject(project, progress);
  return gridProject(project, progress);
}

export function OrigamiCanvas({
  project,
  progress,
  mode,
  selectedSection,
  onSelect,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const current = useRef({
    project,
    progress,
    mode,
    selectedSection,
    onSelect,
  });
  current.current = { project, progress, mode, selectedSection, onSelect };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });
    } catch {
      host.dataset.error = "graphics";
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.setAttribute("data-testid", "origami-canvas");
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive folded paper model",
    );
    host.appendChild(renderer.domElement);
    const scene = new T.Scene();
    const group = new T.Group();
    scene.add(group);
    scene.add(new T.HemisphereLight(0xfff4e7, 0x263347, 2.2));
    const key = new T.DirectionalLight(0xffe6c6, 3.4);
    key.position.set(-140, 220, 170);
    scene.add(key);
    const fill = new T.DirectionalLight(0xaad5ff, 1.5);
    fill.position.set(180, 100, -220);
    scene.add(fill);
    const camera = new T.PerspectiveCamera(34, 1, 0.1, 2000);
    camera.position.set(170, 150, 230);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 90;
    controls.maxDistance = 800;
    controls.target.set(0, 0, 0);
    const raycaster = new T.Raycaster(),
      pointer = new T.Vector2();
    let lastKey = "",
      frame = 0,
      disposed = false;
    const fit = () => {
      const box = new T.Box3().setFromObject(group),
        size = box.getSize(new T.Vector3()),
        center = box.getCenter(new T.Vector3());
      const span = Math.max(size.x, size.y, size.z, 80);
      camera.position.copy(
        center
          .clone()
          .add(new T.Vector3(span * 1.35, span * 0.95, span * 1.65)),
      );
      controls.target.copy(center);
      camera.near = Math.max(0.1, span / 100);
      camera.far = span * 20;
      camera.updateProjectionMatrix();
      controls.update();
    };
    const rebuild = () => {
      const p = current.current,
        signature = `${p.project.id}|${p.progress.toFixed(3)}|${p.mode}|${p.selectedSection}`;
      if (signature === lastKey) return;
      lastKey = signature;
      group.clear();
      const fold = p.mode === "pattern" ? 0 : p.progress;
      const panels = buildPanels(p.project, fold);
      panels.forEach((panel, index) => {
        const geometry = new T.BufferGeometry();
        geometry.setAttribute(
          "position",
          new T.Float32BufferAttribute(
            panel.vertices.flatMap((v) => [v.x, v.y, v.z]),
            3,
          ),
        );
        geometry.computeVertexNormals();
        const active = p.selectedSection === panel.section;
        const material = new T.MeshStandardMaterial({
          color: active ? "#f4c96d" : panel.color,
          side: T.DoubleSide,
          roughness: 0.6,
          metalness: 0.02,
          transparent: true,
          opacity: active ? 1 : 0.93,
        });
        const mesh = new T.Mesh(geometry, material);
        mesh.userData.section = panel.section;
        if (p.mode === "exploded") mesh.position.y += ((index % 4) - 1.5) * 8;
        group.add(mesh);
        const lineGeometry = new T.BufferGeometry().setFromPoints([
          ...panel.vertices,
          panel.vertices[0],
        ]);
        const line = new T.Line(
          lineGeometry,
          new T.LineBasicMaterial({
            color: active ? "#fff2be" : "#302c42",
            transparent: true,
            opacity: active ? 0.95 : 0.55,
          }),
        );
        line.userData.section = panel.section;
        group.add(line);
      });
      fit();
      host.dataset.facets = String(panels.length);
      host.dataset.progress = String(p.progress);
      host.dataset.mode = p.mode;
      host.dataset.selected = p.selectedSection;
      host.dataset.rendered = "true";
    };
    const draw = () => {
      if (disposed) return;
      rebuild();
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(draw);
    };
    const resize = () => {
      const width = Math.max(1, host.clientWidth),
        height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const select = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster
        .intersectObjects(group.children, false)
        .find((item) => item.object.userData.section);
      if (hit) current.current.onSelect(String(hit.object.userData.section));
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Home") {
        event.preventDefault();
        fit();
      }
    };
    renderer.domElement.addEventListener("pointerup", select);
    renderer.domElement.addEventListener("keydown", keydown);
    frame = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerup", select);
      renderer.domElement.removeEventListener("keydown", keydown);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="origami-canvas" tabIndex={0} />;
}

export type { Mode as OrigamiViewMode };
