/**
 * VISUALIZADORES 3D INTERACTIVOS CON THREE.JS
 * Cálculo Diferencial e Integral Avanzado (CM2A1 - UNI)
 * Optimizado para Android móvil (soporte táctil completo) y Escritorio
 */

// Helper para crear un visor Three.js con configuración táctil y responsive
function createThreeContainer(canvasId, initSceneCallback) {
  const container = document.getElementById(canvasId);
  if (!container) return null;

  const width = container.clientWidth || 400;
  const height = container.clientHeight || 300;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a); // Fondo Slate 900 oscuro elegante

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(5, 5, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Limpiar contenedor previo si existe
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // OrbitControls con controles táctiles para Android
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = 0.8;
  controls.zoomSpeed = 1.2;
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN
  };

  // Luces
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x38bdf8, 0.8); // Luz Sky Blue
  dirLight.position.set(10, 15, 10);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const dirLight2 = new THREE.DirectionalLight(0xa855f7, 0.5); // Luz Púrpura complementaria
  dirLight2.position.set(-10, -5, -10);
  scene.add(dirLight2);

  // Ejes coordenados estilizados
  const axes = new THREE.AxesHelper(3);
  scene.add(axes);

  // Rejilla de referencia en el plano horizontal (xz en Three.js estándar)
  const grid = new THREE.GridHelper(6, 12, 0x475569, 0x1e293b);
  grid.position.y = 0;
  scene.add(grid);

  // Responsive resize
  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  const state = initSceneCallback({ scene, camera, renderer, controls });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    if (state && state.update) {
      state.update();
    }
    renderer.render(scene, camera);
  }
  animate();

  return state;
}

// ==============================================================================
// 1. VISUALIZADOR 3D: SUMAS DE RIEMANN Y DARBOUX SOBRE RECTÁNGULOS
// ==============================================================================
window.initRiemannVisualizer = function() {
  createThreeContainer('riemann-canvas-container', ({ scene, camera, controls }) => {
    camera.position.set(4, 3.5, 4);
    controls.target.set(1, 0.5, 1);

    // Grupo de prismas de Riemann
    const prismsGroup = new THREE.Group();
    scene.add(prismsGroup);

    // Malla continua de la superficie z = f(x,y) = 2 - 0.5*(x-1)^2 - 0.5*(y-1)^2
    function f(x, y) {
      return 1.8 - 0.4 * (x - 1) * (x - 1) - 0.4 * (y - 1) * (y - 1);
    }

    const surfaceGeometry = new THREE.ParametricGeometry((u, v, target) => {
      const x = u * 2; // Dominio [0, 2]
      const y = v * 2; // Dominio [0, 2]
      const z = f(x, y);
      target.set(x, z, y); // En Three.js Y es hacia arriba, mapeamos z a Y y y a Z
    }, 30, 30);

    const surfaceMaterial = new THREE.MeshPhongMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      wireframe: false
    });
    const surfaceMesh = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
    scene.add(surfaceMesh);

    // Marco del dominio base [0,2] x [0,2]
    const baseBoxGeo = new THREE.BoxGeometry(2, 0.02, 2);
    const baseBoxMat = new THREE.MeshBasicMaterial({ color: 0x334155, wireframe: true });
    const baseBox = new THREE.Mesh(baseBoxGeo, baseBoxMat);
    baseBox.position.set(1, 0, 1);
    scene.add(baseBox);

    let currentM = 4;
    let currentN = 4;
    let currentMode = 'upper'; // 'lower', 'upper', 'mid'

    function updatePrisms() {
      // Limpiar prismas anteriores
      while (prismsGroup.children.length > 0) {
        const obj = prismsGroup.children[0];
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
        prismsGroup.remove(obj);
      }

      const dx = 2 / currentM;
      const dy = 2 / currentN;
      let sumValue = 0;

      for (let i = 0; i < currentM; i++) {
        for (let j = 0; j < currentN; j++) {
          const x0 = i * dx;
          const x1 = (i + 1) * dx;
          const y0 = j * dy;
          const y1 = (j + 1) * dy;

          // Muestras en las 4 esquinas y centro
          const zCorners = [f(x0, y0), f(x1, y0), f(x0, y1), f(x1, y1)];
          let height = 0;

          if (currentMode === 'lower') {
            height = Math.min(...zCorners);
          } else if (currentMode === 'upper') {
            height = Math.max(...zCorners);
          } else {
            height = f((x0 + x1) / 2, (y0 + y1) / 2);
          }
          height = Math.max(0.01, height);
          sumValue += height * dx * dy;

          const boxGeo = new THREE.BoxGeometry(dx * 0.95, height, dy * 0.95);
          const color = currentMode === 'lower' ? 0x22c55e : (currentMode === 'upper' ? 0xf59e0b : 0x06b6d4);
          const boxMat = new THREE.MeshPhongMaterial({
            color: color,
            transparent: true,
            opacity: 0.75,
            shininess: 80
          });
          const prism = new THREE.Mesh(boxGeo, boxMat);
          prism.position.set(x0 + dx / 2, height / 2, y0 + dy / 2);

          // Borde sutil del prisma
          const edgesGeo = new THREE.EdgesGeometry(boxGeo);
          const edgesMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
          const wire = new THREE.LineSegments(edgesGeo, edgesMat);
          prism.add(wire);

          prismsGroup.add(prism);
        }
      }

      const valueDisplay = document.getElementById('riemann-val-display');
      if (valueDisplay) {
        valueDisplay.innerText = sumValue.toFixed(4);
      }
      const boxesCountDisplay = document.getElementById('riemann-boxes-count');
      if (boxesCountDisplay) {
        boxesCountDisplay.innerText = `${currentM * currentN} prismas (${currentM}x${currentN})`;
      }
    }

    // Inicializar
    updatePrisms();

    // Conectar sliders y botones
    const sliderM = document.getElementById('riemann-m-slider');
    const sliderN = document.getElementById('riemann-n-slider');
    if (sliderM) {
      sliderM.addEventListener('input', (e) => {
        currentM = parseInt(e.target.value);
        updatePrisms();
      });
    }
    if (sliderN) {
      sliderN.addEventListener('input', (e) => {
        currentN = parseInt(e.target.value);
        updatePrisms();
      });
    }

    const modeButtons = document.querySelectorAll('.riemann-mode-btn');
    modeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;
        updatePrisms();
      });
    });

    return {};
  });
};

