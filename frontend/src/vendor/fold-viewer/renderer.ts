import * as THREE from 'three';
import { sampleDocument } from './geometry';
import type { FoldCamera, FoldDocument, ViewerPreferences } from './types';

const vertexShader = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 frontColor;
  uniform vec3 backColor;
  uniform float contrast;
  varying vec3 vNormal;
  void main() {
    vec3 light = normalize(vec3(0.35, -0.25, 0.9));
    float diffuse = 0.78 + 0.22 * abs(dot(normalize(vNormal), light));
    vec3 paper = gl_FrontFacing ? frontColor : backColor;
    vec3 color = mix(paper * diffuse, paper, contrast);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export class FoldThreeRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera | THREE.PerspectiveCamera;
  private root = new THREE.Group();
  private resizeObserver: ResizeObserver;
  private width = 1;
  private height = 1;
  private zoom = 1;
  private dragging = false;
  private lastPointer: [number, number] = [0, 0];

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.OrthographicCamera(
      -100,
      100,
      100,
      -100,
      0.1,
      10000,
    );
    this.scene.add(this.root);
    this.resizeObserver = new ResizeObserver(([entry]) => {
      this.width = Math.max(1, entry.contentRect.width);
      this.height = Math.max(1, entry.contentRect.height);
      this.resize();
    });
    this.resizeObserver.observe(canvas);
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerup', this.pointerUp);
    canvas.addEventListener('pointercancel', this.pointerUp);
    canvas.addEventListener('wheel', this.wheel, { passive: false });
    canvas.addEventListener('keydown', this.keyDown);
  }

  update(
    document: FoldDocument,
    stepIndex: number,
    progress: number,
    preferences: ViewerPreferences,
  ): void {
    this.clearMeshes();
    const states = sampleDocument(document, stepIndex, progress);
    for (const state of states) {
      const sheet = document.sheets.find(
        (candidate) => candidate.id === state.sheetId,
      );
      if (!sheet) continue;
      const positions: number[] = [];
      state.mesh.faces.forEach((face, faceIndex) => {
        const rank = state.layerHint?.ranks[faceIndex] ?? 0;
        const axis = state.layerHint?.axis ?? [0, 0, 1];
        const offset = rank * Math.max(sheet.thicknessMm, 0.02) * 0.08;
        for (const vertexIndex of face.vertices) {
          positions.push(
            state.positions[vertexIndex * 3] + axis[0] * offset,
            state.positions[vertexIndex * 3 + 1] + axis[1] * offset,
            state.positions[vertexIndex * 3 + 2] + axis[2] * offset,
          );
        }
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geometry.computeVertexNormals();
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: THREE.DoubleSide,
        uniforms: {
          frontColor: {
            value: new THREE.Color(
              preferences.highContrast ? '#0759d5' : sheet.front.color,
            ),
          },
          backColor: {
            value: new THREE.Color(
              preferences.highContrast ? '#ffffff' : sheet.back.color,
            ),
          },
          contrast: { value: preferences.highContrast ? 1 : 0 },
        },
      });
      this.root.add(new THREE.Mesh(geometry, material));
    }
    this.setCamera(document.instructions.steps[stepIndex]?.camera);
    this.renderer.setClearColor(
      preferences.plainBackground ? 0xffffff : 0xf3f6f9,
      0,
    );
    this.render();
  }

  resetView(): void {
    this.root.rotation.set(0, 0, 0);
    this.zoom = 1;
    this.resize();
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this.pointerDown);
    this.canvas.removeEventListener('pointermove', this.pointerMove);
    this.canvas.removeEventListener('pointerup', this.pointerUp);
    this.canvas.removeEventListener('pointercancel', this.pointerUp);
    this.canvas.removeEventListener('wheel', this.wheel);
    this.canvas.removeEventListener('keydown', this.keyDown);
    this.clearMeshes();
    this.renderer.dispose();
  }

  private setCamera(authored?: FoldCamera): void {
    const aspect = this.width / this.height;
    if (authored?.projection === 'perspective') {
      if (!(this.camera instanceof THREE.PerspectiveCamera))
        this.camera = new THREE.PerspectiveCamera();
      this.camera.fov = authored.verticalFovDeg ?? 45;
      this.camera.aspect = aspect;
    } else {
      if (!(this.camera instanceof THREE.OrthographicCamera))
        this.camera = new THREE.OrthographicCamera();
      const span = (authored?.verticalSpanMm ?? 230) / this.zoom;
      this.camera.left = (-span * aspect) / 2;
      this.camera.right = (span * aspect) / 2;
      this.camera.top = span / 2;
      this.camera.bottom = -span / 2;
    }
    this.camera.near = 0.1;
    this.camera.far = 10000;
    this.camera.position.fromArray(authored?.positionMm ?? [150, -200, 230]);
    this.camera.up.fromArray(authored?.up ?? [0, 0, 1]);
    this.camera.lookAt(
      new THREE.Vector3().fromArray(authored?.targetMm ?? [0, 0, 0]),
    );
    this.camera.updateProjectionMatrix();
  }

  private resize(): void {
    this.renderer.setSize(this.width, this.height, false);
    if (this.camera instanceof THREE.PerspectiveCamera)
      this.camera.aspect = this.width / this.height;
    else {
      const span = 230 / this.zoom;
      const aspect = this.width / this.height;
      this.camera.left = (-span * aspect) / 2;
      this.camera.right = (span * aspect) / 2;
      this.camera.top = span / 2;
      this.camera.bottom = -span / 2;
    }
    this.camera.updateProjectionMatrix();
    this.render();
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }
  private clearMeshes(): void {
    for (const child of [...this.root.children]) {
      this.root.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material))
          child.material.forEach((item) => item.dispose());
        else child.material.dispose();
      }
    }
  }
  private pointerDown = (event: PointerEvent): void => {
    this.dragging = true;
    this.lastPointer = [event.clientX, event.clientY];
    this.canvas.setPointerCapture(event.pointerId);
  };
  private pointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return;
    this.root.rotation.z += (event.clientX - this.lastPointer[0]) * 0.006;
    this.root.rotation.x += (event.clientY - this.lastPointer[1]) * 0.006;
    this.lastPointer = [event.clientX, event.clientY];
    this.render();
  };
  private pointerUp = (): void => {
    this.dragging = false;
  };
  private wheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.zoom = Math.min(
      3,
      Math.max(0.55, this.zoom * (event.deltaY > 0 ? 0.92 : 1.08)),
    );
    this.resize();
  };
  private keyDown = (event: KeyboardEvent): void => {
    const amount = event.shiftKey ? 0.12 : 0.05;
    if (event.key === 'ArrowLeft') this.root.rotation.z -= amount;
    else if (event.key === 'ArrowRight') this.root.rotation.z += amount;
    else if (event.key === 'ArrowUp') this.root.rotation.x -= amount;
    else if (event.key === 'ArrowDown') this.root.rotation.x += amount;
    else if (event.key.toLowerCase() === 'r') this.resetView();
    else return;
    event.preventDefault();
    this.render();
  };
}
