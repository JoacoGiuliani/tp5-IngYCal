# AgendaYA TP5

Versión local corregida del prototipo del equipo, módulos M03 y M04.

## Inicio

Desde la carpeta superior, ejecutar INICIAR_TP5.cmd. Mantener Docker Desktop instalado. Python portable se incluye en runtime; no se necesita instalar Python ni bibliotecas.

- Aplicación: http://127.0.0.1:8000
- Kiwi TCMS: http://127.0.0.1:8085
- Buzón de laboratorio Mailpit: http://127.0.0.1:8025

Administrador de AgendaYA: admin / AgendaTP5!2026.
Administrador de Kiwi: admin / KiwiTP5!2026.
Estas credenciales son exclusivas del laboratorio local.

## Pruebas

EJECUTAR_PRUEBAS.cmd valida nueve casos mediante HTTP, incluyendo concurrencia real, persistencia y correo SMTP. resultados_api.json contiene el resultado. CP-007, CP-008 y CP-009 se revisaron en navegador y su evidencia está en evidencias/resultados_ui.json. Los chequeos HTTP no evalúan todos los detalles visuales de los formularios.

Antes de cada caso manual, iniciar sesión en AgendaYA y usar Restaurar datos de prueba. D1=mañana, D2=hoy+2, D3=hoy+8 y D0=hoy+3. Si cambia el mes, seleccionar el mes de la fecha correspondiente. Los datos originales del prototipo se regeneran respecto de la fecha de la restauración.

## Implementación

server.py utiliza la biblioteca estándar de Python, SQLite y una sección protegida por bloqueo para la confirmación de reservas. Envía los mensajes a Mailpit mediante SMTP. No realiza entregas de correo a Internet. Los datos personales de reservas no se incluyen en las rutas públicas.

La confirmación manual genera reservas pendientes; la automática genera reservas confirmadas. La duración se guarda en cada reserva. Los tres eventos iniciales y su disponibilidad son una fixture de laboratorio, no el módulo completo de gestión de disponibilidad.

El estado persiste en data.sqlite3. No publicar esa base ni las cuentas del laboratorio en GitHub. Ver .gitignore.

Repositorio base: https://github.com/JoacoGiuliani/tp5-IngYCal
Versión corregida publicada: https://github.com/JoacoGiuliani/tp5-IngYCal/tree/codex/tp5-entrega