// ==============================================================================
// 2. VISUALIZADOR 3D: SUPERFICIE IMPLÍCITA Y PLANO TANGENTE (TFI)
// ==============================================================================
window.initImplicitVisualizer = function() {
  createThreeContainer('implicit-canvas-container', ({ scene, camera, controls }) => {
    camera.position.set(3.5, 2.8, 3.5);
    controls.target.set(0, 0, 0);

    // Superficie elipsoide: x^2/a^2 + y^2/b^2 + z^2/c^2 = 1
    const a = 1.8, b = 1.2, c = 1.0;
    const ellipsoidGeo = new THREE.ParametricGeometry((u, v, target) => {
      const theta = u * 2 * Math.PI;
      const phi = (v - 0.5) * Math.PI;
      const x = a * Math.cos(phi) * Math.cos(theta);
      const y = c * Math.sin(phi); // Y vertical
      const z = b * Math.cos(phi) * Math.sin(theta);
      target.set(x, y, z);
    }, 36, 36);

    const ellipsoidMat = new THREE.MeshPhongMaterial({
      color: 0x8b5cf6, // Violeta
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide
    });
    const ellipsoidMesh = new THREE.Mesh(ellipsoidGeo, ellipsoidMat);
    scene.add(ellipsoidMesh);

    // Malla de alambre del elipsoide
    const wireGeo = new THREE.WireframeGeometry(ellipsoidGeo);
    const wireMat = new THREE.LineBasicMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.2 });
    const wireMesh = new THREE.LineSegments(wireGeo, wireMat);
    scene.add(wireMesh);

    // Punto P0 en la superficie: theta = pi/4, phi = pi/6
    const theta0 = Math.PI / 4;
    const phi0 = Math.PI / 6;
    const p0x = a * Math.cos(phi0) * Math.cos(theta0);
    const p0y = c * Math.sin(phi0);
    const p0z = b * Math.cos(phi0) * Math.sin(theta0);

    // Esfera destacada en P0
    const pointGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const pointMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0x881337 });
    const pointMesh = new THREE.Mesh(pointGeo, pointMat);
    pointMesh.position.set(p0x, p0y, p0z);
    scene.add(pointMesh);

    // Vector gradiente nabla F(P0) = (2x0/a^2, 2y0/c^2, 2z0/b^2)
    const normal = new THREE.Vector3(
      (2 * p0x) / (a * a),
      (2 * p0y) / (c * c),
      (2 * p0z) / (b * b)
    ).normalize();

    const arrowHelper = new THREE.ArrowHelper(normal, new THREE.Vector3(p0x, p0y, p0z), 1.2, 0xf43f5e, 0.2, 0.1);
    scene.add(arrowHelper);

    // Plano tangente local: disco orientado según el vector normal
    const planeGeo = new THREE.CircleGeometry(1.2, 32);
    const planeMat = new THREE.MeshPhongMaterial({
      color: 0x10b981, // Verde Esmeralda
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55
    });
    const planeMesh = new THREE.Mesh(planeGeo, planeMat);
    planeMesh.position.set(p0x, p0y, p0z);

    // Alinear el plano con el vector normal
    const up = new THREE.Vector3(0, 0, 1);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);
    planeMesh.setRotationFromQuaternion(quaternion);
    scene.add(planeMesh);

    // Curva de corte / entorno de función implícita local z = phi(x,y)
    const curvePoints = [];
    for (let t = -0.6; t <= 0.6; t += 0.05) {
      const px = p0x + t;
      // despejando de la elipse
      const inside = 1 - (px*px)/(a*a) - (p0z*p0z)/(b*b);
      if (inside >= 0) {
        const py = c * Math.sqrt(inside);
        curvePoints.push(new THREE.Vector3(px, py, p0z));
      }
    }
    const curveGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
    const curveMat = new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 3 });
    const localCurve = new THREE.Line(curveGeo, curveMat);
    scene.add(localCurve);

    return {};
  });
};

