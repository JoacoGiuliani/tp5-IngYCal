const state = {
  events: [
    {
      id: 1,
      name: 'Consulta Inicial',
      duration: 30,
      modality: 'Virtual',
      confirmation: 'Automática',
      description: 'Primera entrevista para conocer la necesidad del cliente.',
      active: true,
      futureReservations: 0
    },
    {
      id: 2,
      name: 'Entrevista Técnica',
      duration: 45,
      modality: 'Presencial',
      confirmation: 'Manual',
      description: 'Reunión presencial con validación manual del administrador.',
      active: true,
      futureReservations: 2
    }
  ],
  availability: {
    '2026-07-07': ['09:00', '10:30', '15:00'],
    '2026-07-08': ['11:00', '14:00'],
    '2026-07-15': ['16:00']
  },
  reservedSlots: [{ date: '2026-07-07', time: '10:30' }],
  selectedEventId: null,
  selectedDate: null,
  selectedTime: null,
  nextId: 3
};

const qs = (id) => document.getElementById(id);

function setMessage(id, text, type = 'ok') {
  const el = qs(id);
  el.textContent = text;
  el.className = `message ${type}`;
}

function clearInvalid(...ids) {
  ids.forEach(id => qs(id).classList.remove('invalid'));
}

function validateEventForm(isEditing) {
  clearInvalid('event-name', 'event-duration', 'event-modality', 'event-description');
  const name = qs('event-name').value.trim();
  const duration = Number(qs('event-duration').value);
  const modality = qs('event-modality').value;
  const description = qs('event-description').value.trim();
  const id = Number(qs('event-id').value);
  const errors = [];

  if (!name) {
    qs('event-name').classList.add('invalid');
    errors.push('El nombre del tipo de evento es obligatorio.');
  }
  if (!duration || duration <= 0) {
    qs('event-duration').classList.add('invalid');
    errors.push('La duración debe ser mayor a 0.');
  }
  if (!modality) {
    qs('event-modality').classList.add('invalid');
    errors.push('Debe seleccionar una modalidad.');
  }
  if (description.length > 500) {
    qs('event-description').classList.add('invalid');
    errors.push('La descripción no puede superar los 500 caracteres.');
  }
  const duplicated = state.events.some(e => e.id !== id && e.active && e.name.toLowerCase() === name.toLowerCase());
  if (!isEditing && duplicated) {
    qs('event-name').classList.add('invalid');
    errors.push('Ya tienes un evento con ese nombre.');
  }
  return { ok: errors.length === 0, errors, name, duration, modality, description };
}

