import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Scene as PaperScene } from "../core/types";

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

export function PaperViewer(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    runtime = useRef<Runtime | null>(null),
    current = useRef(props);
  current.current = props;
  const [failed, setFailed] = useState(false);
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
        element.dataset.rendered = String(group.children.length > 0);
        element.dataset.triangles = String(renderer.info.render.triangles);
      });
    };
    const fit = (preset: Props["camera"]) => {
      const p = current.current,
        bounds = p.scene?.bounds,
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
      const distance =
        span * (camera.aspect < 0.9 ? 2.8 : camera.aspect > 1.7 ? 1.75 : 2.1);
      const direction =
        preset === "top"
          ? new T.Vector3(0, 1, 0.001)
          : preset === "front"
            ? new T.Vector3(0, 0.28, 1)
            : new T.Vector3(0.65, 0.8, 1);
      camera.position
        .copy(target)
        .add(direction.normalize().multiplyScalar(distance));
      controls.target.copy(target);
      controls.update();
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
      draw();
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
    runtime.current?.fit(props.camera);
  }, [props.camera, props.reset, props.width, props.height]);
  return (
    <div className="paper-viewer" ref={host} data-rendered="false">
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
