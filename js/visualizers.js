/**
 * VISUALIZADORES 3D INTERACTIVOS CON THREE.JS (MOTOR OPTIMIZADO BAJO DEMANDA)
 * Cálculo Diferencial e Integral Avanzado (CM2A1 - UNI)
 *
 * Optimizaciones clave contra lag y pérdida de contexto WebGL (webglcontextlost):
 * 1. Renderizado Bajo Demanda (On-Demand Rendering): 0 FPS en reposo; solo dibuja
 *    cuando el usuario rota/hace zoom con el mouse/dedo o mueve un deslizador.
 * 2. Gestión de Contexto Único: Solo mantiene 1 contexto WebGL activo a la vez;
 *    al cambiar de pestaña o cerrar la simulación se libera el 100% de la VRAM.
 * 3. Controles explícitos para el usuario: "▶️ Iniciar Simulación", "⏸️ Pausar"
 *    y "⏹️ Cerrar Simulación (Liberar GPU)".
 * 4. Limpieza recursiva de geometrías/materiales (incluyendo bordes hijos) y
 *    materiales compartidos en las sumas de Riemann.
 */

(function () {
  const REGISTRY = {};

  // Limpieza recursiva de memoria GPU (Geometrías y Materiales de nodos e hijos)
  function disposeObject3D(obj) {
    if (!obj) return;
    if (obj.children && obj.children.length > 0) {
      for (let i = obj.children.length - 1; i >= 0; i--) {
        disposeObject3D(obj.children[i]);
      }
    }
    if (obj.geometry) {
      obj.geometry.dispose();
    }
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m && m.dispose && m.dispose());
      } else if (obj.material.dispose) {
        obj.material.dispose();
      }
    }
  }

  // Crear barra de botones Iniciar / Pausar / Cerrar encima del visor
  function ensureControlToolbar(container, canvasId, titleText) {
    const card = container.closest('.visualizer-card');
    if (!card) return null;

    let toolbar = card.querySelector('.sim-lifecycle-bar');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.className = 'sim-lifecycle-bar';
      toolbar.innerHTML = `
        <div class="sim-lifecycle-status">
          <span class="sim-status-dot active" id="dot-${canvasId}"></span>
          <span class="sim-status-label" id="status-${canvasId}">Modo Ahorro GPU (0 FPS en reposo)</span>
        </div>
        <div class="sim-lifecycle-actions">
          <button type="button" class="sim-ctrl-btn btn-sim-start" data-action="start" style="display:none;">
            ▶️ Iniciar Gráfica 3D
          </button>
          <button type="button" class="sim-ctrl-btn btn-sim-pause" data-action="pause">
            ⏸️ Pausar
          </button>
          <button type="button" class="sim-ctrl-btn btn-sim-close" data-action="close">
            ⏹️ Cerrar Simulación
          </button>
        </div>
      `;
      const header = card.querySelector('.visualizer-header');
      if (header && header.nextSibling) {
        card.insertBefore(toolbar, header.nextSibling);
      } else {
        card.prepend(toolbar);
      }

      const btnStart = toolbar.querySelector('[data-action="start"]');
      const btnPause = toolbar.querySelector('[data-action="pause"]');
      const btnClose = toolbar.querySelector('[data-action="close"]');

      btnStart.addEventListener('click', () => startVisualizer(canvasId));
      btnPause.addEventListener('click', () => togglePauseVisualizer(canvasId));
      btnClose.addEventListener('click', () => stopVisualizer(canvasId, false));
    }
    return toolbar;
  }

  function updateToolbarUI(canvasId, statusMode) {
    const container = document.getElementById(canvasId);
    if (!container) return;
    const card = container.closest('.visualizer-card');
    if (!card) return;

    const dot = card.querySelector(`#dot-${canvasId}`);
    const label = card.querySelector(`#status-${canvasId}`);
    const btnStart = card.querySelector('[data-action="start"]');
    const btnPause = card.querySelector('[data-action="pause"]');
    const btnClose = card.querySelector('[data-action="close"]');

    if (!dot || !label || !btnStart || !btnPause || !btnClose) return;

    dot.className = 'sim-status-dot';
    if (statusMode === 'running') {
      dot.classList.add('active');
      label.textContent = 'Simulación Activa (Bajo demanda • 0% GPU en reposo)';
      btnStart.style.display = 'none';
      btnPause.style.display = 'inline-flex';
      btnPause.innerHTML = '⏸️ Pausar';
      btnClose.style.display = 'inline-flex';
    } else if (statusMode === 'paused') {
      dot.classList.add('paused');
      label.textContent = 'Simulación Pausada (Imagen congelada • 0% CPU/GPU)';
      btnStart.style.display = 'none';
      btnPause.style.display = 'inline-flex';
      btnPause.innerHTML = '▶️ Reanudar';
      btnClose.style.display = 'inline-flex';
    } else {
      dot.classList.add('stopped');
      label.textContent = 'Simulación Cerrada (Memoria gráfica liberada)';
      btnStart.style.display = 'inline-flex';
      btnPause.style.display = 'none';
      btnClose.style.display = 'none';
    }
  }

  // Mostrar pantalla de espera ligera cuando la simulación está cerrada
  function renderStandbyOverlay(container, canvasId, reasonText) {
    const descriptions = {
      'jacobian-canvas-container': 'Visualiza cómo la matriz jacobiana deforma una cuadrícula bidimensional y escala el elemento diferencial de área.',
      'implicit-canvas-container': 'Explora el elipsoide F(x,y,z)=0, su vector normal gradiente ∇F(P₀), el plano tangente y la curva implícita local.',
      'riemann-canvas-container': 'Construye las columnas de las sumas inferiores L(f,P), superiores U(f,P) y del punto medio en 3D.',
      'fubini-canvas-container': 'Desliza el plano de corte transversal x = x₀ para observar cómo el área A(x₀) genera el volumen por Fubini.'
    };
    const desc = descriptions[canvasId] || 'Gráfico interactivo tridimensional con soporte táctil y de ratón.';

    container.innerHTML = `
      <div class="sim-standby-placeholder">
        <div class="sim-standby-icon">🧊</div>
        <h4 class="sim-standby-title">${reasonText || 'Simulación 3D Lista para Iniciar'}</h4>
        <p class="sim-standby-desc">${desc}</p>
        <button type="button" class="sim-standby-launch-btn" id="launch-${canvasId}">
          ▶️ Iniciar Gráfica Interactiva 3D
        </button>
        <span class="sim-standby-hint">⚡ Optimizado: no consume memoria gráfica mientras está cerrada</span>
      </div>
    `;
    const launchBtn = container.querySelector(`#launch-${canvasId}`);
    if (launchBtn) {
      launchBtn.addEventListener('click', () => startVisualizer(canvasId));
    }
  }

  // Detener y liberar completamente la memoria WebGL de un visor
  function stopVisualizer(canvasId, isAutoSwitch) {
    const entry = REGISTRY[canvasId];
    const container = document.getElementById(canvasId);

    if (entry && entry.instance) {
      const inst = entry.instance;
      inst.disposed = true;
      if (inst.rafId) {
        cancelAnimationFrame(inst.rafId);
        inst.rafId = null;
      }
      if (inst.resizeHandler) {
        window.removeEventListener('resize', inst.resizeHandler);
      }
      if (inst.observer) {
        inst.observer.disconnect();
      }
      if (inst.controls && inst.controls.dispose) {
        inst.controls.dispose();
      }
      if (inst.scene) {
        disposeObject3D(inst.scene);
      }
      if (inst.renderer) {
        try {
          inst.renderer.dispose();
          if (inst.renderer.forceContextLoss) {
            inst.renderer.forceContextLoss();
          }
        } catch (e) {
          // Ignorar errores al liberar contexto
        }
      }
      entry.instance = null;
    }

    if (container) {
      ensureControlToolbar(container, canvasId);
      renderStandbyOverlay(
        container,
        canvasId,
        isAutoSwitch
          ? 'Simulación en Pausa Automática (Ahorro de Memoria)'
          : 'Simulación 3D Cerrada (Memoria GPU Liberada)'
      );
      updateToolbarUI(canvasId, 'stopped');
    }
  }

  // Pausar o reanudar sin destruir el canvas
  function togglePauseVisualizer(canvasId) {
    const entry = REGISTRY[canvasId];
    if (!entry || !entry.instance) {
      startVisualizer(canvasId);
      return;
    }
    const inst = entry.instance;
    inst.paused = !inst.paused;
    if (inst.controls) {
      inst.controls.enabled = !inst.paused;
    }
    if (inst.paused) {
      if (inst.rafId) {
        cancelAnimationFrame(inst.rafId);
        inst.rafId = null;
      }
      updateToolbarUI(canvasId, 'paused');
    } else {
      updateToolbarUI(canvasId, 'running');
      inst.requestRender();
    }
  }

  // Iniciar un visor (cerrando antes cualquier otro visor 3D abierto para garantizar máximo 1 contexto WebGL)
  function startVisualizer(canvasId) {
    // Cerrar otros visores activos para que jamás haya más de 1 WebGLRenderer consumiendo VRAM
    Object.keys(REGISTRY).forEach(otherId => {
      if (otherId !== canvasId && REGISTRY[otherId].instance) {
        stopVisualizer(otherId, true);
      }
    });

    const entry = REGISTRY[canvasId];
    if (!entry) return;

    if (entry.instance) {
      if (entry.instance.paused) {
        togglePauseVisualizer(canvasId);
      }
      return;
    }

    mountThreeInstance(canvasId, entry.setupCallback);
  }

  // Montar la escena Three.js con renderizado bajo demanda (0 FPS en reposo)
  function mountThreeInstance(canvasId, initSceneCallback) {
    const container = document.getElementById(canvasId);
    if (!container) return null;

    ensureControlToolbar(container, canvasId);

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 340;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(5, 5, 5);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'default'
      });
    } catch (err) {
      renderStandbyOverlay(container, canvasId, 'No se pudo iniciar WebGL. Haz clic para reintentar.');
      updateToolbarUI(canvasId, 'stopped');
      return null;
    }

    // Limitar pixelRatio a 1.5 máx para evitar sobrecarga en pantallas Retina / Android FHD+
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1.15;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    };

    // Iluminación ligera (sin shadowMaps pesados)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.68);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
    dirLight.position.set(10, 15, 10);
    scene.add(dirLight);

    const dirLight2 = new THREE.DirectionalLight(0xa855f7, 0.45);
    dirLight2.position.set(-10, -5, -10);
    scene.add(dirLight2);

    const axes = new THREE.AxesHelper(3);
    scene.add(axes);

    const grid = new THREE.GridHelper(6, 12, 0x475569, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);

    const inst = {
      scene,
      camera,
      renderer,
      controls,
      paused: false,
      disposed: false,
       isVisible: true,
      rafId: null,
      renderRequested: false,
      requestRender: null
    };

    // Renderizado bajo demanda: solo dibuja cuando hay movimiento o cambio de parámetros
    function renderFrame() {
      inst.rafId = null;
      inst.renderRequested = false;
      if (inst.disposed || inst.paused || !inst.isVisible) return;

      // controls.update() devuelve true si el damping sigue desacelerando
      const stillMoving = controls.update();
      renderer.render(scene, camera);

      if (stillMoving) {
        requestRender();
      }
    }

    function requestRender() {
      if (inst.disposed || inst.paused || !inst.isVisible) return;
      if (!inst.renderRequested) {
        inst.renderRequested = true;
        inst.rafId = requestAnimationFrame(renderFrame);
      }
    }

    inst.requestRender = requestRender;

    // Redibujar automáticamente cuando el usuario gira o hace zoom con OrbitControls
    controls.addEventListener('change', () => {
      if (!inst.disposed && !inst.paused) {
        renderer.render(scene, camera);
      }
    });

    // Detectar si el navegador pierde el contexto WebGL y ofrecer restauración en 1 clic
    renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      stopVisualizer(canvasId, false);
      renderStandbyOverlay(
        container,
        canvasId,
        'El navegador liberó la gráfica por inactividad. Haz clic para restaurarla.'
      );
    }, false);

    // Pausar renderizado si el visor sale de la pantalla al hacer scroll
    if ('IntersectionObserver' in window) {
      inst.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          inst.isVisible = entry.isIntersecting;
          if (inst.isVisible && !inst.paused && !inst.disposed) {
            requestRender();
          }
        });
      }, { threshold: 0.05 });
      inst.observer.observe(container);
    }

    // Ajuste de tamaño de ventana
    inst.resizeHandler = () => {
      if (inst.disposed || !container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        requestRender();
      }
    };
    window.addEventListener('resize', inst.resizeHandler);

    REGISTRY[canvasId].instance = inst;
    updateToolbarUI(canvasId, 'running');

    // Ejecutar configuración específica de la escena
    initSceneCallback({
      scene,
      camera,
      renderer,
      controls,
      requestRender,
      disposeObject3D
    });

    // Render inicial
    requestRender();
    return inst;
  }

  // Registrar un visualizador y lanzarlo
  function registerAndStart(canvasId, setupCallback) {
    REGISTRY[canvasId] = {
      setupCallback,
      instance: REGISTRY[canvasId] ? REGISTRY[canvasId].instance : null
    };
    startVisualizer(canvasId);
  }

  // API pública para controlar desde app.js al cambiar de pestaña
  window.VisualizerManager = {
    start: startVisualizer,
    stop: stopVisualizer,
    togglePause: togglePauseVisualizer,
    onTopicSwitch: function (topicId) {
      const mapTopicToCanvas = {
        't1': 'jacobian-canvas-container',
        't2': 'implicit-canvas-container',
        't3': 'riemann-canvas-container',
        't5': 'fubini-canvas-container'
      };
      const targetCanvas = mapTopicToCanvas[topicId];

      // Cerrar todos los visores de las demás pestañas para liberar GPU al instante
      Object.keys(REGISTRY).forEach(cid => {
        if (cid !== targetCanvas && REGISTRY[cid].instance) {
          stopVisualizer(cid, true);
        }
      });

      // Si la pestaña actual ya estaba registrada pero en espera, iniciarla suavemente
      if (targetCanvas && REGISTRY[targetCanvas] && !REGISTRY[targetCanvas].instance) {
        startVisualizer(targetCanvas);
      }
    }
  };

  // ============================================================================
  // 1. VISUALIZADOR 3D: SUMAS DE RIEMANN Y DARBOUX SOBRE RECTÁNGULOS
  // ============================================================================
  window.initRiemannVisualizer = function () {
    registerAndStart('riemann-canvas-container', ({ scene, camera, controls, requestRender, disposeObject3D }) => {
      camera.position.set(4, 3.5, 4);
      controls.target.set(1, 0.5, 1);

      const prismsGroup = new THREE.Group();
      scene.add(prismsGroup);

      function f(x, y) {
        return 1.8 - 0.4 * (x - 1) * (x - 1) - 0.4 * (y - 1) * (y - 1);
      }

      const surfaceGeometry = new THREE.ParametricGeometry((u, v, target) => {
        const x = u * 2;
        const y = v * 2;
        const z = f(x, y);
        target.set(x, z, y);
      }, 24, 24);

      const surfaceMaterial = new THREE.MeshPhongMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.48,
        side: THREE.DoubleSide
      });
      scene.add(new THREE.Mesh(surfaceGeometry, surfaceMaterial));

      const baseBoxGeo = new THREE.BoxGeometry(2, 0.02, 2);
      const baseBoxMat = new THREE.MeshBasicMaterial({ color: 0x334155, wireframe: true });
      const baseBox = new THREE.Mesh(baseBoxGeo, baseBoxMat);
      baseBox.position.set(1, 0, 1);
      scene.add(baseBox);

      // Materiales compartidos para evitar crear cientos de shaders al mover los sliders
      const sharedMaterials = {
        lower: new THREE.MeshPhongMaterial({ color: 0x22c55e, transparent: true, opacity: 0.78 }),
        upper: new THREE.MeshPhongMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.78 }),
        mid: new THREE.MeshPhongMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.78 }),
        edge: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
      };

      const sliderM = document.getElementById('riemann-m-slider');
      const sliderN = document.getElementById('riemann-n-slider');
      let currentM = sliderM ? parseInt(sliderM.value, 10) : 4;
      let currentN = sliderN ? parseInt(sliderN.value, 10) : 4;
      let currentMode = 'upper';
      const activeModeBtn = document.querySelector('.riemann-mode-btn.active');
      if (activeModeBtn && activeModeBtn.dataset.mode) {
        currentMode = activeModeBtn.dataset.mode;
      }

      function updatePrisms() {
        // Liberar únicamente las geometrías de los prismas previos (conservando materiales compartidos)
        while (prismsGroup.children.length > 0) {
          const prism = prismsGroup.children[0];
          prism.children.forEach(ch => {
            if (ch.geometry) ch.geometry.dispose();
          });
          if (prism.geometry) prism.geometry.dispose();
          prismsGroup.remove(prism);
        }

        const dx = 2 / currentM;
        const dy = 2 / currentN;
        let sumValue = 0;
        const activeMat = sharedMaterials[currentMode] || sharedMaterials.upper;

        for (let i = 0; i < currentM; i++) {
          for (let j = 0; j < currentN; j++) {
            const x0 = i * dx;
            const x1 = (i + 1) * dx;
            const y0 = j * dy;
            const y1 = (j + 1) * dy;

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
            const prism = new THREE.Mesh(boxGeo, activeMat);
            prism.position.set(x0 + dx / 2, height / 2, y0 + dy / 2);

            const edgesGeo = new THREE.EdgesGeometry(boxGeo);
            const wire = new THREE.LineSegments(edgesGeo, sharedMaterials.edge);
            prism.add(wire);

            prismsGroup.add(prism);
          }
        }

        const valueDisplay = document.getElementById('riemann-val-display');
        if (valueDisplay) valueDisplay.innerText = sumValue.toFixed(4);

        const boxesCountDisplay = document.getElementById('riemann-boxes-count');
        if (boxesCountDisplay) {
          boxesCountDisplay.innerText = `${currentM * currentN} prismas (${currentM}x${currentN})`;
        }

        requestRender();
      }

      updatePrisms();

      if (sliderM) {
        sliderM.oninput = (e) => {
          currentM = parseInt(e.target.value, 10);
          updatePrisms();
        };
      }
      if (sliderN) {
        sliderN.oninput = (e) => {
          currentN = parseInt(e.target.value, 10);
          updatePrisms();
        };
      }

      const modeButtons = document.querySelectorAll('.riemann-mode-btn');
      modeButtons.forEach(btn => {
        btn.onclick = () => {
          modeButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentMode = btn.dataset.mode;
          updatePrisms();
        };
      });
    });
  };

  // ============================================================================
  // 2. VISUALIZADOR 3D: SUPERFICIE IMPLÍCITA Y PLANO TANGENTE (TFI)
  // ============================================================================
  window.initImplicitVisualizer = function () {
    registerAndStart('implicit-canvas-container', ({ scene, camera, controls, requestRender }) => {
      camera.position.set(3.5, 2.8, 3.5);
      controls.target.set(0, 0, 0);

      const a = 1.8, b = 1.2, c = 1.0;
      const ellipsoidGeo = new THREE.ParametricGeometry((u, v, target) => {
        const theta = u * 2 * Math.PI;
        const phi = (v - 0.5) * Math.PI;
        const x = a * Math.cos(phi) * Math.cos(theta);
        const y = c * Math.sin(phi);
        const z = b * Math.cos(phi) * Math.sin(theta);
        target.set(x, y, z);
      }, 30, 30);

      const ellipsoidMat = new THREE.MeshPhongMaterial({
        color: 0x8b5cf6,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide
      });
      scene.add(new THREE.Mesh(ellipsoidGeo, ellipsoidMat));

      const wireGeo = new THREE.WireframeGeometry(ellipsoidGeo);
      const wireMat = new THREE.LineBasicMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.2 });
      scene.add(new THREE.LineSegments(wireGeo, wireMat));

      const theta0 = Math.PI / 4;
      const phi0 = Math.PI / 6;
      const p0x = a * Math.cos(phi0) * Math.cos(theta0);
      const p0y = c * Math.sin(phi0);
      const p0z = b * Math.cos(phi0) * Math.sin(theta0);

      const pointGeo = new THREE.SphereGeometry(0.08, 14, 14);
      const pointMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0x881337 });
      const pointMesh = new THREE.Mesh(pointGeo, pointMat);
      pointMesh.position.set(p0x, p0y, p0z);
      scene.add(pointMesh);

      const normal = new THREE.Vector3(
        (2 * p0x) / (a * a),
        (2 * p0y) / (c * c),
        (2 * p0z) / (b * b)
      ).normalize();

      const arrowHelper = new THREE.ArrowHelper(normal, new THREE.Vector3(p0x, p0y, p0z), 1.2, 0xf43f5e, 0.2, 0.1);
      scene.add(arrowHelper);

      const planeGeo = new THREE.CircleGeometry(1.2, 28);
      const planeMat = new THREE.MeshPhongMaterial({
        color: 0x10b981,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55
      });
      const planeMesh = new THREE.Mesh(planeGeo, planeMat);
      planeMesh.position.set(p0x, p0y, p0z);

      const up = new THREE.Vector3(0, 0, 1);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);
      planeMesh.setRotationFromQuaternion(quaternion);
      scene.add(planeMesh);

      const curvePoints = [];
      for (let t = -0.6; t <= 0.6; t += 0.05) {
        const px = p0x + t;
        const inside = 1 - (px * px) / (a * a) - (p0z * p0z) / (b * b);
        if (inside >= 0) {
          const py = c * Math.sqrt(inside);
          curvePoints.push(new THREE.Vector3(px, py, p0z));
        }
      }
      const curveGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const curveMat = new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 3 });
      scene.add(new THREE.Line(curveGeo, curveMat));

      requestRender();
    });
  };

  // ============================================================================
  // 3. VISUALIZADOR 3D: DEFORMACIÓN JACOBIANA Y FACTOR DE VOLUMEN (TFI)
  // ============================================================================
  window.initJacobianVisualizer = function () {
    registerAndStart('jacobian-canvas-container', ({ scene, camera, controls, requestRender }) => {
      camera.position.set(3, 4, 3);
      controls.target.set(0, 0, 0);

      const gridLines = new THREE.Group();
      scene.add(gridLines);

      const sharedLineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 });
      const sharedPatchMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });

      const slider = document.getElementById('jacobian-slider');
      let distortionParam = slider ? parseFloat(slider.value) : 0;

      function updateGrid(t) {
        while (gridLines.children.length > 0) {
          const obj = gridLines.children[0];
          if (obj.geometry) obj.geometry.dispose();
          gridLines.remove(obj);
        }

        const steps = 14;
        const range = 1.5;
        const stepSize = (2 * range) / steps;

        function mapCoords(u, v) {
          const x = u + t * 0.3 * (v * v - 1);
          const y = t * 0.4 * Math.sin(u * Math.PI) * Math.cos(v * Math.PI);
          const z = v + t * 0.3 * (u * u - 1);
          return new THREE.Vector3(x, y, z);
        }

        for (let i = 0; i <= steps; i++) {
          const v = -range + i * stepSize;
          const pts = [];
          for (let j = 0; j <= 28; j++) {
            const u = -range + (j / 28) * (2 * range);
            pts.push(mapCoords(u, v));
          }
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          gridLines.add(new THREE.Line(geo, sharedLineMat));
        }

        for (let j = 0; j <= steps; j++) {
          const u = -range + j * stepSize;
          const pts = [];
          for (let i = 0; i <= 28; i++) {
            const v = -range + (i / 28) * (2 * range);
            pts.push(mapCoords(u, v));
          }
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          gridLines.add(new THREE.Line(geo, sharedLineMat));
        }

        const u0 = 0.2, v0 = 0.2, du = 0.4, dv = 0.4;
        const p1 = mapCoords(u0, v0);
        const p2 = mapCoords(u0 + du, v0);
        const p3 = mapCoords(u0 + du, v0 + dv);
        const p4 = mapCoords(u0, v0 + dv);

        const polyGeo = new THREE.BufferGeometry();
        const vertices = new Float32Array([
          p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z,
          p1.x, p1.y, p1.z, p3.x, p3.y, p3.z, p4.x, p4.y, p4.z
        ]);
        polyGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        gridLines.add(new THREE.Mesh(polyGeo, sharedPatchMat));

        const detVal = (1 + t * 0.6).toFixed(3);
        const detDisplay = document.getElementById('jacobian-det-val');
        if (detDisplay) detDisplay.innerText = detVal;

        requestRender();
      }

      updateGrid(distortionParam);

      if (slider) {
        slider.oninput = (e) => {
          distortionParam = parseFloat(e.target.value);
          updateGrid(distortionParam);
        };
      }
    });
  };

  // ============================================================================
  // 4. VISUALIZADOR 3D: TEOREMA DE FUBINI Y REBANADAS DE VOLUMEN
  // ============================================================================
  window.initFubiniVisualizer = function () {
    registerAndStart('fubini-canvas-container', ({ scene, camera, controls, requestRender }) => {
      camera.position.set(4, 3, 4);
      controls.target.set(1, 0.6, 1);

      function f(x, y) {
        return 1.4 - 0.25 * (x - 1) * (x - 1) + 0.3 * Math.cos(y * 1.5);
      }

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

      const sliceGroup = new THREE.Group();
      scene.add(sliceGroup);

      const sharedSliceMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const sharedBorderMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 });

      const slider = document.getElementById('fubini-x-slider');
      let currentX0 = slider ? parseFloat(slider.value) : 1.0;

      function updateSlice(x0) {
        while (sliceGroup.children.length > 0) {
          const obj = sliceGroup.children[0];
          if (obj.geometry) obj.geometry.dispose();
          sliceGroup.remove(obj);
        }

        const points = [];
        const steps = 28;
        for (let j = 0; j <= steps; j++) {
          const y = (j / steps) * 2;
          const z = f(x0, y);
          points.push(new THREE.Vector3(x0, z, y));
        }

        const polyVerts = [];
        for (let j = 0; j < steps; j++) {
          const y_a = (j / steps) * 2;
          const y_b = ((j + 1) / steps) * 2;
          const z_a = f(x0, y_a);
          const z_b = f(x0, y_b);

          polyVerts.push(x0, 0, y_a, x0, z_a, y_a, x0, z_b, y_b);
          polyVerts.push(x0, 0, y_a, x0, z_b, y_b, x0, 0, y_b);
        }

        const sliceGeo = new THREE.BufferGeometry();
        sliceGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(polyVerts), 3));
        sliceGroup.add(new THREE.Mesh(sliceGeo, sharedSliceMat));

        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        sliceGroup.add(new THREE.Line(lineGeo, sharedBorderMat));

        let areaVal = 0;
        for (let j = 0; j < steps; j++) {
          const y_mid = ((j + 0.5) / steps) * 2;
          areaVal += f(x0, y_mid) * (2 / steps);
        }
        const areaDisplay = document.getElementById('fubini-slice-area');
        if (areaDisplay) areaDisplay.innerText = areaVal.toFixed(3);

        requestRender();
      }

      updateSlice(currentX0);

      if (slider) {
        slider.oninput = (e) => {
          currentX0 = parseFloat(e.target.value);
          updateSlice(currentX0);
        };
      }
    });
  };
})();