function renderEvents() {
  const list = qs('events-list');
  list.innerHTML = '';
  state.events.filter(e => e.active).forEach(event => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h4>${event.name}</h4>
      <p>${event.duration} min - ${event.modality} - Confirmación ${event.confirmation}</p>
      <p>${event.description || 'Sin descripción pública.'}</p>
      <p>Reservas futuras asociadas: ${event.futureReservations}</p>
      <div class="row">
        <button type="button" onclick="editEvent(${event.id})">Editar</button>
        <button type="button" class="delete" onclick="deleteEvent(${event.id})">Eliminar</button>
      </div>`;
    list.appendChild(card);
  });
  renderBookingEvents();
}

function renderBookingEvents() {
  const select = qs('booking-event');
  select.innerHTML = '<option value="">Seleccione un evento</option>';
  state.events.filter(e => e.active).forEach(event => {
    const option = document.createElement('option');
    option.value = event.id;
    option.textContent = `${event.name} (${event.duration} min)`;
    select.appendChild(option);
  });
}

function resetEventForm() {
  qs('event-id').value = '';
  qs('event-name').value = '';
  qs('event-duration').value = '';
  qs('event-modality').value = '';
  qs('event-confirmation').value = 'Automática';
  qs('event-description').value = '';
  qs('save-event').textContent = 'Guardar evento';
  setMessage('event-message', '', 'ok');
  clearInvalid('event-name', 'event-duration', 'event-modality', 'event-description');
}

function editEvent(id) {
  const event = state.events.find(e => e.id === id);
  qs('event-id').value = event.id;
  qs('event-name').value = event.name;
  qs('event-duration').value = event.duration;
  qs('event-modality').value = event.modality;
  qs('event-confirmation').value = event.confirmation;
  qs('event-description').value = event.description;
  qs('save-event').textContent = 'Guardar cambios';
  setMessage('event-message', 'Evento cargado para edición.', 'ok');
}

function deleteEvent(id) {
  const event = state.events.find(e => e.id === id);
  if (event.futureReservations > 0) {
    setMessage('event-message', 'No se puede eliminar el tipo de evento porque posee reservas futuras asociadas.', 'error');
    return;
  }
  if (confirm(`¿Confirma la eliminación lógica de ${event.name}?`)) {
    event.active = false;
    setMessage('event-message', 'Tipo de evento eliminado correctamente. Ya no está disponible para nuevas reservas.', 'ok');
    renderEvents();
  }
}

qs('event-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const isEditing = Boolean(qs('event-id').value);
  const data = validateEventForm(isEditing);
  if (!data.ok) {
    setMessage('event-message', data.errors.join(' '), 'error');
    return;
  }
  if (isEditing) {
    const event = state.events.find(e => e.id === Number(qs('event-id').value));
    event.name = data.name;
    event.duration = data.duration;
    event.modality = data.modality;
    event.confirmation = qs('event-confirmation').value;
    event.description = data.description;
    setMessage('event-message', 'Cambios guardados correctamente. Las reservas futuras aplicarán la nueva configuración.', 'ok');
  } else {
    state.events.push({
      id: state.nextId++,
      name: data.name,
      duration: data.duration,
      modality: data.modality,
      confirmation: qs('event-confirmation').value,
      description: data.description,
      active: true,
      futureReservations: 0
    });
    setMessage('event-message', 'Evento creado correctamente y disponible para reserva pública.', 'ok');
  }
  renderEvents();
  resetEventForm();
});

qs('reset-form').addEventListener('click', resetEventForm);

function renderCalendar() {
  const calendar = qs('calendar');
  calendar.innerHTML = '';
  for (let day = 1; day <= 31; day++) {
    const date = `2026-07-${String(day).padStart(2, '0')}`;
    const available = (state.availability[date] || []).some(time => !isReserved(date, time));
    const el = document.createElement('div');
    el.className = `day ${available ? 'available' : ''}`;
    el.textContent = day;
    if (available) {
      el.onclick = () => selectDate(date, el);
    } else {
      el.onclick = () => setMessage('calendar-message', 'Este día no está disponible, por favor seleccione otro.', 'error');
    }
    calendar.appendChild(el);
  }
}

function isReserved(date, time) {
  return state.reservedSlots.some(slot => slot.date === date && slot.time === time);
}

function selectDate(date, el) {
  if (!state.selectedEventId) {
    setMessage('calendar-message', 'Primero debe seleccionar un tipo de evento.', 'error');
    return;
  }
  document.querySelectorAll('.day').forEach(d => d.classList.remove('selected'));
  el.classList.add('selected');
  state.selectedDate = date;
  state.selectedTime = null;
  setMessage('calendar-message', `Fecha seleccionada: ${date}`, 'ok');
  renderSlots();
  updateSummary();
}

function renderSlots() {
  const container = qs('slots');
  container.innerHTML = '';
  const slots = (state.availability[state.selectedDate] || []).filter(time => !isReserved(state.selectedDate, time));
  if (slots.length === 0) {
    setMessage('slot-message', 'No hay horarios disponibles para la fecha seleccionada.', 'error');
    return;
  }
  setMessage('slot-message', 'Horarios mostrados en: Argentina (GMT-3).', 'ok');
  slots.forEach(time => {
    const el = document.createElement('div');
    el.className = 'slot';
    el.textContent = time;
    el.onclick = () => selectSlot(time, el);
    container.appendChild(el);
  });
}

function selectSlot(time, el) {
  document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  state.selectedTime = time;
  setMessage('slot-message', `Horario seleccionado: ${time}`, 'ok');
  updateSummary();
}

function updateSummary() {
  const event = state.events.find(e => e.id === state.selectedEventId);
  if (!event || !state.selectedDate || !state.selectedTime) {
    qs('reservation-summary').textContent = 'Seleccione evento, día y horario.';
    return;
  }
  qs('reservation-summary').textContent = `${event.name} - ${event.duration} min - ${state.selectedDate} a las ${state.selectedTime}`;
}

qs('booking-event').addEventListener('change', () => {
  state.selectedEventId = Number(qs('booking-event').value);
  state.selectedDate = null;
  state.selectedTime = null;
  setMessage('calendar-message', state.selectedEventId ? 'Evento seleccionado. El calendario muestra solo días con disponibilidad.' : '', 'ok');
  renderCalendar();
  qs('slots').innerHTML = '';
  updateSummary();
});

function validateReservation() {
  clearInvalid('guest-name', 'guest-email');
  const name = qs('guest-name').value.trim();
  const email = qs('guest-email').value.trim();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const errors = [];
  if (!state.selectedEventId || !state.selectedDate || !state.selectedTime) errors.push('Debe seleccionar evento, fecha y horario.');
  if (!name) { qs('guest-name').classList.add('invalid'); errors.push('El nombre completo es obligatorio.'); }
  if (!email || !validEmail) { qs('guest-email').classList.add('invalid'); errors.push('Debe ingresar un correo electrónico válido.'); }
  if (state.selectedDate && state.selectedTime && isReserved(state.selectedDate, state.selectedTime)) errors.push('Horario ya reservado.');
  return { ok: errors.length === 0, errors };
}

qs('reservation-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const validation = validateReservation();
  if (!validation.ok) {
    setMessage('reservation-message', validation.errors.join(' '), 'error');
    return;
  }
  state.reservedSlots.push({ date: state.selectedDate, time: state.selectedTime });
  setMessage('reservation-message', 'Reserva confirmada. Se enviaron las notificaciones al usuario y al administrador.', 'ok');
  renderCalendar();
  renderSlots();
});

renderEvents();
renderCalendar();
