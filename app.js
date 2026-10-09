let state;
let token = sessionStorage.getItem("adminToken") || "";
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

function escapeHtml(v) { const e=document.createElement('span');e.textContent=String(v);return e.innerHTML; }
function renderEvents() {
  const list = qs('events-list');
  list.innerHTML = '';
  state.events.filter(e => e.active).forEach(event => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h4>${escapeHtml(event.name)}</h4>
      <p>${event.duration} min - ${event.modality} - Confirmación ${event.confirmation}</p>
      <p>${escapeHtml(event.description || 'Sin descripción pública.')}</p>
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
  const previous = state.selectedEventId;
  const select = qs('booking-event');
  select.innerHTML = '<option value="">Seleccione un evento</option>';
  state.events.filter(e => e.active).forEach(event => {
    const option = document.createElement('option');
    option.value = event.id;
    option.textContent = `${event.name} (${event.duration} min)`;
    select.appendChild(option);
  });
  select.value = previous || "";
}

function resetEventForm() {
  qs('event-id').value = '';
  qs('event-name').value = '';
  qs('event-duration').value = '';
  qs('event-modality').value = '';
  qs('event-confirmation').value = 'Automática';
  qs('event-description').value = '';
  qs('event-location').value = '';
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
  qs('event-location').value = event.location;
  qs('save-event').textContent = 'Guardar cambios';
  setMessage('event-message', 'Evento cargado para edición.', 'ok');
}

async function deleteEvent(id) {
  const event = state.events.find(e => e.id === id);
  if (event.futureReservations > 0) {
    setMessage('event-message', 'No se puede eliminar el tipo de evento porque posee reservas futuras asociadas.', 'error');
    return;
  }
  if (confirm(`¿Confirma la eliminación lógica de ${event.name}?`)) {
    const response = await api("delete", {id});
    if (!response.ok) return setMessage("event-message",response.errors.join(" "),"error");
    await refresh();
    setMessage('event-message', 'Tipo de evento eliminado correctamente. Ya no está disponible para nuevas reservas.', 'ok');
    renderEvents();
  }
}

qs('event-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const isEditing = Boolean(qs('event-id').value);
  const data = validateEventForm(isEditing);
  if (!data.ok) {
    setMessage('event-message', data.errors.join(' '), 'error');
    return;
  }
  const response = await api('event', {...data,id:isEditing?Number(qs('event-id').value):null,confirmation:qs('event-confirmation').value,location:qs('event-location').value});
  if (!response.ok) return setMessage('event-message',response.errors.join(' '),'error');
  await refresh(); renderEvents(); resetEventForm();
  setMessage('event-message',isEditing?'Cambios guardados correctamente.':'Evento creado correctamente.','ok');
});

qs('reset-form').addEventListener('click', resetEventForm);

function renderCalendar() {
  const calendar = qs('calendar');
  calendar.innerHTML = '';
  const now = new Date(state.now); const y=Number(qs('month').value.slice(0,4)); const m=Number(qs('month').value.slice(5));
  qs('calendar-title').textContent = new Date(y,m-1,1).toLocaleDateString('es-AR',{month:'long',year:'numeric'});
  for(let i=0;i<new Date(y,m-1,1).getDay();i++) calendar.appendChild(document.createElement('span'));
  for (let day = 1; day <= new Date(y,m,0).getDate(); day++) {
    const date = `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const available = Boolean(state.selectedEventId) && (state.availability[date] || []).some(time => !isReserved(date, time) && isFuture(date,time));
    const el = document.createElement('button');
    el.type='button'; el.dataset.date=date; el.setAttribute('aria-label',available?String(day):String(day)+' sin disponibilidad');
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
  const slots = (state.availability[state.selectedDate] || []).filter(time => !isReserved(state.selectedDate, time) && isFuture(state.selectedDate,time));
  if (slots.length === 0) {
    setMessage('slot-message', 'No hay horarios disponibles para la fecha seleccionada.', 'error');
    return;
  }
  setMessage('slot-message', 'Horarios mostrados en: Argentina (GMT-3).', 'ok');
  slots.forEach(time => {
    const el = document.createElement('button');
    el.type='button'; el.dataset.time=time;
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
  if (!name) { qs('guest-name').classList.add('invalid'); errors.push('Por favor completar los campos obligatorios.'); }
  if (!email || !validEmail) { qs('guest-email').classList.add('invalid'); errors.push('Debe ingresar un correo electrónico válido.'); }
  if (state.selectedDate && state.selectedTime && isReserved(state.selectedDate, state.selectedTime)) errors.push('Horario ya reservado.');
  return { ok: errors.length === 0, errors };
}

qs('reservation-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const validation = validateReservation();
  if (!validation.ok) {
    setMessage('reservation-message', validation.errors.join(' '), 'error');
    return;
  }
  const response = await api('reserve',{eventId:state.selectedEventId,date:state.selectedDate,time:state.selectedTime,name:qs('guest-name').value.trim(),email:qs('guest-email').value.trim(),phone:qs('guest-phone').value.trim(),notes:qs('guest-notes').value});
  if(!response.ok) { await refresh(); renderCalendar(); renderSlots(); return setMessage('reservation-message',response.errors.join(' '),'error'); }
  const r=response.reservation;
  setMessage('reservation-message',`Reserva ${r.status.toLowerCase()}. ${r.date} ${r.time}, ${r.duration} min. Notificaciones enviadas al buzón de laboratorio.`,'ok');
  await refresh(); state.selectedTime=null; renderCalendar(); renderSlots();
});

function isFuture(date,time) { return new Date(date+'T'+time+':00-03:00') > new Date(state.now); }
async function api(route,data) {
  try { const res=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Token':token},body:JSON.stringify(data)}); return await res.json(); }
  catch { return {errors:['No se pudo conectar con el servidor.']}; }
}
async function refresh() { const current=state||{}; const data=await (await fetch('/api/state')).json(); state={...data,selectedEventId:current.selectedEventId||null,selectedDate:current.selectedDate||null,selectedTime:current.selectedTime||null}; }
qs('login-form').addEventListener('submit',async ev=>{ev.preventDefault();const r=await api('login',{user:qs('login-user').value,password:qs('login-password').value});if(r.token){token=r.token;sessionStorage.setItem('adminToken',token);qs('admin-panel').hidden=false;setMessage('login-message','Sesión de administrador iniciada.');}else setMessage('login-message',r.errors.join(' '),'error');});
qs('reset-data').onclick=async()=>{if(!confirm('¿Restaurar los datos de prueba? Se eliminarán las reservas del prototipo.'))return;const r=await api('reset',{});if(r.ok)location.reload();else setMessage('event-message',r.errors.join(' '),'error');};
qs('month').onchange=()=>{state.selectedDate=null;state.selectedTime=null;renderCalendar();qs('slots').innerHTML='';updateSummary();};
async function init(){await refresh();qs('month').value=state.now.slice(0,7);qs('admin-panel').hidden=!token;renderEvents();renderCalendar();}
init();
