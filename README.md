# Veteo App - Centro de Gestión de Próximos a Vencer

![Status](https://img.shields.io/badge/Status-Proyecto_Finalizado-blueviolet?style=for-the-badge)
![HTML](https://img.shields.io/badge/HTML-5-E34F26?style=for-the-badge&logo=html5)
![SCSS](https://img.shields.io/badge/SCSS-BEM_Methodology-hotpink?style=for-the-badge&logo=sass)
![JS](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Storage](https://img.shields.io/badge/Storage-LocalStorage-orange?style=for-the-badge&logo=googlechrome)
![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=firebase&logoColor=white)
![Forms](https://img.shields.io/badge/Integración-Google_Forms-4285F4?style=for-the-badge&logo=googleforms)

![License](https://img.shields.io/badge/License-Privado-red?style=for-the-badge)

---

Hub operativo para la gestión de vencimientos de productos.

## Sobre el Proyecto

**Veteo App** nace de la necesidad de centralizar y digitalizar la gestión diaria del stock perecedero. Reemplaza el seguimiento manual y disperso por un 
único lugar donde ver, priorizar y accionar cada producto según su etapa de vencimiento. 

A diferencia de otros métodos, esta herramienta automatiza el flujo de datos desde archivos de sistema (`.txt`) hacia una base de datos dinámica en la nube, brindando una interfaz de usuario (UI) de alta fidelidad orientada a la eficiencia en dispositivos móviles.

## Funcionalidades

- **Vencimientos importados** - archivo (.txt) que se sincroniza con Google Sheets
- **Scanner Integrado** - carga rápida con fecha, etapa y nota
- **Línea de tiempo operativa** - guía visual por etapa (−90, −60, −30, −7 días)
- **Acceso directo a formularios** - PAS, PFT, PCH, Última Milla, Calidad, Rescates
- **Checklist diario** - seguimiento de tareas con reset automático
- **Notificaciones Push** - recordatorio diario todos los días a las 08:00 hs a través de Firebase
- **Tour Interactivo** - onboarding sencillo para los usuarios
- **Multiusuario** - sesión y base de datos única por usuario gracias a Google OAuth

## Tecnologías

| Tecnología | Uso |
|---|---|
| HTML5 | Estructura semántica |
| SCSS + BEM | Estilos y arquitectura CSS |
| JavaScript ES6+ | Lógica, DOM, módulos |
| LocalStorage | Persistencia de datos local |
| Google Apps Scripts | Integración con Sheets y persistencia de datos en la nube |
| Google Forms | Integración con formularios operativos |

### Capacidades Principales exhibidas:

- **Integración de APIs:** Conexión segura con Google Cloud mediante OAuth2.
- **Procesamiento de Datos:** Algoritmos de parseo de texto plano en tiempo real.
- **Lógica de Negocio:** Clasificación automática de acciones (PAS, PFT, PCH) basada en metadatos del producto.
- **Experiencia de Usuario (UX):** Diseño "Mobile-First" con estados de carga, animaciones fluidas y feedback visual inmediato.
- **Notificaciones Push:** Recordatorios diarios via Web Push API, con Google Apps Script como backend intermediario para la sincronización de datos.
---

## 🛠️ Arquitectura Técnica

El proyecto se divide en una arquitectura desacoplada:

1. **Frontend (Cliente):** - Desarrollado en JavaScript Vanilla para garantizar la máxima velocidad de carga.
   - Estructura de estilos modular utilizando **SASS** y variables globales para consistencia visual.
   - Implementación de **Service Workers** para capacidades de PWA.

2. **Backend (Servidor Privado):**
   - Motor basado en **Google Apps Script** (API privada).
   - Lógica de persistencia en Google Sheets con validación de identidad por usuario.

---

## 📊 Resultados e Impacto

- **Reducción de errores:** Eliminación de la carga manual de datos gracias al parser de TXT, escaneo y redirecciones efectivas.
- **Priorización:** Sistema de alertas visuales que enfoca la atención en productos con < 60, < 30, < 7 días de vida.
- **Omnicanalidad:** Acceso instantáneo desde cualquier dispositivo con sesión de Google activa.

---
> Proyecto de uso interno. El código es de autoría propia pero los recursos integrados pertenecen a una organización privada.
---

**Desarrollado por Pablo Guanca**
