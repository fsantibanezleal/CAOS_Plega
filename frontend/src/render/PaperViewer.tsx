import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Scene as PaperScene, Project, Cutwork } from "../core/types";
import { editMechanism, type DirectField } from "../core/directEdit";
import { vAxes } from "../core/math";
import "./PaperViewer.css";

type Props = {
  scene: PaperScene | null;
  height: number;
  width: number;
  selected: string;
  onSelect: (id: string) => void;
  theme: "light" | "dark";
  lang: "en" | "es";
  camera: "perspective" | "top" | "front";
  reset: number;
  dimensions: boolean;
  framing: "sculpture" | "card";
  project: Project;
  editable: boolean;
  onPreview: (project: Project | null) => void;
  onCommit: (project: Project) => void;
  onAdd: (kind: "P" | "V") => void;
  onRemove: () => void;
  onProfile: (pattern: Cutwork["pattern"] | "solid") => void;
};
type Runtime = {
  renderer: T.WebGLRenderer;
  scene: T.Scene;
  group: T.Group;
  camera: T.PerspectiveCamera;
  controls: OrbitControls;
  draw: () => void;
  fit: (preset: Props["camera"]) => void;
};

type Handle = {
  field: DirectField;
  label: [string, string];
  position: T.Vector3;
  axis: T.Vector3;
  offset: [number, number];
};
type EditGesture = {
  kind: "pointer" | "keyboard";
  field: DirectField;
  moduleId: string;
  start: Project;
  next: Project;
  startValue: number;
  pointerId?: number;
  element?: HTMLButtonElement;
  x: number;
  y: number;
  axisX: number;
  axisY: number;
};
const editKeys = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "+",
  "=",
  "-",
];
function fieldValue(project: Project, id: string, field: DirectField): number {
  const part = project.modules.find((m) => m.id === id);
  return part
    ? field === "y"
      ? part.y
      : ((part.params as unknown as Record<string, number>)[field] ?? 0)
    : 0;
}
/** Handle points use the same folded coordinates as the production renderer.
 * A drag projects that physical parameter axis into the current camera view. */
function partHandles(project: Project, id: string, opening: number): Handle[] {
  const part = project.modules.find((m) => m.id === id);
  if (!part) return [];
  const origin = new T.Vector3(0, 0, project.card.H / 2 - part.y);
  const along = new T.Vector3(0, 0, -1);
  if (part.kind === "P") {
    const q = (opening * Math.PI) / 360,
      a = part.params.a,
      b = part.params.b,
      w = part.params.width;
    const left = new T.Vector3(-Math.sin(q), Math.cos(q), 0);
    const right = new T.Vector3(Math.sin(q), Math.cos(q), 0);
    const at = (x: number, y: number, z: number) =>
      origin
        .clone()
        .addScaledVector(left, x)
        .addScaledVector(right, y)
        .addScaledVector(along, z);
    return [
      {
        field: "y",
        label: ["Move", "Mover"],
        position: at(a, b, 0),
        axis: along,
        offset: [-48, 35],
      },
      {
        field: "a",
        label: ["Rise", "Altura"],
        position: at(a, b * 0.45, w / 2),
        axis: left,
        offset: [-45, -35],
      },
      {
        field: "b",
        label: ["Depth", "Fondo"],
        position: at(a * 0.45, b, w / 2),
        axis: right,
        offset: [45, -35],
      },
      {
        field: "width",
        label: ["Width", "Ancho"],
        position: at(a, b, w),
        axis: along,
        offset: [48, 35],
      },
    ];
  }
  const axes = vAxes(part, opening);
  const world = (v: readonly number[]) => new T.Vector3(v[0], v[2], -v[1]);
  const wing = world(axes.right),
    ridge = world(axes.ridge);
  return [
    {
      field: "y",
      label: ["Move", "Mover"],
      position: origin,
      axis: along,
      offset: [-48, 32],
    },
    {
      field: "r",
      label: ["Wing", "Ala"],
      position: origin.clone().addScaledVector(wing, part.params.r),
      axis: wing,
      offset: [45, -24],
    },
    {
      field: "h",
      label: ["Ridge", "Cresta"],
      position: origin.clone().addScaledVector(ridge, part.params.h),
      axis: ridge,
      offset: [-28, -36],
    },
  ];
}

