# Plataforma Interactiva de Estudio: PC4 Cálculo Diferencial e Integral Avanzado (CM2A1)

Compendio interactivo web y versión académica en PDF diseñada específicamente para los temas de la **Práctica Calificada 4** del curso **Cálculo Diferencial e Integral Avanzado (CM2A1)** de la Escuela Profesional de Matemática, Facultad de Ciencias de la **Universidad Nacional de Ingeniería (UNI)**.

---

## 📚 Contenido del Proyecto

1. **Plataforma Web Interactiva (`index.html`):**
   - **Teoría Detallada y Didáctica:** Cobertura de las sesiones 20 a 24 del sílabo dosificado oficial (Función Inversa, Función Implícita, Integrales en Bloques, Sumas de Darboux/Riemann, Integrabilidad, Teorema de Fubini y Teorema del Valor Medio), más un módulo bonus de regiones de Tipo 1 y 2.
   - **Visualizadores 3D Interactivos con Three.js:**
     - *Deformación Jacobiana:* Variación paramétrica y factor de escala local de volumen/área $\det J$.
     - *Superficie Implícita:* Visualización en el espacio de la superficie de nivel $F(x,y,z)=0$, punto regular $P_0$, vector normal gradiente y plano tangente.
     - *Sumas de Riemann 3D:* Prismas tridimensionales bajo $z=f(x,y)$ con deslizadores de subdivisiones $m \times n$, alternando entre suma inferior, superior y de punto medio.
     - *Rebanadas de Fubini:* Plano de corte transversal deslizante $x = x_0$ mostrando la función de área $A(x) = \int f(x,y) dy$.
   - **Soporte Táctil Completo para Celulares Android:** Controles de rotación con un dedo, zoom con pellizco de dos dedos y diseño 100% responsivo.
   - **Banco de 80 Ejercicios Clasificados por Niveles (Nivel 1 al 5):**
     - 15 ejercicios por cada subtema oficial (3 ejercicios variados por cada nivel del 1 al 5) + 5 ejercicios del tema bonus.
     - Enunciados completos, pistas didácticas, soluciones paso a paso sin omitir pasos intermedios y cuadros de advertencia sobre trampas conceptuales y errores frecuentes en los exámenes de la UNI.
     - Problemas directamente extraídos y adaptados de las evaluaciones oficiales 2024-II, 2025-II y 2026-I.

2. **Compendio en PDF Imprimible (`pdf/PC4_Calculo_Avanzado_UNI.pdf`):**
   - Documento de 82 páginas con maquetación académica en LaTeX (compilado con MiKTeX).
   - Formato A4 listo para imprimir a doble cara o lectura digital, con índice hipervinculado, tipografía `lmodern` y `amsmath`.

---

## 🚀 Despliegue en GitHub Pages

Para publicar esta plataforma en la web y poder verla desde cualquier celular Android o computadora:

1. **Crear un repositorio nuevo en GitHub** (por ejemplo, `pc4-calculo-avanzado`).
2. **Conectar y subir los archivos de esta carpeta:**
   ```bash
   git remote add origin https://github.com/TU_USUARIO/pc4-calculo-avanzado.git
   git branch -M main
   git push -u origin main
   ```
3. **Activar GitHub Pages:**
   - En tu repositorio de GitHub, ve a **Settings** > **Pages**.
   - En **Build and deployment** > **Source**, selecciona **Deploy from a branch**.
   - En **Branch**, selecciona `main` y la carpeta `/ (root)`.
   - Haz clic en **Save**. En unos instantes estará disponible en:
     `https://TU_USUARIO.github.io/pc4-calculo-avanzado/`

---

## 🔒 Auditoría de Seguridad y Privacidad

- Este repositorio se encuentra **completamente aislado** en su propia subcarpeta con su propio `.git`.
- El archivo `.gitignore` prohíbe el rastreo de archivos temporales del sistema operativo (`Thumbs.db`, `.DS_Store`), archivos de compilación de LaTeX (`*.aux`, `*.log`, `*.out`, `*.toc`) y cualquier archivo personal.
- Ningún dato privado, ruta local absoluta de la máquina ni archivo confidencial se encuentra incluido en los archivos del proyecto.
