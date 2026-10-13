# AnyLopez — Clínica Estética Benidorm

Sitio web estático para **AnyLopez Clínica Estética**, ubicada en Benidorm. Migrado desde WordPress a HTML/CSS puro y posteriormente a **Eleventy (11ty) v3** para mayor velocidad, control y facilidad de mantenimiento.

## Tecnologías

- [Eleventy v3](https://www.11ty.dev/) — generador de sitios estáticos
- Nunjucks (`.njk`) como motor de plantillas
- CSS3 personalizado (`css/styles.css`) — sin frameworks externos
- JavaScript vanilla para el menú móvil
- GitHub Actions para CI/CD → Hostalia (producción) y GitHub Pages (solo redirecciones)

## Estructura

```
anylopez-website/
├── .github/
│   └── workflows/
│       ├── deploy-hostalia.yml  # Build + despliegue a Hostalia (producción)
│       └── deploy.yml           # Redirecciones a anylopez.com en GitHub Pages
├── src/
│   ├── _includes/
│   │   └── base.njk         # Layout base compartido por todas las páginas
│   ├── index.njk
│   ├── about.njk
│   ├── services.njk
│   ├── radiofrecuencia.njk
│   └── contact.njk
├── css/
│   └── styles.css
├── _site/                   # Output generado (ignorado en git)
├── .eleventy.js             # Configuración de Eleventy (pathPrefix incluido)
└── package.json
```

## Páginas

| Archivo | Descripción |
|---|---|
| `src/index.njk` | Página principal con hero, servicios destacados, proceso y testimonios |
| `src/about.njk` | Historia y equipo de la clínica |
| `src/services.njk` | Catálogo completo de tratamientos |
| `src/radiofrecuencia.njk` | Página dedicada al tratamiento Indiba / Radiofrecuencia |
| `src/contact.njk` | Formulario de contacto y datos de localización |

## Uso local

```bash
npm install
npm run serve   # Arranca servidor en http://localhost:8080
```

## Build y despliegue

El build se ejecuta automáticamente en cada push a `master` mediante GitHub Actions:

1. Instala dependencias (`npm ci`)
2. Genera el sitio (`npm run build` → `_site/`)
3. `deploy-hostalia.yml` lo sube por FTPS a Hostalia, que es producción
4. `deploy.yml` publica en GitHub Pages solo páginas de redirección hacia `anylopez.com` (`scripts/build-redirects.mjs`), para que los enlaces antiguos sigan llegando

**URL de producción:** https://anylopez.com

La dirección antigua, https://raulgogna.github.io/anylopez-website/, solo redirige.

## Contacto clínica

- **Dirección:** C/ Marqués de Comillas 4, Local 6, Benidorm
- **Teléfono:** 656 306 167 / 865 710 769
- **Email:** info@anylopez.com
- **Horario:** Lunes a Viernes, 10–14h / 16–20h