export function PaperViewer(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    runtime = useRef<Runtime | null>(null),
    current = useRef(props);
  current.current = props;
  const [failed, setFailed] = useState(false);
  const [frameMode, setFrameMode] = useState<
    "selected" | "composition" | "card"
  >(() =>
    matchMedia("(max-width: 620px)").matches ? "selected" : "composition",
  );
  const framingMode = useRef(frameMode);
  framingMode.current = frameMode;
  const previousFraming = useRef(props.framing);
  const [editMessage, setEditMessage] = useState("");
  const [activeField, setActiveField] = useState<DirectField | null>(null);
  const gesture = useRef<EditGesture | null>(null);
  const pendingMove = useRef<{ x: number; y: number } | null>(null);
  const moveFrame = useRef(0);
  const buttons = useRef(new Map<DirectField, HTMLButtonElement>());
  const guides = useRef(new Map<DirectField, SVGLineElement>());
  const anchors = useRef(new Map<DirectField, SVGCircleElement>());
  const paintHandles = useRef<() => void>(() => {});
  const say = (en: string, es: string) => (props.lang === "es" ? es : en);
  const selectedPart = props.project.modules.find(
    (m) => m.id === props.selected,
  );
  const handles = partHandles(
    props.project,
    props.selected,
    props.scene?.openingDeg ?? 90,
  );
  const projectPoint = (position: T.Vector3) => {
    const r = runtime.current,
      element = host.current;
    if (!r || !element) return { x: 0, y: 0, z: 2 };
    const v = position.clone().project(r.camera);
    return {
      x: ((v.x + 1) * element.clientWidth) / 2,
      y: ((1 - v.y) * element.clientHeight) / 2,
      z: v.z,
    };
  };
  paintHandles.current = () => {
    const p = current.current,
      element = host.current;
    if (!element) return;
    const shown = gesture.current?.next ?? p.project;
    const definitions = partHandles(
      shown,
      p.selected,
      p.scene?.openingDeg ?? 90,
    );
    type Box = { left: number; top: number; right: number; bottom: number };
    const hostBox = element.getBoundingClientRect();
    const occupied: Box[] = [];
    const gap = element.clientHeight < 180 ? 2 : 4;
    for (const node of [
      element.querySelector(".paper-canvas-editor"),
      element.querySelector(".paper-edit-feedback.is-visible"),
      element.closest(".stage")?.querySelector(".camera-tools"),
    ]) {
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      occupied.push({
        left: rect.left - hostBox.left - gap,
        top: rect.top - hostBox.top - gap,
        right: rect.right - hostBox.left + gap,
        bottom: rect.bottom - hostBox.top + gap,
      });
    }
    const overlaps = (a: Box, b: Box) =>
      a.left < b.right &&
      a.right > b.left &&
      a.top < b.bottom &&
      a.bottom > b.top;
    for (const h of definitions) {
      const button = buttons.current.get(h.field),
        line = guides.current.get(h.field),
        dot = anchors.current.get(h.field);
      if (!button || !line || !dot) continue;
      const point = projectPoint(h.position);
      const visible = p.editable && point.z >= -1 && point.z <= 1;
      button.style.visibility =
        line.style.visibility =
        dot.style.visibility =
          visible ? "visible" : "hidden";
      if (!visible) continue;
      const halfWidth = button.offsetWidth / 2,
        halfHeight = button.offsetHeight / 2;
      const minX = halfWidth + 6,
        maxX = element.clientWidth - halfWidth - 6;
      const minY = halfHeight + 6,
        maxY = Math.max(minY, element.clientHeight - 6 - halfHeight);
      const desiredX = Math.max(minX, Math.min(maxX, point.x + h.offset[0]));
      const desiredY = Math.max(minY, Math.min(maxY, point.y + h.offset[1]));
      const xs = new Set([minX, maxX, desiredX]),
        ys = new Set([minY, maxY, desiredY]);
      for (let x = minX; x <= maxX; x += 28) xs.add(x);
      for (let y = minY; y <= maxY; y += 18) ys.add(y);
      for (const box of occupied) {
        xs.add(Math.max(minX, Math.min(maxX, box.left - halfWidth - gap)));
        xs.add(Math.max(minX, Math.min(maxX, box.right + halfWidth + gap)));
        ys.add(Math.max(minY, Math.min(maxY, box.top - halfHeight - gap)));
        ys.add(Math.max(minY, Math.min(maxY, box.bottom + halfHeight + gap)));
      }
      const candidates = [...ys].flatMap((y) => [...xs].map((x) => ({ x, y })));
      const rectangle = (x: number, y: number): Box => ({
        left: x - halfWidth - gap,
        right: x + halfWidth + gap,
        top: y - halfHeight - gap,
        bottom: y + halfHeight + gap,
      });
      const ranked = candidates
        .map((c) => ({
          ...c,
          box: rectangle(c.x, c.y),
          distance: (c.x - desiredX) ** 2 + (c.y - desiredY) ** 2,
        }))
        .sort((a, b) => a.distance - b.distance);
      const chosen =
        ranked.find((c) => occupied.every((box) => !overlaps(c.box, box))) ??
        ranked[0];
      const { x, y } = chosen;
      occupied.push(chosen.box);
      button.style.left = x + "px";
      button.style.top = y + "px";
      const projectedAxis = projectPoint(h.position.clone().add(h.axis));
      const axisX = projectedAxis.x - point.x,
        axisY = projectedAxis.y - point.y;
      button.dataset.axisX = axisX.toFixed(4);
      button.dataset.axisY = axisY.toFixed(4);
      const directionMark = button.firstElementChild as HTMLElement | null;
      if (directionMark && button.getAttribute("aria-disabled") !== "true")
        directionMark.style.transform = `rotate(${(Math.atan2(axisY, axisX) * 180) / Math.PI - 90}deg)`;
      const value = fieldValue(shown, p.selected, h.field);
      button.dataset.value = value.toFixed(3);
      button.setAttribute(
        "aria-label",
        `${p.lang === "es" ? "Ajustar" : "Adjust"} ${h.label[p.lang === "es" ? 1 : 0]}: ${value.toFixed(1)} mm`,
      );
      const output = button.querySelector("output");
      if (output) output.textContent = value.toFixed(1);
      line.setAttribute("x1", String(point.x));
      line.setAttribute("y1", String(point.y));
      line.setAttribute("x2", String(x));
      line.setAttribute("y2", String(y));
      dot.setAttribute("cx", String(point.x));
      dot.setAttribute("cy", String(point.y));
    }
  };
  const announceLimit = (reason?: "pinned" | "geometry" | "unavailable") => {
    setEditMessage(
      reason === "pinned"
        ? say("This dimension is pinned.", "Esta medida está fijada.")
        : reason === "geometry"
          ? say(
              "At the safe fit limit. Keep dragging back to adjust.",
              "Límite de ajuste seguro. Arrastra hacia atrás para ajustar.",
            )
          : reason === "unavailable"
            ? say(
                "Resolve the geometry check before editing on canvas.",
                "Resuelve la comprobación antes de editar en el lienzo.",
              )
            : "",
    );
  };
  const previewValue = (requested: number) => {
    const g = gesture.current;
    if (!g) return;
    const result = editMechanism(g.start, g.moduleId, g.field, requested);
    g.next = result.project;
    announceLimit(result.reason);
    current.current.onPreview(result.project);
    runtime.current?.draw();
  };
  const applyPointer = (x: number, y: number) => {
    const g = gesture.current;
    if (!g || g.kind !== "pointer") return;
    const denominator = g.axisX * g.axisX + g.axisY * g.axisY;
    previewValue(
      g.startValue + ((x - g.x) * g.axisX + (y - g.y) * g.axisY) / denominator,
    );
  };
  const finishEdit = (commit: boolean) => {
    const g = gesture.current;
    if (!g) return;
    cancelAnimationFrame(moveFrame.current);
    moveFrame.current = 0;
    if (commit && pendingMove.current && g.kind === "pointer")
      applyPointer(pendingMove.current.x, pendingMove.current.y);
    pendingMove.current = null;
    gesture.current = null;
    if (runtime.current) runtime.current.controls.enabled = true;
    if (
      g.element &&
      g.pointerId !== undefined &&
      g.element.hasPointerCapture(g.pointerId)
    )
      g.element.releasePointerCapture(g.pointerId);
    if (
      commit &&
      Math.abs(fieldValue(g.next, g.moduleId, g.field) - g.startValue) > 1e-6
    )
      current.current.onCommit(g.next);
    current.current.onPreview(null);
    setActiveField(null);
    if (host.current) delete host.current.dataset.editing;
    if (!commit) setEditMessage(say("Edit cancelled.", "Edición cancelada."));
    runtime.current?.draw();
  };
  const beginPointer = (
    field: DirectField,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (
      !current.current.editable ||
      gesture.current ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    const part = current.current.project.modules.find(
      (m) => m.id === current.current.selected,
    );
    if (!part || (part.pins as readonly string[]).includes(field)) {
      announceLimit("pinned");
      return;
    }
    const h = partHandles(
      current.current.project,
      part.id,
      current.current.scene?.openingDeg ?? 90,
    ).find((h) => h.field === field)!;
    const point = projectPoint(h.position),
      end = projectPoint(h.position.clone().add(h.axis));
    let axisX = end.x - point.x,
      axisY = end.y - point.y;
    if (Math.hypot(axisX, axisY) < 0.15) {
      axisX = 0;
      axisY = -1.5;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      kind: "pointer",
      field,
      moduleId: part.id,
      start: current.current.project,
      next: current.current.project,
      startValue: fieldValue(current.current.project, part.id, field),
      pointerId: event.pointerId,
      element: event.currentTarget,
      x: event.clientX,
      y: event.clientY,
      axisX,
      axisY,
    };
    if (runtime.current) runtime.current.controls.enabled = false;
    if (host.current) host.current.dataset.editing = field;
    setActiveField(field);
    setEditMessage("");
  };
  const movePointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (
      gesture.current?.kind !== "pointer" ||
      gesture.current.pointerId !== event.pointerId
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    pendingMove.current = { x: event.clientX, y: event.clientY };
    if (!moveFrame.current)
      moveFrame.current = requestAnimationFrame(() => {
        moveFrame.current = 0;
        const point = pendingMove.current;
        pendingMove.current = null;
        if (point) applyPointer(point.x, point.y);
      });
  };
  const handleKey = (
    field: DirectField,
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      finishEdit(false);
      return;
    }
    if (!editKeys.includes(event.key) || !current.current.editable) return;
    event.preventDefault();
    event.stopPropagation();
    const p = current.current,
      part = p.project.modules.find((m) => m.id === p.selected);
    if (!part || (part.pins as readonly string[]).includes(field)) {
      announceLimit("pinned");
      return;
    }
    if (
      gesture.current &&
      (gesture.current.kind !== "keyboard" || gesture.current.field !== field)
    )
      return;
    if (!gesture.current) {
      gesture.current = {
        kind: "keyboard",
        field,
        moduleId: part.id,
        start: p.project,
        next: p.project,
        startValue: fieldValue(p.project, part.id, field),
        x: 0,
        y: 0,
        axisX: 0,
        axisY: 1,
      };
      setActiveField(field);
    }
    const g = gesture.current;
    const sign = ["ArrowLeft", "ArrowDown", "-"].includes(event.key) ? -1 : 1;
    previewValue(
      fieldValue(g.next, g.moduleId, field) +
        sign * (event.shiftKey ? 5 : event.altKey ? 0.1 : 1),
    );
  };
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && gesture.current) {
        event.preventDefault();
        finishEdit(false);
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
      cancelAnimationFrame(moveFrame.current);
    };
  }, []);
  useEffect(() => {
    if (!props.editable && gesture.current) finishEdit(false);
  }, [props.editable]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute("role", "img");
    element.appendChild(renderer.domElement);
    const scene = new T.Scene(),
      group = new T.Group(),
      camera = new T.PerspectiveCamera(36, 1, 0.1, 20000);
    scene.add(group);
    scene.add(new T.HemisphereLight(0xffffff, 0x79728d, 2.1));
    const light = new T.DirectionalLight(0xfff1dd, 3.2);
    light.position.set(-200, 360, 180);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.left = -350;
    light.shadow.camera.right = 350;
    light.shadow.camera.top = 350;
    light.shadow.camera.bottom = -350;
    light.shadow.camera.far = 1300;
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.3;
    scene.add(light);
    const fill = new T.DirectionalLight(0xc6ccff, 1.3);
    fill.position.set(180, 140, -240);
    scene.add(fill);
    const ground = new T.Mesh(
      new T.PlaneGeometry(5000, 5000),
      new T.ShadowMaterial({ opacity: 0.13 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    ground.receiveShadow = true;
    scene.add(ground);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.minDistance = 30;
    controls.maxDistance = 12000;
    controls.maxPolarAngle = Math.PI * 0.89;
    controls.screenSpacePanning = true;
    let contextLost = false;
    let frame = 0,
      disposed = false;
    const draw = () => {
      if (disposed || contextLost || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (disposed || contextLost) return;
        renderer.render(scene, camera);
        paintHandles.current();
        element.dataset.rendered = String(group.children.length > 0);
        element.dataset.triangles = String(renderer.info.render.triangles);
      });
    };
    const fit = (preset: Props["camera"]) => {
      const p = current.current,
        moving =
          p.scene?.panels
            .filter(
              (panel) =>
                panel.role === "moving" &&
                (framingMode.current !== "selected" ||
                  panel.moduleId === p.selected),
            )
            .flatMap((panel) => panel.vertices) ?? [],
        bounds =
          framingMode.current !== "card" && moving.length
            ? {
                min: [0, 1, 2].map((axis) =>
                  Math.min(...moving.map((v) => v[axis])),
                ),
                max: [0, 1, 2].map((axis) =>
                  Math.max(...moving.map((v) => v[axis])),
                ),
              }
            : p.scene?.bounds,
        span = Math.max(
          p.width * 2,
          p.height,
          90,
          ...(bounds ? bounds.max.map((v, i) => v - bounds.min[i]) : []),
        ),
        target = bounds
          ? new T.Vector3(
              (bounds.min[0] + bounds.max[0]) / 2,
              (bounds.min[2] + bounds.max[2]) / 2,
              p.height / 2 - (bounds.min[1] + bounds.max[1]) / 2,
            )
          : new T.Vector3(0, span * 0.12, 0);
      const direction = (
        preset === "top"
          ? new T.Vector3(0, 1, 0.001)
          : preset === "front"
            ? new T.Vector3(0, 0.28, 1)
            : new T.Vector3(0.7, 1.15, 0.85)
      ).normalize();
      const right = new T.Vector3()
        .crossVectors(camera.up, direction)
        .normalize();
      const up = new T.Vector3().crossVectors(direction, right).normalize();
      const viewportWidth = element.clientWidth,
        viewportHeight = element.clientHeight;
      const editorHeight =
        element.querySelector(".paper-canvas-editor")?.getBoundingClientRect()
          .height ?? 0;
      const topSpace = p.editable ? editorHeight + 12 : 8;
      const bottomSpace = p.editable ? 48 : 8;
      const leftSpace = p.editable ? 35 : 10,
        rightSpace = p.editable ? 55 : 45;
      const usableHeight = Math.max(
        50,
        viewportHeight - topSpace - bottomSpace,
      );
      const usableWidth = Math.max(80, viewportWidth - leftSpace - rightSpace);
      const tanY =
          (Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * usableHeight) /
          viewportHeight,
        tanX =
          (Math.tan(T.MathUtils.degToRad(camera.fov / 2)) *
            camera.aspect *
            usableWidth) /
          viewportWidth;
      camera.setViewOffset(
        viewportWidth,
        viewportHeight,
        (rightSpace - leftSpace) / 2,
        (bottomSpace - topSpace) / 2,
        viewportWidth,
        viewportHeight,
      );
      const corners = bounds
        ? [bounds.min[0], bounds.max[0]].flatMap((x) =>
            [bounds.min[1], bounds.max[1]].flatMap((y) =>
              [bounds.min[2], bounds.max[2]].map((z) =>
                new T.Vector3(x, z, p.height / 2 - y).sub(target),
              ),
            ),
          )
        : [new T.Vector3(span / 2, span / 2, 0)];
      const distance = Math.max(
        60,
        ...corners.map(
          (v) =>
            v.dot(direction) +
            1.18 *
              Math.max(
                Math.abs(v.dot(right)) / tanX,
                Math.abs(v.dot(up)) / tanY,
              ),
        ),
      );
      camera.position
        .copy(target)
        .add(direction.normalize().multiplyScalar(distance));
      controls.target.copy(target);
      controls.update();
      element.dataset.framing = framingMode.current;
      element.dataset.cameraDistance = distance.toFixed(3);
      draw();
    };
    runtime.current = { renderer, scene, group, camera, controls, draw, fit };
    const resize = () => {
      const w = element.clientWidth,
        h = element.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      fit(current.current.camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    fit(current.current.camera);
    controls.addEventListener("change", draw);
    const ray = new T.Raycaster(),
      pointer = new T.Vector2();
    let down: { x: number; y: number } | null = null;
    const pick = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((event.clientY - rect.top) / rect.height) * 2,
      );
      ray.setFromCamera(pointer, camera);
      return ray
        .intersectObjects(group.children)
        .find((hit) => hit.object instanceof T.Mesh)?.object.userData
        .moduleId as string | undefined;
    };
    const pointerDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY };
    };
    const pointerUp = (event: PointerEvent) => {
      if (
        down &&
        Math.hypot(event.clientX - down.x, event.clientY - down.y) < 6
      ) {
        const id = pick(event);
        if (id) current.current.onSelect(id);
      }
      down = null;
    };
    const pointerMove = (event: PointerEvent) => {
      renderer.domElement.style.cursor = pick(event) ? "pointer" : "grab";
    };
    const keyDown = (event: KeyboardEvent) => {
      const key = event.key;
      if (
        ![
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "+",
          "=",
          "-",
          "r",
          "R",
        ].includes(key)
      )
        return;
      event.preventDefault();
      if (key.toLowerCase() === "r") {
        fit(current.current.camera);
        return;
      }
      const offset = camera.position.clone().sub(controls.target),
        spherical = new T.Spherical().setFromVector3(offset);
      if (key === "ArrowLeft") spherical.theta -= 0.12;
      if (key === "ArrowRight") spherical.theta += 0.12;
      if (key === "ArrowUp") spherical.phi -= 0.1;
      if (key === "ArrowDown") spherical.phi += 0.1;
      if (key === "+" || key === "=") spherical.radius *= 0.9;
      if (key === "-") spherical.radius *= 1.1;
      spherical.makeSafe();
      camera.position
        .copy(controls.target)
        .add(new T.Vector3().setFromSpherical(spherical));
      controls.update();
      draw();
    };
    const lost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      setFailed(true);
      element.dataset.rendered = "false";
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("keydown", keyDown);
    renderer.domElement.addEventListener("webglcontextlost", lost);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      group.traverse((object) => {
        if (object instanceof T.Mesh || object instanceof T.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      ground.geometry.dispose();
      (ground.material as T.Material).dispose();
      light.shadow.map?.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      runtime.current = null;
    };
  }, []);
  useEffect(() => {
    const r = runtime.current;
    if (!r) return;
    for (const item of [...r.group.children]) {
      r.group.remove(item);
      if (item instanceof T.Mesh || item instanceof T.Line) {
        item.geometry.dispose();
        const materials = Array.isArray(item.material)
          ? item.material
          : [item.material];
        materials.forEach((material) => material.dispose());
      }
    }
    if (!props.scene) {
      r.draw();
      return;
    }
    const position = (p: readonly number[]) => [
      p[0],
      p[2],
      -(p[1] - props.height / 2),
    ];
    for (const panel of props.scene.panels) {
      const geometry = new T.BufferGeometry();
      geometry.setAttribute(
        "position",
        new T.Float32BufferAttribute(panel.vertices.flatMap(position), 3),
      );
      geometry.setIndex(panel.triangles.flatMap((tri) => [...tri]));
      geometry.computeVertexNormals();
      const material = new T.MeshStandardMaterial({
        color: panel.color,
        side: T.DoubleSide,
        roughness: 0.94,
        metalness: 0,
        emissive: panel.moduleId === props.selected ? panel.color : "#000000",
        emissiveIntensity: panel.moduleId === props.selected ? 0.065 : 0,
      });
      const mesh = new T.Mesh(geometry, material);
      mesh.userData = { moduleId: panel.moduleId, faceId: panel.id };
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      r.group.add(mesh);
    }
    for (const edge of props.scene.edges) {
      const geometry = new T.BufferGeometry().setFromPoints(
        edge.endpoints.map(
          (point) =>
            new T.Vector3(...(position(point) as [number, number, number])),
        ),
      );
      const selected = edge.moduleId === props.selected;
      const material = new T.LineBasicMaterial({
        color: selected
          ? "#352a55"
          : props.theme === "dark"
            ? "#b4afc2"
            : "#696277",
        transparent: true,
        opacity: selected ? 0.85 : 0.36,
        depthTest: true,
      });
      const line = new T.Line(geometry, material);
      line.renderOrder = 2;
      r.group.add(line);
    }
    r.renderer.domElement.setAttribute(
      "aria-label",
      props.lang === "es"
        ? "Modelo de papel. Flechas para orbitar, más o menos para ampliar, R para encuadrar. Selecciona piezas en la lista."
        : "Paper model. Arrow keys orbit, plus or minus zoom, R reframes. Select parts in the list.",
    );
    r.draw();
  }, [props.scene, props.height, props.selected, props.theme, props.lang]);
  useEffect(() => {
    if (previousFraming.current !== props.framing) {
      previousFraming.current = props.framing;
      setFrameMode(props.framing === "card" ? "card" : "composition");
    }
  }, [props.framing]);
  useEffect(() => {
    if (matchMedia("(max-width: 620px)").matches && props.editable)
      setFrameMode("selected");
  }, [props.selected]);
  useEffect(() => {
    runtime.current?.fit(props.camera);
  }, [
    props.camera,
    props.reset,
    props.width,
    props.height,
    frameMode,
    props.selected,
    props.editable,
  ]);
  return (
    <div className="paper-viewer" ref={host} data-rendered="false">
      {props.scene && !failed && props.editable && (
        <>
          <div
            className="paper-canvas-editor"
            aria-label={say(
              "Edit sculpture on canvas",
              "Editar escultura en el lienzo",
            )}
          >
            <div className="paper-canvas-selection">
              <strong>
                {selectedPart?.label ??
                  say("Select a part", "Selecciona una pieza")}
              </strong>
              <span>
                {say(
                  "Drag handles · arrows adjust",
                  "Arrastra tiradores · ajusta con flechas",
                )}
              </span>
            </div>
            <div
              className="paper-canvas-framing"
              aria-label={say("Frame the work", "Encuadrar el trabajo")}
            >
              {(["selected", "composition", "card"] as const).map((mode) => (
                <button
                  key={mode}
                  aria-pressed={frameMode === mode}
                  onClick={() => {
                    setFrameMode(mode);
                    framingMode.current = mode;
                    runtime.current?.fit(props.camera);
                  }}
                >
                  {mode === "selected"
                    ? say("Selected part", "Pieza elegida")
                    : mode === "composition"
                      ? say("All parts", "Todas las piezas")
                      : say("Whole card", "Tarjeta completa")}
                </button>
              ))}
            </div>
            <div className="paper-canvas-actions">
              <details className="paper-canvas-add">
                <summary>{say("+ Add", "+ Añadir")}</summary>
                <div>
                  <button
                    onClick={(e) => {
                      props.onAdd("P");
                      e.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                    }}
                  >
                    {say("Step structure", "Estructura escalonada")}
                  </button>
                  <button
                    onClick={(e) => {
                      props.onAdd("V");
                      e.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                    }}
                  >
                    {say("V-fold structure", "Estructura en V")}
                  </button>
                </div>
              </details>
              {selectedPart && (
                <>
                  <select
                    aria-label={say(
                      "Selected part profile",
                      "Perfil de la pieza seleccionada",
                    )}
                    value={selectedPart.cutwork?.pattern ?? "solid"}
                    onChange={(e) =>
                      props.onProfile(
                        e.target.value as Cutwork["pattern"] | "solid",
                      )
                    }
                  >
                    <option value="solid">{say("Solid", "Sólido")}</option>
                    <option value="arcade">{say("Arcade", "Arcada")}</option>
                    <option value="leaf">{say("Leaf", "Hoja")}</option>
                    <option value="wing">{say("Wing", "Ala")}</option>
                    <option value="lattice">{say("Lattice", "Celosía")}</option>
                  </select>
                  <button
                    className="paper-canvas-remove"
                    onClick={props.onRemove}
                    aria-label={say(
                      "Remove selected part",
                      "Eliminar pieza seleccionada",
                    )}
                  >
                    {say("Remove", "Eliminar")}
                  </button>
                </>
              )}
            </div>
          </div>
          <svg className="paper-handle-guides" aria-hidden="true">
            {handles.map((h) => (
              <g key={h.field}>
                <line
                  ref={(e) => {
                    if (e) guides.current.set(h.field, e);
                    else guides.current.delete(h.field);
                  }}
                />
                <circle
                  r="3.5"
                  ref={(e) => {
                    if (e) anchors.current.set(h.field, e);
                    else anchors.current.delete(h.field);
                  }}
                />
              </g>
            ))}
          </svg>
          {handles.map((h) => {
            const pinned = (
              selectedPart?.pins as readonly string[] | undefined
            )?.includes(h.field);
            return (
              <button
                key={h.field}
                ref={(e) => {
                  if (e) buttons.current.set(h.field, e);
                  else buttons.current.delete(h.field);
                }}
                className={
                  "paper-edit-handle" +
                  (activeField === h.field ? " is-dragging" : "") +
                  (pinned ? " is-pinned" : "")
                }
                data-field={h.field}
                aria-label={
                  say("Adjust ", "Ajustar ") +
                  h.label[props.lang === "es" ? 1 : 0]
                }
                aria-disabled={pinned}
                aria-describedby="paper-edit-instructions"
                onPointerDown={(e) => beginPointer(h.field, e)}
                onPointerMove={movePointer}
                onPointerUp={(e) => {
                  if (gesture.current?.pointerId === e.pointerId) {
                    pendingMove.current = { x: e.clientX, y: e.clientY };
                    finishEdit(true);
                  }
                }}
                onPointerCancel={() => finishEdit(false)}
                onLostPointerCapture={() => {
                  if (gesture.current?.kind === "pointer") finishEdit(false);
                }}
                onKeyDown={(e) => handleKey(h.field, e)}
                onKeyUp={(e) => {
                  if (
                    editKeys.includes(e.key) &&
                    gesture.current?.kind === "keyboard"
                  ) {
                    e.preventDefault();
                    e.stopPropagation();
                    finishEdit(true);
                  }
                }}
                onBlur={() => {
                  if (gesture.current?.kind === "keyboard") finishEdit(true);
                }}
              >
                <span aria-hidden="true">{pinned ? "\u25c7" : "\u2195"}</span>
                <span>
                  {h.label[props.lang === "es" ? 1 : 0]}{" "}
                  <output>
                    {fieldValue(props.project, props.selected, h.field).toFixed(
                      1,
                    )}
                  </output>
                </span>
              </button>
            );
          })}
          <p id="paper-edit-instructions" className="paper-edit-sr">
            {say(
              "Drag a handle to reshape the selected part. Arrow keys adjust one millimetre; Shift adjusts five, Alt one tenth. Release to keep the edit. Escape cancels. Pinned dimensions stay fixed.",
              "Arrastra un tirador para transformar la pieza. Las flechas ajustan un milímetro; Mayús cinco, Alt una décima. Suelta para conservar. Escape cancela. Las medidas fijadas no cambian.",
            )}
          </p>
          <div
            className={
              "paper-edit-feedback" + (editMessage ? " is-visible" : "")
            }
            role="status"
            aria-live="polite"
          >
            {editMessage}
          </div>
        </>
      )}
      {failed && (
        <div className="viewer-fallback" role="alert">
          <strong>
            {props.lang === "es"
              ? "La vista 3D no está disponible"
              : "The 3D view is unavailable"}
          </strong>
          <p>
            {props.lang === "es"
              ? "Continúa con el patrón, las medidas, las comprobaciones y las hojas de montaje."
              : "Continue with the pattern, dimensions, checks and assembly sheets."}
          </p>
        </div>
      )}
      {!props.scene && !failed && (
        <div className="viewer-fallback">
          <strong>
            {props.lang === "es"
              ? "Revisa la geometría indicada"
              : "Review the highlighted geometry"}
          </strong>
          <p>
            {props.lang === "es"
              ? "El patrón conserva tus medidas. Las comprobaciones explican qué necesita una corrección."
              : "The pattern retains your dimensions. Checks explain what needs a correction."}
          </p>
        </div>
      )}
      {props.scene && props.dimensions && (
        <div
          className="scene-measure"
          aria-label={
            props.lang === "es"
              ? "Dimensiones de la tarjeta"
              : "Card dimensions"
          }
        >
          <span>
            {props.width * 2} × {props.height} mm
          </span>
          <small>{props.lang === "es" ? "pliego abierto" : "open blank"}</small>
        </div>
      )}
    </div>
  );
}
