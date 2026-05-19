# Veteo App - Gestión de Próximos a Vencer

![Status](https://img.shields.io/badge/Status-Proyecto_Finalizado-blueviolet?style=for-the-badge)
![HTML](https://img.shields.io/badge/HTML-5-E34F26?style=for-the-badge&logo=html5)
![SCSS](https://img.shields.io/badge/SCSS-BEM_Methodology-hotpink?style=for-the-badge&logo=sass)
![JS](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-Auto_Update-4A90E2?style=for-the-badge&logo=pwa)
![Storage](https://img.shields.io/badge/Storage-LocalStorage-orange?style=for-the-badge&logo=googlechrome)
![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=firebase&logoColor=white)
![Forms](https://img.shields.io/badge/Integración-Google_Forms-4285F4?style=for-the-badge&logo=googleforms)
![License](https://img.shields.io/badge/License-Privado-red?style=for-the-badge)

---

Hub operativo para la gestión de vencimientos de productos.

## Sobre el Proyecto

**Veteo App** nace de la necesidad de centralizar y digitalizar la gestión diaria del stock perecedero. Reemplaza el seguimiento manual y disperso por un único lugar donde ver, priorizar y accionar cada producto según su etapa de vencimiento.

A diferencia de otros métodos, esta herramienta automatiza el flujo de datos desde archivos de sistema (`.txt`) hacia una base de datos dinámica en la nube, brindando una interfaz de usuario (UI) de alta fidelidad orientada a la eficiencia en dispositivos móviles y sumando dinámicas de gamificación para incentivar al equipo.

## Funcionalidades Principales

- **Vencimientos importados:** Archivo (`.txt`) que se sincroniza automáticamente con Google Sheets.
- **Scanner Integrado:** Carga manual rápida con cámara, fecha, etapa y notas.
- **Gamificación y Tracker de Impacto:** Panel en tiempo real que premia el esfuerzo del usuario (cargas diarias) con estados de racha visuales (⚡, 🔥, 🚀) y muestra su posición en el ranking general.
- **Línea de tiempo operativa:** Guía visual automática por etapa de riesgo (−90, −60, −30, −7 días).
- **Acceso directo a formularios:** Redirección inteligente a PAS, PFT, PCH, Última Milla, Calidad y Rescates según el metadato del producto.
- **Actualizaciones Automáticas (PWA):** Service Worker optimizado con `skipWaiting` para que los usuarios reciban la última versión de la app al instante, sin necesidad de borrar caché.
- **Notificaciones Push:** Recordatorios diarios a las 08:00 hs con las tareas clave del día a través de Firebase.
- **Multiusuario:** Sesión segura, base de datos aislada por usuario y ranking colaborativo gracias a Google OAuth.

## Tecnologías

| Tecnología               | Uso                                                         |
| ------------------------ | ----------------------------------------------------------- |
| HTML5                    | Estructura semántica                                        |
| SCSS + BEM               | Estilos, variables globales y arquitectura CSS              |
| JavaScript ES6+          | Lógica de módulos, DOM, eventos                             |
| LocalStorage             | Persistencia de datos local ultrarrápida                    |
| Service Workers          | PWA, instalación nativa, forzado de caché y actualizaciones |
| Google Apps Scripts      | Backend híbrido, persistencia en la nube y cruce de datos   |
| Google Forms             | Integración con formularios operativos                      |
| Firebase Cloud Messaging | Envíos de notificaciones Web Push                           |

### Capacidades Destacadas:

- **Verdad Distribuida (Sincronización Híbrida):** El sistema cruza los datos del `localStorage` con una base histórica (`Historial Cargas`) en Google Sheets, permitiendo que el progreso y los puntos de gamificación de un usuario sean exactos sin importar desde qué dispositivo inicie sesión.
- **Integración de APIs:** Conexión segura con Google Cloud mediante OAuth2.
- **Procesamiento de Datos:** Algoritmos de parseo de texto plano en tiempo real.
- **Experiencia de Usuario (UX):** Diseño "Mobile-First" con estados visuales de "tarea completada" (`row--done`), animaciones fluidas e íconos en formato SVG para renderizado perfecto en cualquier pantalla.

---

## 🛠️ Arquitectura Técnica

El proyecto se divide en una arquitectura desacoplada:

1. **Frontend (Cliente):** - Desarrollado en JavaScript Vanilla modular para garantizar la máxima velocidad de carga.
   - Motor de gamificación que reacciona instantáneamente a las interacciones del usuario en el DOM.
   - Gestión inteligente del Service Worker para controlar el ciclo de vida de la PWA.

2. **Backend (Servidor Privado):**
   - Motor basado en **Google Apps Script** (API privada).
   - Manejo de base de datos en Google Sheets con múltiples pestañas (`vencimientos`, `Veteo Scaneados`, `Historial Cargas`) para separar "fotos de stock actual" de "logs inmutables de actividad".

---

## 📊 Resultados e Impacto

- **Reducción de errores:** Eliminación de la carga manual de datos gracias al parser de TXT y las redirecciones automáticas.
- **Motivación del Equipo:** El cambio de un "Checklist de obligaciones" a un "Tracker de Impacto Operativo" fomenta la participación proactiva.
- **Priorización Visual:** Sistema de alertas que enfoca la atención rápidamente en la mercadería crítica.
- **Omnicanalidad:** Acceso instantáneo, sin pérdida de datos, desde cualquier celular, tablet o PC de la red.

---

> Proyecto de uso interno. El código es de autoría propia pero los recursos integrados pertenecen a una organización privada.

---

**Desarrollado por Pablo Guanca**
