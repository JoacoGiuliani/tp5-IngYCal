# AgendaYA - Prototipo TP5

Este prototipo contiene la codificación mínima para ejecutar los casos de prueba del TP5 sobre los módulos M03 y M04.

## Cómo ejecutarlo localmente

Opción simple:
1. Descomprimir el ZIP.
2. Abrir `index.html` con Google Chrome, Firefox o Edge.

Opción recomendada:
1. Abrir una terminal dentro de esta carpeta.
2. Ejecutar:

```bash
python -m http.server 8000
```

3. Entrar a `http://localhost:8000` desde el navegador.

## Funcionalidades implementadas

- Crear tipo de evento.
- Editar tipo de evento.
- Eliminar tipo de evento con validación de reservas futuras.
- Visualizar calendario público con días disponibles.
- Seleccionar franja horaria disponible.
- Confirmar reserva con validaciones de nombre y correo.

## Evidencia sugerida

Tomar capturas de:
- Pantalla de creación de evento con mensaje de éxito.
- Validaciones de campos obligatorios.
- Calendario con días habilitados y deshabilitados.
- Selección de horario.
- Confirmación de reserva.
- Código `app.js` donde se observan las validaciones principales.
