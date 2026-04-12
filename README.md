# AnyLopez — Clínica Estética Benidorm

Sitio web estático para **AnyLopez Clínica Estética**, ubicada en Benidorm. Migrado desde WordPress a HTML/CSS puro para mayor velocidad, control y facilidad de mantenimiento.

## Páginas

| Archivo | Descripción |
|---|---|
| `index.html` | Página principal con hero, servicios destacados, proceso y testimonios |
| `about.html` | Historia y equipo de la clínica |
| `services.html` | Catálogo completo de tratamientos |
| `radiofrecuencia.html` | Página dedicada al tratamiento Indiba / Radiofrecuencia |
| `contact.html` | Formulario de contacto y datos de localización |

## Tecnologías

- HTML5 semántico
- CSS3 personalizado (`css/styles.css`) — sin frameworks externos
- JavaScript vanilla para el menú móvil

## Estructura

```
anylopez-website/
├── index.html
├── about.html
├── services.html
├── radiofrecuencia.html
├── contact.html
└── css/
    └── styles.css
```

## Uso local

Abre cualquier archivo `.html` directamente en el navegador o sirve la carpeta con cualquier servidor estático:

```bash
# Con Python
python -m http.server 8080

# Con Node (npx)
npx serve .
```

## Contacto clínica

- **Dirección:** C/ Marqués de Comillas 4, Local 6, Benidorm
- **Teléfono:** 656 306 167 / 865 710 769
- **Email:** info@anylopez.com
- **Horario:** Lunes a Viernes, 10–14h / 16–20h
