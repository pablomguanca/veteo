# Veteo — Prevención de merma en tienda

![Status](https://img.shields.io/badge/Status-En_producción-brightgreen?style=for-the-badge)
![HTML](https://img.shields.io/badge/HTML-5-E34F26?style=for-the-badge&logo=html5)
![SCSS](https://img.shields.io/badge/SCSS-BEM_Methodology-hotpink?style=for-the-badge&logo=sass)
![JS](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-Auto_Update-4A90E2?style=for-the-badge&logo=pwa)
![Storage](https://img.shields.io/badge/Base_de_datos-Firestore-FFCA28?style=for-the-badge&logo=firebase)
![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=firebase&logoColor=white)
![Forms](https://img.shields.io/badge/Integración-Google_Forms-4285F4?style=for-the-badge&logo=googleforms)
![License](https://img.shields.io/badge/License-Privado-red?style=for-the-badge)

---

Que ningún producto llegue tarde a su formulario.

## Sobre el Proyecto

**Veteo** nace de un problema concreto: la merma no se pierde por desidia, se pierde porque el producto y la ventana no coinciden. Cada formulario operativo abre y cierra en días y horarios distintos, y cuando el equipo se acuerda, la ventana ya cerró y el producto se tira. Veteo cruza la fecha de vencimiento con el calendario de formularios y le dice a cada tienda qué cargar, dónde y antes de cuándo.

El flujo va del archivo crudo del ERP (`.txt`) a una base normalizada en la nube, sin limpieza previa, y de ahí al formulario de destino con el dato ya cargado. La interfaz está pensada mobile-first, para usarse mientras se recorre el salón de ventas.

## Funcionalidades Principales

- **Vencimientos importados:** Archivo (`.txt`) del GNX que se parsea y se sincroniza automáticamente con la base de la tienda.
- **Scanner Integrado:** Carga manual rápida con cámara, fecha, etapa y notas.
- **Tracker de actividad:** Panel en tiempo real con las cargas del día e historial por período (hoy, ayer, últimos 7 días, mes) que muestra qué se cargó, cuándo y quién.
- **Línea de tiempo operativa:** Guía visual automática por etapa de riesgo (−90, −60, −30, −7 días).
- **Acceso directo a formularios:** Redirección inteligente a PAS, PFT, PCH, Última Milla, Calidad y Rescates según el metadato del producto.
- **Actualizaciones Automáticas (PWA):** Service Worker optimizado con `skipWaiting` para que los usuarios reciban la última versión de la app al instante, sin necesidad de borrar caché.
- **Notificaciones Push:** Recordatorios diarios a las 08:00 hs con las tareas clave del día a través de Firebase.
- **Multitienda:** Sesión por tienda con Firebase Auth, base de datos aislada por tienda y registro del operador en cada carga.

## Tecnologías

| Tecnología               | Uso                                                         |
| ------------------------ | ----------------------------------------------------------- |
| HTML5                    | Estructura semántica                                        |
| SCSS + BEM               | Estilos, variables globales y arquitectura CSS              |
| JavaScript ES6+          | Lógica de módulos, DOM, eventos                             |
| Firestore                | Base por tienda, historial de cargas e índice de actividad   |
| Service Workers          | PWA, instalación nativa, forzado de caché y actualizaciones |
| Vercel Functions         | Procesamiento de archivos, cruce de inventarios y reportes   |
| Google Forms             | Integración con formularios operativos                      |
| Firebase Cloud Messaging | Envíos de notificaciones Web Push                           |

### Capacidades Destacadas:

- **Fuente de verdad única:** Todo el estado vive en Firestore, organizado por tienda (`tiendas/{id}/historial`). El progreso es el mismo desde cualquier dispositivo, sin planillas intermedias ni cruces manuales.
- **Integración de APIs:** Funciones serverless en Vercel y análisis de mermas con Gemini.
- **Procesamiento de Datos:** Algoritmos de parseo de texto plano en tiempo real.
- **Experiencia de Usuario (UX):** Diseño "Mobile-First" con estados visuales de "tarea completada" (`row--done`), animaciones fluidas e íconos en formato SVG para renderizado perfecto en cualquier pantalla.

---

## 🛠️ Arquitectura Técnica

El proyecto se divide en una arquitectura desacoplada:

1. **Frontend (Cliente):** - Desarrollado en JavaScript Vanilla modular para garantizar la máxima velocidad de carga.
   - Render reactivo del listado y del tracker de actividad sobre el DOM.
   - Gestión inteligente del Service Worker para controlar el ciclo de vida de la PWA.

2. **Backend (Serverless):**
   - Funciones en **Vercel** para el parseo de archivos, el cruce de inventarios y el análisis de mermas.
   - Persistencia en **Firestore**, separada por tienda: `productos` como foto del stock actual e `historial` como log inmutable de actividad.

---

## 📊 Resultados e Impacto

- **Reducción de errores:** El parser de TXT y las redirecciones automáticas reducen la carga manual de datos y el tipeo del EAN.
- **Motivación del Equipo:** El cambio de un "Checklist de obligaciones" a un "Tracker de Impacto Operativo" fomenta la participación proactiva.
- **Priorización Visual:** Sistema de alertas que enfoca la atención rápidamente en la mercadería crítica.
- **Omnicanalidad:** Acceso instantáneo, sin pérdida de datos, desde cualquier celular, tablet o PC de la red.

---

> Proyecto de uso interno. El código es de autoría propia pero los recursos integrados pertenecen a una organización privada.

---

**Desarrollado por Pablo Guanca**
