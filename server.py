import json,sqlite3,threading,re,smtplib,secrets
from pathlib import Path
from datetime import datetime,timedelta,timezone
from email.message import EmailMessage
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
ROOT=Path(__file__).parent
DB=ROOT/'data.sqlite3'
TZ=timezone(timedelta(hours=-3)); LOCK=threading.Lock(); SESSIONS=set()
def seed():
 now=datetime.now(TZ); days=[(now+timedelta(days=i)).date().isoformat() for i in (1,2,8)]
 def event(i,n,d,m,c,f=0): return dict(id=i,name=n,duration=d,modality=m,confirmation=c,description='Primera entrevista.' if i==1 else '',location='https://meet.google.com/agenda-tp5' if m=='Virtual' else 'Av. Universidad 100',active=True,futureReservations=f)
 return dict(events=[event(1,'Consulta Inicial',30,'Virtual','Automática'),event(2,'Entrevista Técnica',45,'Presencial','Manual',2),event(3,'Consulta Rápida',15,'Virtual','Automática')],availability={days[0]:['09:00','10:30','15:00'],days[1]:['11:00','14:00'],days[2]:['16:00']},reservedSlots=[dict(date=days[0],time='10:30')],reservations=[],nextId=4)
def connect():
 c=sqlite3.connect(DB); c.execute('CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY,data TEXT)')
 if not c.execute('SELECT 1 FROM state').fetchone(): c.execute('INSERT INTO state VALUES(1,?)',(json.dumps(seed()),)); c.commit()
 return c
def load(c): return json.loads(c.execute('SELECT data FROM state WHERE id=1').fetchone()[0])
def save(c,s): c.execute('UPDATE state SET data=? WHERE id=1',(json.dumps(s),)); c.commit()
def future(d,t): return datetime.fromisoformat(d+'T'+t).replace(tzinfo=TZ)>datetime.now(TZ)
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT),**kw)
 def response(self,v,status=200):
  b=json.dumps(v,ensure_ascii=False).encode(); self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Cache-Control','no-store'); self.end_headers(); self.wfile.write(b)
 def do_GET(self):
  if self.path=='/api/state':
   with LOCK,connect() as c:
    s=load(c); s.pop('reservations'); s['now']=datetime.now(TZ).isoformat(); self.response(s)
  elif self.path.split('?')[0] in ('/','/index.html','/app.js','/styles.css'): super().do_GET()
  else: self.send_error(404)
 def do_POST(self):
  try:
   d=json.loads(self.rfile.read(int(self.headers.get('Content-Length',0))))
   if self.path=='/api/login':
    if d.get('user')!='admin' or d.get('password')!='AgendaTP5!2026': return self.response({'errors':['Credenciales inválidas.']},401)
    token=secrets.token_urlsafe(24); SESSIONS.add(token); return self.response({'token':token})
   if self.path in ('/api/event','/api/delete','/api/reset') and self.headers.get('X-Admin-Token') not in SESSIONS: return self.response({'errors':['Debe iniciar sesión como administrador.']},401)
   with LOCK,connect() as c:
    s=load(c); errors=[]
    if self.path=='/api/reset': save(c,seed()); return self.response({'ok':True})
    if self.path=='/api/event':
     name=str(d.get('name','')).strip(); desc=str(d.get('description','')); duration=d.get('duration')
     if not name: errors.append('El nombre del tipo de evento es obligatorio.')
     if not isinstance(duration,(int,float)) or duration<=0 or duration!=int(duration): errors.append('La duración debe ser mayor a 0 y expresarse en minutos enteros.')
     if len(desc)>500: errors.append('La descripción no puede superar los 500 caracteres.')
     if d.get('modality') not in ('Virtual','Presencial'): errors.append('Debe seleccionar una modalidad.')
     if d.get('confirmation') not in ('Automática','Manual'): errors.append('Debe seleccionar el tipo de confirmación.')
     if not str(d.get('location','')).strip(): errors.append('Debe ingresar un enlace o dirección según la modalidad.')
     if any(e['active'] and e['id']!=d.get('id') and e['name'].casefold()==name.casefold() for e in s['events']): errors.append('Ya tienes un evento con ese nombre.')
     if errors: return self.response({'errors':errors},400)
     e=next((e for e in s['events'] if e['id']==d.get('id') and e['active']),None)
     if d.get('id') and not e: return self.response({'errors':['Evento no disponible.']},404)
     if not e: e=dict(id=s['nextId'],active=True,futureReservations=0); s['nextId']+=1; s['events'].append(e)
     e.update(name=name,duration=int(duration),modality=d['modality'],confirmation=d['confirmation'],description=desc,location=d['location'])
    elif self.path=='/api/delete':
     e=next((e for e in s['events'] if e['id']==d.get('id') and e['active']),None)
     if not e: return self.response({'errors':['Evento no disponible.']},404)
     booked=sum(r['eventId']==e['id'] and future(r['date'],r['time']) for r in s['reservations'])
     if e['futureReservations']+booked: return self.response({'errors':['No se puede eliminar el tipo de evento porque posee reservas futuras asociadas.']},409)
     e['active']=False
    elif self.path=='/api/reserve':
     e=next((e for e in s['events'] if e['id']==d.get('eventId') and e['active']),None); date=d.get('date',''); time=d.get('time','')
     if not str(d.get('name','')).strip(): errors.append('Por favor completar los campos obligatorios.')
     if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',str(d.get('email',''))): errors.append('Debe ingresar un correo electrónico válido.')
     if d.get('phone') and not re.fullmatch(r'\+?\d+',d['phone']): errors.append('El teléfono solo admite números y + inicial.')
     if len(d.get('notes',''))>300: errors.append('La nota no puede superar los 300 caracteres.')
     if not e or time not in s['availability'].get(date,[]): errors.append('Debe seleccionar evento, fecha y horario disponibles.')
     elif not future(date,time): errors.append('No se puede reservar un horario pasado.')
     if any(r['date']==date and r['time']==time for r in s['reservedSlots']): errors.append('Horario ya reservado.')
     if errors: return self.response({'errors':errors},409 if 'Horario ya reservado.' in errors else 400)
     r=dict(d,id=len(s['reservations'])+1,duration=e['duration'],status='Confirmada' if e['confirmation']=='Automática' else 'Pendiente')
     try:
      with smtplib.SMTP('127.0.0.1',1025,timeout=5) as smtp:
       for recipient in (d['email'],'administrador@agendaya.test'):
        m=EmailMessage(); m['From']='reservas@agendaya.test'; m['To']=recipient; m['Subject']='AgendaYA reserva '+r['status']; m.set_content(f"{e['name']}\n{date} {time} GMT-3\nDuración: {r['duration']} minutos\nEstado: {r['status']}\nNotas: {d.get('notes','')}"); smtp.send_message(m)
     except (OSError,smtplib.SMTPException): return self.response({'errors':['No fue posible enviar la notificación. Intente nuevamente.']},503)
     s['reservations'].append(r); s['reservedSlots'].append(dict(date=date,time=time)); save(c,s); return self.response({'ok':True,'reservation':r})
    else: return self.response({'errors':['Ruta inexistente.']},404)
    save(c,s); self.response({'ok':True})
  except (ValueError,TypeError,KeyError): self.response({'errors':['Datos de solicitud inválidos.']},400)
if __name__=='__main__':
 connect().close(); print('AgendaYA http://127.0.0.1:8000',flush=True); ThreadingHTTPServer(('127.0.0.1',8000),Handler).serve_forever()