// ==============================================================================
// 3. VISUALIZADOR 3D: DEFORMACIÓN JACOBIANA Y FACTOR DE VOLUMEN (TFI / T. Inversa)
// ==============================================================================
window.initJacobianVisualizer = function() {
  createThreeContainer('jacobian-canvas-container', ({ scene, camera, controls }) => {
    camera.position.set(3, 4, 3);
    controls.target.set(0, 0, 0);

    const gridLines = new THREE.Group();
    scene.add(gridLines);

    let distortionParam = 0; // 0 = euclidiana lineal, 1 = máxima no linealidad

    function updateGrid(t) {
      while (gridLines.children.length > 0) {
        const obj = gridLines.children[0];
        obj.geometry.dispose();
        obj.material.dispose();
        gridLines.remove(obj);
      }

      // Malla en [-1.5, 1.5] x [-1.5, 1.5]
      const steps = 14;
      const range = 1.5;
      const stepSize = (2 * range) / steps;

      // Mapeo no lineal: (u, v) -> (u + t*v^2, v + t*u^2)
      function mapCoords(u, v) {
        const x = u + t * 0.3 * (v * v - 1);
        const y = t * 0.4 * Math.sin(u * Math.PI) * Math.cos(v * Math.PI);
        const z = v + t * 0.3 * (u * u - 1);
        return new THREE.Vector3(x, y, z);
      }

      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 });

      // Líneas paralelas a u
      for (let i = 0; i <= steps; i++) {
        const v = -range + i * stepSize;
        const pts = [];
        for (let j = 0; j <= 30; j++) {
          const u = -range + (j / 30) * (2 * range);
          pts.push(mapCoords(u, v));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        gridLines.add(new THREE.Line(geo, lineMaterial));
      }

      // Líneas paralelas a v
      for (let j = 0; j <= steps; j++) {
        const u = -range + j * stepSize;
        const pts = [];
        for (let i = 0; i <= 30; i++) {
          const v = -range + (i / 30) * (2 * range);
          pts.push(mapCoords(u, v));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        gridLines.add(new THREE.Line(geo, lineMaterial));
      }

      // Elemento de volumen central deformado (polígono diferencial dA)
      const u0 = 0.2, v0 = 0.2, du = 0.4, dv = 0.4;
      const p1 = mapCoords(u0, v0);
      const p2 = mapCoords(u0 + du, v0);
      const p3 = mapCoords(u0 + du, v0 + dv);
      const p4 = mapCoords(u0, v0 + dv);

      const polyGeo = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        p1.x, p1.y, p1.z,  p2.x, p2.y, p2.z,  p3.x, p3.y, p3.z,
        p1.x, p1.y, p1.z,  p3.x, p3.y, p3.z,  p4.x, p4.y, p4.z
      ]);
      polyGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      const polyMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
      const patch = new THREE.Mesh(polyGeo, polyMat);
      gridLines.add(patch);

      // Calcular factor de dilatación det(J) aproximado en el centro
      const detVal = (1 + t * 0.6).toFixed(3);
      const detDisplay = document.getElementById('jacobian-det-val');
      if (detDisplay) detDisplay.innerText = detVal;
    }

    updateGrid(0);

    const slider = document.getElementById('jacobian-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        distortionParam = parseFloat(e.target.value);
        updateGrid(distortionParam);
      });
    }

    return {};
  });
};

