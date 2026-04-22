# 🏆 Veteo App - Centro de Gestión de Vencimientos

**Veteo App** es una solución tecnológica avanzada diseñada para la optimización de procesos operativos en el control de productos críticos. Este proyecto ha sido desarrollado como una **Prueba de Concepto (PoC)** para demostrar la integración de tecnologías web modernas con ecosistemas de productividad de Google.

![Versión](https://img.shields.io/badge/Status-Proyecto_Finalizado-blueviolet?style=for-the-badge)
![JS](https://img.shields.io/badge/JavaScript-ES6+-yellow?style=for-the-badge&logo=javascript)
![SCSS](https://img.shields.io/badge/Architecture-BEM_Methodology-hotpink?style=for-the-badge&logo=sass)

---

## Sobre el Proyecto

Veteo App nace de la necesidad de digitalizar el control de stock perecedero. A diferencia de los métodos tradicionales, esta herramienta automatiza el flujo de datos desde archivos de sistema (`.txt`) hacia una base de datos dinámica en la nube, proporcionando una interfaz de usuario (UI) de alta fidelidad orientada a la eficiencia en dispositivos móviles.

### Capacidades Principales exhibidas:
- **Integración de APIs:** Conexión segura con Google Cloud mediante OAuth2.
- **Procesamiento de Datos:** Algoritmos de parseo de texto plano en tiempo real.
- **Lógica de Negocio:** Clasificación automática de acciones (PAS, PFT, PCH) basada en metadatos del producto.
- **Experiencia de Usuario (UX):** Diseño "Mobile-First" con estados de carga, animaciones fluidas y feedback visual inmediato.

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

## ⚠️ Nota de Propiedad Intelectual

> [!CAUTION]
> **Aviso de Uso:** Este repositorio se publica exclusivamente con fines de **exhibición de portfolio**. El código fuente, la arquitectura y los activos visuales son propiedad del autor. No se autoriza la clonación, distribución o uso de este software para fines comerciales o personales sin consentimiento explícito.

---

## 📊 Resultados e Impacto
- **Reducción de errores:** Eliminación de la carga manual de datos gracias al parser de TXT.
- **Priorización:** Sistema de alertas visuales que enfoca la atención en productos con < 60, < 30, < 7 días de vida.
- **Omnicanalidad:** Acceso instantáneo desde cualquier dispositivo con sesión de Google activa.

---

**Desarrollado por Pablo Guanca**