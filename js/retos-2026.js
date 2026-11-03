/**
 * MÓDULO DE ENTRENAMIENTO AVANZADO Y RETOS 2026-2 (CM2A1 - UNI)
 * Incluye:
 * 1. Simulador Interactivo 2D de Épsilon-Delta y Cajas de Darboux (Cajas Buenas vs. Cajas Malas)
 * 2. Conmutadores de Anatomía de Demostraciones en 2 Fases (Borrador / Ingeniería Inversa vs. Redacción Formal)
 * 3. Filtros del Traductor de Notación Formal y Laboratorio de Problemas Híbridos
 */

(function () {
  let darbouxCanvas = null;
  let darbouxCtx = null;
  let simState = {
    mode: 'curve', // 'curve' (PD05 #22: y = x^2 en [-1,1]^2) o 'continuous' (Sesión 9.3: f(x,y) = (x+y)/2 en [0,1]^2)
    n: 8,
    eps: 0.35
  };

  window.initRetos2026Module = function () {
    initProofPhaseToggles();
    initRetosSubtabs();
    initDarbouxEpsilonSimulator();
  };

  // 1. Conmutadores de 2 fases para demostraciones (transversal en toda la web)
  function initProofPhaseToggles() {
    document.querySelectorAll('.proof-phase-toggle-btn').forEach(btn => {
      if (btn.dataset.bound === 'true') return;
      btn.dataset.bound = 'true';

      btn.addEventListener('click', () => {
        const parent = btn.closest('.proof-anatomy-widget');
        if (!parent) return;

        const targetPhase = btn.dataset.phase;
        parent.querySelectorAll('.proof-phase-toggle-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.phase === targetPhase);
        });
        parent.querySelectorAll('.proof-phase-pane').forEach(pane => {
          pane.classList.toggle('active', pane.dataset.phase === targetPhase);
        });

        if (window.renderMathInElement) {
          window.renderMathInElement(parent, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\[', right: '\\]', display: true },
              { left: '\\(', right: '\\)', display: false }
            ],
            throwOnError: false
          });
        }
      });
    });
  }

  // 2. Sub-pestañas dentro de la sección Retos 2026-2
  function initRetosSubtabs() {
    const subtabBtns = document.querySelectorAll('.retos-subtab-btn');
    const subtabPanes = document.querySelectorAll('.retos-subtab-pane');

    subtabBtns.forEach(btn => {
      if (btn.dataset.bound === 'true') return;
      btn.dataset.bound = 'true';

      btn.addEventListener('click', () => {
        const target = btn.dataset.subtab;
        subtabBtns.forEach(b => b.classList.toggle('active', b.dataset.subtab === target));
        subtabPanes.forEach(p => p.classList.toggle('active', p.id === `retos-pane-${target}`));

        if (target === 'eps-delta') {
          setTimeout(drawDarbouxSimulation, 60);
        }

        if (window.renderMathInElement) {
          const activePane = document.getElementById(`retos-pane-${target}`);
          if (activePane) {
            window.renderMathInElement(activePane, {
              delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\[', right: '\\]', display: true },
                { left: '\\(', right: '\\)', display: false }
              ],
              throwOnError: false
            });
          }
        }
      });
    });
  }

  // 3. Simulador Visual 2D de Épsilon-Delta y Cajas de Darboux
  function initDarbouxEpsilonSimulator() {
    darbouxCanvas = document.getElementById('darboux-eps-canvas');
    if (!darbouxCanvas) return;
    darbouxCtx = darbouxCanvas.getContext('2d');

    const nSlider = document.getElementById('sim-n-slider');
    const epsSlider = document.getElementById('sim-eps-slider');
    const modeButtons = document.querySelectorAll('.sim-mode-btn');
    const autoFitBtn = document.getElementById('sim-autofit-btn');

    if (nSlider && !nSlider.dataset.bound) {
      nSlider.dataset.bound = 'true';
      nSlider.addEventListener('input', (e) => {
        simState.n = parseInt(e.target.value, 10);
        drawDarbouxSimulation();
      });
    }

    if (epsSlider && !epsSlider.dataset.bound) {
      epsSlider.dataset.bound = 'true';
      epsSlider.addEventListener('input', (e) => {
        simState.eps = parseFloat(e.target.value);
        drawDarbouxSimulation();
      });
    }

    modeButtons.forEach(btn => {
      if (btn.dataset.bound === 'true') return;
      btn.dataset.bound = 'true';
      btn.addEventListener('click', () => {
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        simState.mode = btn.dataset.mode;
        drawDarbouxSimulation();
      });
    });

    if (autoFitBtn && !autoFitBtn.dataset.bound) {
      autoFitBtn.dataset.bound = 'true';
      autoFitBtn.addEventListener('click', () => {
        // Calcula el N necesario por ingeniería inversa para que U - L < eps
        let targetN = 4;
        if (simState.mode === 'curve') {
          // En [-1,1]^2, S(1_Y, P_N) - s(1_Y, P_N) <= 12 / N. Buscamos N tal que suma real < eps
          for (let testN = 2; testN <= 40; testN++) {
            if (computeCurveBadArea(testN) < simState.eps) {
              targetN = testN;
              break;
            }
            targetN = 40;
          }
        } else {
          // En [0,1]^2 para f(x,y) = (x+y)/2, U - L = 1/N < eps => N > 1/eps
          targetN = Math.min(40, Math.max(2, Math.ceil(1.01 / simState.eps)));
        }
        simState.n = targetN;
        if (nSlider) nSlider.value = String(targetN);
        drawDarbouxSimulation();
      });
    }

    window.addEventListener('resize', () => {
      if (darbouxCanvas && darbouxCanvas.offsetParent !== null) {
        drawDarbouxSimulation();
      }
    });

    drawDarbouxSimulation();
  }

  function computeCurveBadArea(N) {
    // Bloque A = [-1, 1] x [-1, 1], lado 2. Sub-bloques de ancho dx = 2/N, dy = 2/N.
    const dx = 2 / N;
    const dy = 2 / N;
    const cellArea = dx * dy;
    let badCount = 0;

    for (let i = 0; i < N; i++) {
      const x0 = -1 + i * dx;
      const x1 = x0 + dx;
      // Rango de y = x^2 en [x0, x1]
      let yMinCurve, yMaxCurve;
      if (x0 <= 0 && x1 >= 0) {
        yMinCurve = 0;
        yMaxCurve = Math.max(x0 * x0, x1 * x1);
      } else {
        yMinCurve = Math.min(x0 * x0, x1 * x1);
        yMaxCurve = Math.max(x0 * x0, x1 * x1);
      }

      for (let j = 0; j < N; j++) {
        const y0 = -1 + j * dy;
        const y1 = y0 + dy;
        // Intersección entre [y0, y1] y [yMinCurve, yMaxCurve]
        if (y1 >= yMinCurve - 1e-9 && y0 <= yMaxCurve + 1e-9) {
          badCount++;
        }
      }
    }
    return badCount * cellArea;
  }

  function drawDarbouxSimulation() {
    if (!darbouxCanvas || !darbouxCtx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = darbouxCanvas.getBoundingClientRect();
    const width = rect.width || 420;
    const height = rect.height || 320;

    darbouxCanvas.width = width * dpr;
    darbouxCanvas.height = height * dpr;
    darbouxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    darbouxCtx.fillStyle = '#0b1120';
    darbouxCtx.fillRect(0, 0, width, height);

    const pad = 34;
    const plotSize = Math.min(width - 2 * pad, height - 2 * pad);
    const startX = (width - plotSize) / 2;
    const startY = (height - plotSize) / 2;

    const N = simState.n;
    const eps = simState.eps;
    const cellPx = plotSize / N;

    let diffVal = 0;
    let badBoxes = 0;
    let totalBoxes = N * N;

    if (simState.mode === 'curve') {
      const dx = 2 / N;
      const dy = 2 / N;
      const cellArea = dx * dy;

      for (let i = 0; i < N; i++) {
        const x0 = -1 + i * dx;
        const x1 = x0 + dx;
        let yMinCurve, yMaxCurve;
        if (x0 <= 0 && x1 >= 0) {
          yMinCurve = 0;
          yMaxCurve = Math.max(x0 * x0, x1 * x1);
        } else {
          yMinCurve = Math.min(x0 * x0, x1 * x1);
          yMaxCurve = Math.max(x0 * x0, x1 * x1);
        }

        for (let j = 0; j < N; j++) {
          const y0 = -1 + j * dy;
          const y1 = y0 + dy;
          const intersects = (y1 >= yMinCurve - 1e-9 && y0 <= yMaxCurve + 1e-9);

          const px = startX + i * cellPx;
          const py = startY + (N - 1 - j) * cellPx;

          if (intersects) {
            badBoxes++;
            darbouxCtx.fillStyle = 'rgba(244, 63, 94, 0.42)';
          } else {
            darbouxCtx.fillStyle = 'rgba(56, 189, 248, 0.08)';
          }
          darbouxCtx.fillRect(px, py, cellPx, cellPx);
          darbouxCtx.strokeStyle = intersects ? 'rgba(244, 63, 94, 0.75)' : 'rgba(71, 85, 105, 0.45)';
          darbouxCtx.lineWidth = 1;
          darbouxCtx.strokeRect(px, py, cellPx, cellPx);
        }
      }

      // Dibujar la curva real y = x^2 en [-1, 1] x [-1, 1]
      darbouxCtx.beginPath();
      darbouxCtx.strokeStyle = '#fbbf24';
      darbouxCtx.lineWidth = 2.5;
      for (let k = 0; k <= 120; k++) {
        const x = -1 + (2 * k) / 120;
        const y = x * x;
        const cx = startX + ((x + 1) / 2) * plotSize;
        const cy = startY + (1 - (y + 1) / 2) * plotSize;
        if (k === 0) darbouxCtx.moveTo(cx, cy);
        else darbouxCtx.lineTo(cx, cy);
      }
      darbouxCtx.stroke();

      diffVal = badBoxes * cellArea;
    } else {
      // Modo función continua uniforme f(x,y) = (x+y)/2 en [0,1]^2
      // Oscilación en cada sub-bloque beta_ij de lado 1/N es 1/N
      diffVal = 1 / N;
      const isSuccess = diffVal < eps;

      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const px = startX + i * cellPx;
          const py = startY + (N - 1 - j) * cellPx;
          const intensity = (i + j) / (2 * N);

          if (isSuccess) {
            darbouxCtx.fillStyle = `rgba(16, 185, 129, ${0.15 + 0.35 * intensity})`;
            darbouxCtx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
          } else {
            darbouxCtx.fillStyle = `rgba(245, 158, 11, ${0.15 + 0.35 * intensity})`;
            darbouxCtx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
          }
          darbouxCtx.fillRect(px, py, cellPx, cellPx);
          darbouxCtx.lineWidth = 1;
          darbouxCtx.strokeRect(px, py, cellPx, cellPx);
        }
      }
      badBoxes = totalBoxes;
    }

    // Marco exterior
    darbouxCtx.strokeStyle = '#94a3b8';
    darbouxCtx.lineWidth = 1.5;
    darbouxCtx.strokeRect(startX, startY, plotSize, plotSize);

    // Actualizar lecturas del DOM
    const nValEl = document.getElementById('sim-n-val');
    const epsValEl = document.getElementById('sim-eps-val');
    const diffValEl = document.getElementById('sim-diff-val');
    const statusEl = document.getElementById('sim-status-badge');
    const formulaExplainEl = document.getElementById('sim-formula-explain');

    if (nValEl) nValEl.textContent = `${N} × ${N} (${totalBoxes} sub-bloques)`;
    if (epsValEl) epsValEl.textContent = eps.toFixed(2);
    if (diffValEl) diffValEl.textContent = diffVal.toFixed(4);

    const passed = diffVal < eps;
    if (statusEl) {
      if (passed) {
        statusEl.textContent = `✅ ¡LOGRADO! S(f,P) - s(f,P) = ${diffVal.toFixed(3)} < ε = ${eps.toFixed(2)}`;
        statusEl.className = 'sim-status-badge success';
      } else {
        statusEl.textContent = `⚠️ AÚN NO: S(f,P) - s(f,P) = ${diffVal.toFixed(3)} ≥ ε = ${eps.toFixed(2)} (Aumenta N)`;
        statusEl.className = 'sim-status-badge pending';
      }
    }

    if (formulaExplainEl) {
      if (simState.mode === 'curve') {
        formulaExplainEl.innerHTML = `
          <strong>Análisis en vivo (PD05 #22 - Parábola $Y = \\{y=x^2\\}$ en $A=[-1,1]^2$):</strong><br>
          • <strong>Cajas Rojas (tocan la curva $y=x^2$):</strong> ${badBoxes} sub-bloques donde $M_\\beta = 1, m_\\beta = 0 \\implies M_\\beta - m_\\beta = 1$.<br>
          • <strong>Cajas Azules (no tocan la curva):</strong> ${totalBoxes - badBoxes} sub-bloques donde $M_\\beta = m_\\beta = 0$.<br>
          • <strong>Área de cada sub-bloque:</strong> $\\text{Area}(\\beta_{ij}) = (2/${N})^2 = ${(4 / (N * N)).toFixed(4)}$.<br>
          • <strong>Diferencia de Darboux:</strong> $S(1_Y, P) - s(1_Y, P) = ${badBoxes} \\times ${(4 / (N * N)).toFixed(4)} = \\mathbf{${diffVal.toFixed(4)}}$.
        `;
      } else {
        const deltaVal = (1 / N).toFixed(3);
        formulaExplainEl.innerHTML = `
          <strong>Análisis en vivo (Sesión 9.3 Teorema 2 - Función Continua en $B=[0,1]^2$):</strong><br>
          • <strong>Norma de la partición ($\\delta = 1/N$):</strong> $\\|P\\| = 1/${N} \\approx ${deltaVal}$.<br>
          • <strong>Oscilación en cada sub-bloque $\\beta_{ij}$:</strong> $M_\\beta - m_\\beta = 1/${N} \\approx ${deltaVal}$.<br>
          • <strong>Suma de áreas:</strong> $\\sum_{\\beta \\in P} \\text{Area}(\\beta) = \\text{Area}(B) = 1$.<br>
          • <strong>Diferencia de Darboux:</strong> $S(f, P) - s(f, P) = \\frac{1}{${N}} \\cdot 1 = \\mathbf{${diffVal.toFixed(4)}}$.
        `;
      }
      if (window.renderMathInElement) {
        window.renderMathInElement(formulaExplainEl, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      }
    }
  }
})();
