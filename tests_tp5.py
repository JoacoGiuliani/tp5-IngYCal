import sys
sys.stdout.reconfigure(encoding="utf-8")
import json,urllib.request,urllib.error,time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
BASE='http://127.0.0.1:8000/api/'; token=''; results=[]
def req(route,data=None):
 headers={'Content-Type':'application/json','X-Admin-Token':token}
 r=urllib.request.Request(BASE+route,data=json.dumps(data).encode() if data is not None else None,headers=headers)
 try:
  with urllib.request.urlopen(r) as res: return res.status,json.load(res)
 except urllib.error.HTTPError as e: return e.code,json.load(e)
def state(): return req('state')[1]
def reset(): assert req('reset',{})[0]==200
_,login=req('login',{'user':'admin','password':'AgendaTP5!2026'});token=login['token']
def event(**kw):
 return dict(name='Orientación Inicial',duration=30,modality='Virtual',confirmation='Automática',description='Primera entrevista.',location='https://meet.google.com/orientacion-tp5',**kw)
def booking(date,**kw):
 d=dict(eventId=1,date=date,time='09:00',name='Ana Pérez',email='ana.perez@example.test',phone='+5492615554444',notes='Solicito una primera consulta.');d.update(kw);return d
def record(cp,func):
 started=time.perf_counter();reset()
 try: info=func();results.append(dict(id=cp,status='PASSED',detail=info,seconds=round(time.perf_counter()-started,3),method='API HTTP con comprobación de estado persistido'))
 except Exception as e: results.append(dict(id=cp,status='FAILED',detail=str(e)))
def cp1():
 assert req('event',event())[0]==200; s=state();assert len(s['events'])==4 and s['events'][-1]['name']=='Orientación Inicial';return 'Alta persistida y disponible en API pública.'
def cp2():
 for n,d in [('',30),('Alta inválida',0),('Alta inválida',-1)]:
  v=event();v.update(name=n,duration=d);code,r=req('event',v);assert code==400 and r['errors']
 assert len(state()['events'])==3;return 'Tres variantes rechazadas sin registrar eventos.'
def cp3():
 v=event();v.update(id=1,name='Consulta de Seguimiento',duration=45,modality='Presencial',confirmation='Manual',location='Av. Universidad 100',description='Seguimiento presencial.')
 assert req('event',v)[0]==200; e=state()['events'][0]; assert (e['name'],e['duration'],e['modality'],e['confirmation'])==('Consulta de Seguimiento',45,'Presencial','Manual');return 'Edición persistida y expuesta al selector público.'
def cp4():
 old=state()['events'][0];v=dict(old,description='A'*501);code,r=req('event',v);assert code==400 and '500' in r['errors'][0];assert state()['events'][0]==old;return '501 caracteres rechazados sin modificar el evento.'
def cp5():
 assert req('delete',{'id':3})[0]==200;assert not state()['events'][2]['active'];return 'Eliminación lógica persistida.'
def cp6():
 assert req('delete',{'id':2})[0]==409;assert state()['events'][1]['active'];return 'Eliminación bloqueada por dos reservas futuras de fixture.'
def cp10():
 date=sorted(state()['availability'])[0];a=booking(date);b=booking(date,name='Bruno Díaz',email='bruno.diaz@example.test');
 with ThreadPoolExecutor(2) as pool: out=list(pool.map(lambda d:req('reserve',d),[a,b]))
 assert sorted(x[0] for x in out)==[200,409];assert sum(x['date']==date and x['time']=='09:00' for x in state()['reservedSlots'])==1;return 'Dos confirmaciones concurrentes: una aceptada y otra 409 Horario ya reservado.'
def cp11():
 date=sorted(state()['availability'])[0];before=json.load(urllib.request.urlopen('http://127.0.0.1:8025/api/v1/messages'))['total'];code,r=req('reserve',booking(date));assert code==200 and r['reservation']['status']=='Confirmada' and r['reservation']['duration']==30
 after=json.load(urllib.request.urlopen('http://127.0.0.1:8025/api/v1/messages'));assert after['total']==before+2;assert any(x['date']==date and x['time']=='09:00' for x in state()['reservedSlots']);return 'Reserva persistida; dos correos capturados en SMTP Mailpit; turno ocupado.'
def cp12():
 date=sorted(state()['availability'])[0];before=state()['reservedSlots'];mail=json.load(urllib.request.urlopen('http://127.0.0.1:8025/api/v1/messages'))['total']
 for d in [booking(date,name=''),booking(date,email='usuario-sin-arroba')]: assert req('reserve',d)[0]==400
 assert state()['reservedSlots']==before;assert json.load(urllib.request.urlopen('http://127.0.0.1:8025/api/v1/messages'))['total']==mail;return 'Variantes de nombre y correo rechazadas; sin reserva ni correos.'
for cp,fn in [('CP-001',cp1),('CP-002',cp2),('CP-003',cp3),('CP-004',cp4),('CP-005',cp5),('CP-006',cp6),('CP-010',cp10),('CP-011',cp11),('CP-012',cp12)]:record(cp,fn)
reset();(Path(__file__).parent/'resultados_api.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(results,ensure_ascii=False,indent=2));print('Datos restaurados para demostración')

sys.exit(1 if any(r["status"]!="PASSED" for r in results) else 0)