// ==============================================================================
// 4. VISUALIZADOR 3D: TEOREMA DE FUBINI Y REBANADAS DE VOLUMEN
// ==============================================================================
window.initFubiniVisualizer = function() {
  createThreeContainer('fubini-canvas-container', ({ scene, camera, controls }) => {
    camera.position.set(4, 3, 4);
    controls.target.set(1, 0.6, 1);

    function f(x, y) {
      return 1.4 - 0.25 * (x - 1) * (x - 1) + 0.3 * Math.cos(y * 1.5);
    }

    // Superficie total semitransparente
    const surfGeo = new THREE.ParametricGeometry((u, v, target) => {
      const x = u * 2;
      const y = v * 2;
      const z = f(x, y);
      target.set(x, z, y);
    }, 24, 24);

    const surfMat = new THREE.MeshPhongMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    scene.add(new THREE.Mesh(surfGeo, surfMat));

    // Plano de corte transversal deslizante x = x0
    const sliceGroup = new THREE.Group();
    scene.add(sliceGroup);

    let currentX0 = 1.0;

    function updateSlice(x0) {
      while (sliceGroup.children.length > 0) {
        const obj = sliceGroup.children[0];
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
        sliceGroup.remove(obj);
      }

      // Perfil de la rebanada A(x0)
      const points = [];
      const steps = 30;
      for (let j = 0; j <= steps; j++) {
        const y = (j / steps) * 2;
        const z = f(x0, y);
        points.push(new THREE.Vector3(x0, z, y));
      }

      // Polígono del área de la sección A(x0) hasta la base z = 0
      const polyVerts = [];
      for (let j = 0; j < steps; j++) {
        const y_a = (j / steps) * 2;
        const y_b = ((j + 1) / steps) * 2;
        const z_a = f(x0, y_a);
        const z_b = f(x0, y_b);

        // Triángulo 1
        polyVerts.push(x0, 0, y_a);
        polyVerts.push(x0, z_a, y_a);
        polyVerts.push(x0, z_b, y_b);

        // Triángulo 2
        polyVerts.push(x0, 0, y_a);
        polyVerts.push(x0, z_b, y_b);
        polyVerts.push(x0, 0, y_b);
      }

      const sliceGeo = new THREE.BufferGeometry();
      sliceGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(polyVerts), 3));
      const sliceMat = new THREE.MeshBasicMaterial({
        color: 0xef4444, // Rojo brillante
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      sliceGroup.add(new THREE.Mesh(sliceGeo, sliceMat));

      // Borde del perfil
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 });
      sliceGroup.add(new THREE.Line(lineGeo, lineMat));

      // Calcular área aproximada de la rebanada
      let areaVal = 0;
      for (let j = 0; j < steps; j++) {
        const y_mid = ((j + 0.5) / steps) * 2;
        areaVal += f(x0, y_mid) * (2 / steps);
      }
      const areaDisplay = document.getElementById('fubini-slice-area');
      if (areaDisplay) areaDisplay.innerText = areaVal.toFixed(3);
    }

    updateSlice(1.0);

    const slider = document.getElementById('fubini-x-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        currentX0 = parseFloat(e.target.value);
        updateSlice(currentX0);
      });
    }

    return {};
  });
};
