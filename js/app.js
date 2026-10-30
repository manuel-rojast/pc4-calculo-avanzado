/**
 * APLICACIÓN PRINCIPAL - CÁLCULO AVANZADO PC4 (CM2A1 - UNI)
 * Control de navegación, renderizado dinámico de ejercicios y KaTeX
 */

document.addEventListener('DOMContentLoaded', () => {
  // Estado global de la interfaz
  const state = {
    currentTopic: 't1',
    currentLevels: {
      't1': '0',
      't2': '0',
      't3': '0',
      't4': '0',
      't5': '0',
      'tb': '0'
    },
    initializedVisualizers: new Set()
  };

  // Inicializar pestañas de temas principales
  const topicTabButtons = document.querySelectorAll('.topic-tab-btn');
  const topicSections = document.querySelectorAll('.topic-section');

  function switchTopic(topicId) {
    state.currentTopic = topicId;

    // Actualizar botones de navegación
    topicTabButtons.forEach(btn => {
      if (btn.dataset.topic === topicId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Mostrar sección correspondiente
    topicSections.forEach(sec => {
      if (sec.id === `section-${topicId}`) {
        sec.classList.add('active');
      } else {
        sec.classList.remove('active');
      }
    });

    // Inicializar visualizador 3D si no ha sido creado aún
    initVisualizerForTopic(topicId);

    // Renderizar ejercicios del tema
    renderExercises(topicId);

    // Re-renderizar KaTeX
    renderMath();
  }

  topicTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTopic(btn.dataset.topic);
    });
  });

  // Inicialización bajo demanda de los visores 3D
  function initVisualizerForTopic(topicId) {
    if (state.initializedVisualizers.has(topicId)) return;

    setTimeout(() => {
      try {
        if (topicId === 't1' && window.initJacobianVisualizer) {
          window.initJacobianVisualizer();
          state.initializedVisualizers.add('t1');
        } else if (topicId === 't2' && window.initImplicitVisualizer) {
          window.initImplicitVisualizer();
          state.initializedVisualizers.add('t2');
        } else if (topicId === 't3' && window.initRiemannVisualizer) {
          window.initRiemannVisualizer();
          state.initializedVisualizers.add('t3');
        } else if (topicId === 't5' && window.initFubiniVisualizer) {
          window.initFubiniVisualizer();
          state.initializedVisualizers.add('t5');
        }
      } catch (e) {
        console.warn(`Error inicializando visor 3D para ${topicId}:`, e);
      }
    }, 150);
  }

  // Renderizado dinámico de tarjetas de ejercicios
  function renderExercises(topicId) {
    const container = document.getElementById(`exercises-container-${topicId}`);
    if (!container) return;

    const currentLevel = state.currentLevels[topicId] || '1';
    const exercises = window.EXERCISES_DATA ? window.EXERCISES_DATA.filter(ex => ex.topic === topicId) : [];
    
    const filtered = currentLevel === 'all' 
      ? exercises 
      : exercises.filter(ex => String(ex.level) === String(currentLevel));

    container.innerHTML = '';

    if (filtered.length === 0) {
      container.innerHTML = `<div class="exercise-card"><p>No hay ejercicios disponibles para este filtro.</p></div>`;
      return;
    }

    filtered.forEach(ex => {
      const card = document.createElement('div');
      card.className = 'exercise-card';
      card.id = `exercise-${ex.id}`;

      // Etiqueta de examen UNI si corresponde
      let examBadge = '';
      if (ex.title.includes('2026') || ex.title.includes('2025') || ex.title.includes('2024')) {
        examBadge = `<span class="exam-tag">🏛️ Examen UNI</span>`;
      }

      card.innerHTML = `
        <div class="exercise-card-header">
          <div class="exercise-badges">
            <span class="level-badge badge-l${ex.level}">Nivel ${ex.level}</span>
            ${examBadge}
            <span style="font-size:0.8rem; color:#94a3b8; font-weight:600;">#${ex.id}</span>
          </div>
          <h3 class="exercise-title">${ex.title}</h3>
        </div>

        <div class="exercise-statement">
          ${formatMathText(ex.statement)}
        </div>

        <div class="exercise-actions">
          <button class="btn-action btn-hint" data-ex-id="${ex.id}">
            💡 Pista Conceptual
          </button>
          <button class="btn-action btn-solution" data-ex-id="${ex.id}">
            📝 Ver Solución Paso a Paso
          </button>
        </div>

        <div class="hint-box" id="hint-${ex.id}">
          <strong>Pista:</strong> ${formatMathText(ex.hint)}
        </div>

        <div class="solution-box" id="solution-${ex.id}">
          <h4 style="color:#38bdf8; margin-bottom:0.75rem; font-size:1rem;">Desarrollo Riguroso:</h4>
          <div>${formatMathText(ex.solution)}</div>
          
          <div class="traps-box">
            <div class="traps-title">⚠️ Errores Frecuentes y Trampas UNI:</div>
            <div>${formatMathText(ex.commonMistakes)}</div>
          </div>
        </div>
      `;

      // Event listeners para botones de pista y solución
      const hintBtn = card.querySelector('.btn-hint');
      const hintBox = card.querySelector('.hint-box');
      hintBtn.addEventListener('click', () => {
        hintBox.classList.toggle('active');
        hintBtn.classList.toggle('active');
      });

      const solBtn = card.querySelector('.btn-solution');
      const solBox = card.querySelector('.solution-box');
      solBtn.addEventListener('click', () => {
        solBox.classList.toggle('active');
        solBtn.classList.toggle('active');
        if (solBox.classList.contains('active')) {
          renderMath(solBox);
        }
      });

      container.appendChild(card);
    });

    renderMath(container);
  }

  // Formatear saltos de línea y texto plano a HTML
  function formatMathText(str) {
    if (!str) return '';
    return str
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
  }

  // Renderizar fórmulas KaTeX de forma segura
  function renderMath(targetElement) {
    const el = targetElement || document.body;
    if (window.renderMathInElement) {
      window.renderMathInElement(el, {
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

  // Configurar selectores de nivel (Pestañas de Nivel 1 a 5)
  document.querySelectorAll('.level-tabs').forEach(tabGroup => {
    const topicId = tabGroup.dataset.topic;
    tabGroup.querySelectorAll('.level-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tabGroup.querySelectorAll('.level-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentLevels[topicId] = btn.dataset.level;
        renderExercises(topicId);
      });
    });
  });

  // Inicializar primer tema
  switchTopic('t1');
});
