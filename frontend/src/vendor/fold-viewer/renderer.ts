import * as THREE from 'three';
import { sampleDocument } from './geometry';
import type { FoldCamera, FoldDocument, ViewerPreferences } from './types';

const vertexShader = `
  attribute float movingRegion;
  attribute vec3 barycentric;
  attribute vec3 boundaryEdges;
  varying float vMoving;
  varying vec3 vBarycentric;
  varying vec3 vBoundary;
  varying vec3 vNormal;
  void main() {
    vMoving = movingRegion;
    vBarycentric = barycentric;
    vBoundary = boundaryEdges;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 frontColor;
  uniform vec3 backColor;
  uniform float contrast;
  varying vec3 vNormal;
  varying float vMoving;
  varying vec3 vBarycentric;
  varying vec3 vBoundary;
  void main() {
    vec3 light = normalize(vec3(0.35, -0.25, 0.9));
    float diffuse = 0.78 + 0.22 * abs(dot(normalize(vNormal), light));
    vec3 paper = gl_FrontFacing ? frontColor : backColor;
    paper = mix(paper, vec3(0.93, 0.70, 0.30), vMoving * 0.22);
    vec3 color = mix(paper * diffuse, paper, contrast);
    vec3 edgeBlend = mix(vec3(1.0), smoothstep(vec3(0.0), fwidth(vBarycentric) * 1.1, vBarycentric), vBoundary);
    float edge = min(min(edgeBlend.x, edgeBlend.y), edgeBlend.z);
    color = mix(vec3(0.18, 0.14, 0.10), color, edge);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
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
  private authoredCamera?: FoldCamera;
  private pointers = new Map<number, [number, number]>();
  private pinchDistance = 0;
  private crease = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({color:0x584432,dashSize:3,gapSize:2,depthTest:false}));
  private meshCache = new Map<string, { id: string; mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> }>();

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
    this.root.add(this.crease);
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
    const states = sampleDocument(document, stepIndex, progress);
    const step = document.instructions.steps[stepIndex];
    const active = step?.runs.find(run => run.to !== run.from);
    const operation = document.geometry?.operations.find(op => op.id === active?.operation);
    const movingFaces = new Set(operation?.kind === 'hinge' ? operation.movingFaces : []);
    this.crease.visible = operation?.kind === 'hinge' && progress < 1;
    if (operation?.kind === 'hinge') {
      this.crease.geometry.setAttribute('position',new THREE.Float32BufferAttribute(operation.axisMm.flat(),3));
      this.crease.computeLineDistances();
      this.crease.renderOrder = 5;
    }
    for (const state of states) {
      const sheet = document.sheets.find(
        (candidate) => candidate.id === state.sheetId,
      );
      if (!sheet) continue;
      const positions: number[] = [];
      const highlights: number[] = [];
      state.mesh.faces.forEach((face, faceIndex) => {
        const rank = state.layerHint?.ranks[faceIndex] ?? 0;
        const axis = state.layerHint?.axis ?? [0, 0, 1];
        const offset = rank * Math.max(sheet.thicknessMm, 0.02) * 0.08;
        for (const vertexIndex of face.vertices) {
          highlights.push(movingFaces.has(face.id) ? 1 : 0);
          positions.push(
            state.positions[vertexIndex * 3] + axis[0] * offset,
            state.positions[vertexIndex * 3 + 1] + axis[1] * offset,
            state.positions[vertexIndex * 3 + 2] + axis[2] * offset,
          );
        }
      });
      let cached = this.meshCache.get(state.sheetId);
      if (cached && cached.id !== state.mesh.id) {
        this.root.remove(cached.mesh);
        cached.mesh.geometry.dispose();
        cached.mesh.material.dispose();
        this.meshCache.delete(state.sheetId);
        cached = undefined;
      }
      if (!cached) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      geometry.setAttribute('movingRegion',new THREE.Float32BufferAttribute(highlights,1));
      const counts = new Map<string,number>();
      const edgeKey = (id: string,a:number,b:number) => `${id.split(':')[0]}:${Math.min(a,b)}:${Math.max(a,b)}`;
      for (const face of state.mesh.faces) {
        const [a,b,c] = face.vertices;
        for (const [v,w] of [[a,b],[b,c],[c,a]]) {const key=edgeKey(face.id,v,w);counts.set(key,(counts.get(key)??0)+1);}
      }
      const barycentric:number[] = [], boundaries:number[] = [];
      for (const face of state.mesh.faces) {
        const [a,b,c]=face.vertices;
        const flags=[[b,c],[c,a],[a,b]].map(([v,w])=>face.id.includes(':')&&counts.get(edgeKey(face.id,v,w))===1?1:0);
        barycentric.push(1,0,0,0,1,0,0,0,1);boundaries.push(...flags,...flags,...flags);
      }
      geometry.setAttribute('barycentric',new THREE.Float32BufferAttribute(barycentric,3));
      geometry.setAttribute('boundaryEdges',new THREE.Float32BufferAttribute(boundaries,3));
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
      const mesh = new THREE.Mesh(geometry, material);
      this.root.add(mesh);
      cached = {id: state.mesh.id, mesh};
      this.meshCache.set(state.sheetId, cached);
      } else {
        const attribute = cached.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        attribute.array.set(positions);
        attribute.needsUpdate = true;
        const highlight = cached.mesh.geometry.getAttribute('movingRegion') as THREE.BufferAttribute;
        highlight.array.set(highlights);highlight.needsUpdate = true;
        cached.mesh.geometry.computeVertexNormals();
        cached.mesh.material.uniforms.frontColor.value.set(preferences.highContrast ? '#0759d5' : sheet.front.color);
        cached.mesh.material.uniforms.backColor.value.set(preferences.highContrast ? '#ffffff' : sheet.back.color);
        cached.mesh.material.uniforms.contrast.value = preferences.highContrast ? 1 : 0;
      }
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
    this.crease.geometry.dispose();
    this.crease.material.dispose();
    this.renderer.dispose();
  }

  private setCamera(authored?: FoldCamera): void {
    this.authoredCamera = authored;
    const aspect = this.width / this.height;
    if (authored?.projection === 'perspective') {
      if (!(this.camera instanceof THREE.PerspectiveCamera))
        this.camera = new THREE.PerspectiveCamera();
      this.camera.fov = authored.verticalFovDeg ?? 45;
      this.camera.aspect = aspect;
    } else {
      if (!(this.camera instanceof THREE.OrthographicCamera))
        this.camera = new THREE.OrthographicCamera();
      const span = (authored?.verticalSpanMm ?? 230) / this.zoom / Math.min(1, aspect);
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
    this.setCamera(this.authoredCamera);
    this.render();
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }
  private clearMeshes(): void {
    this.meshCache.clear();
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
    this.pointers.set(event.pointerId, [event.clientX,event.clientY]);
    this.pinchDistance = this.pointerDistance();
    this.dragging = true;
    this.lastPointer = [event.clientX, event.clientY];
    this.canvas.setPointerCapture(event.pointerId);
  };
  private pointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return;
    this.pointers.set(event.pointerId, [event.clientX,event.clientY]);
    if (this.pointers.size === 2) {
      const distance = this.pointerDistance();
      if (this.pinchDistance > 0) this.zoom = Math.min(3,Math.max(.55,this.zoom*distance/this.pinchDistance));
      this.pinchDistance = distance;
      this.resize();
      return;
    }
    this.root.rotation.z += (event.clientX - this.lastPointer[0]) * 0.006;
    this.root.rotation.x += (event.clientY - this.lastPointer[1]) * 0.006;
    this.lastPointer = [event.clientX, event.clientY];
    this.render();
  };
  private pointerDistance(): number {
    const points = [...this.pointers.values()];
    return points.length===2 ? Math.hypot(points[0][0]-points[1][0],points[0][1]-points[1][1]) : 0;
  }
  private pointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    this.dragging = this.pointers.size > 0;
    const remaining = [...this.pointers.values()][0];
    if (remaining) this.lastPointer = remaining;
    this.pinchDistance = 0;
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
