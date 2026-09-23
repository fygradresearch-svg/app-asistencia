"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Detail = { weekday:number; morningEnabled:boolean; morningEntryTime:string|null; morningExitTime:string|null; afternoonEnabled:boolean; afternoonEntryTime:string|null; afternoonExitTime:string|null };
type SavedWeek = { weekStart:string; weekEnd:string };
const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const currentMonday = () => { const date=new Date(); date.setDate(date.getDate()-((date.getDay()+6)%7)); return date.toISOString().slice(0,10); };
const createBlank = ():Detail[] => days.map((_, index) => ({ weekday:index+1, morningEnabled:index<5, morningEntryTime:"08:00", morningExitTime:"13:00", afternoonEnabled:index<5, afternoonEntryTime:"14:00", afternoonExitTime:"19:00" }));
const clean = (items:Detail[]) => items.map(item => ({...item,morningEntryTime:item.morningEntryTime?.slice(0,5)??null,morningExitTime:item.morningExitTime?.slice(0,5)??null,afternoonEntryTime:item.afternoonEntryTime?.slice(0,5)??null,afternoonExitTime:item.afternoonExitTime?.slice(0,5)??null}));

export default function WeeklySchedulesPage() {
  const { id } = useParams<{id:string}>();
  const [week, setWeek] = useState(currentMonday());
  const [details, setDetails] = useState<Detail[]>(createBlank());
  const [savedWeeks, setSavedWeeks] = useState<SavedWeek[]>([]);
  const [message, setMessage] = useState("");

  const loadWeeks = useCallback(async () => { const data=await fetch(`/api/admin/workers/${id}/weekly-schedules?list=1`).then(r=>r.json()); setSavedWeeks(data.schedules??[]); }, [id]);
  useEffect(() => { void loadWeeks(); }, [loadWeeks]);
  useEffect(() => { void fetch(`/api/admin/workers/${id}/weekly-schedules?week=${week}`).then(r=>r.json()).then(data => { setDetails(data.details?.length ? clean(data.details) : createBlank()); setMessage(data.details?.length ? "Semana guardada cargada: puedes modificarla y volver a guardar." : "Nueva semana: configura sus turnos y guarda."); }); }, [id, week]);
  const update = (weekday:number, patch:Partial<Detail>) => setDetails(old => old.map(day => day.weekday===weekday ? {...day,...patch} : day));
  async function save() { const response=await fetch(`/api/admin/workers/${id}/weekly-schedules`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({weekStart:week,details})}); setMessage(response.ok ? "Semana guardada. Puedes volver cuando quieras para modificarla." : "No se pudo guardar la semana."); if(response.ok) void loadWeeks(); }
  async function copyPrevious() { const previous=new Date(`${week}T12:00:00Z`); previous.setUTCDate(previous.getUTCDate()-7); const data=await fetch(`/api/admin/workers/${id}/weekly-schedules?week=${previous.toISOString().slice(0,10)}`).then(r=>r.json()); if(data.details?.length){setDetails(clean(data.details));setMessage("Horario de la semana anterior copiado. Guarda para aplicarlo a esta semana.");}else setMessage("No hay una semana anterior guardada para copiar."); }

  return <main className="p-4"><section className="mx-auto max-w-5xl"><Link href="/admin/workers" className="text-sm font-medium text-emerald-700">← Trabajadores</Link><h1 className="mt-2 text-3xl font-bold text-slate-950">Horarios semanales</h1><p className="mt-1 text-sm text-slate-500">Selecciona una semana guardada para editarla o crea una nueva.</p><div className="my-5 flex flex-wrap gap-3"><input type="date" value={week} onChange={event=>setWeek(event.target.value)} className="rounded-xl border border-slate-300 p-2"/><button onClick={copyPrevious} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">Copiar semana anterior</button><button onClick={save} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Guardar cambios</button></div>{savedWeeks.length>0&&<div className="mb-5 rounded-xl border border-slate-200 bg-white p-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Semanas guardadas</p><div className="flex flex-wrap gap-2">{savedWeeks.map(item=><button key={item.weekStart} onClick={()=>setWeek(item.weekStart)} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${week===item.weekStart?"bg-emerald-700 text-white":"bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{item.weekStart} — {item.weekEnd}</button>)}</div></div>}{message&&<p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}<div className="space-y-2">{details.map(day=><div key={day.weekday} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[120px_1fr_1fr]"><strong className="py-2">{days[day.weekday-1]}</strong><Shift label="Mañana" item={day} enabledKey="morningEnabled" startKey="morningEntryTime" endKey="morningExitTime" onChange={update}/><Shift label="Tarde" item={day} enabledKey="afternoonEnabled" startKey="afternoonEntryTime" endKey="afternoonExitTime" onChange={update}/></div>)}</div></section></main>;
}

function Shift({label,item,enabledKey,startKey,endKey,onChange}:{label:string;item:Detail;enabledKey:"morningEnabled"|"afternoonEnabled";startKey:"morningEntryTime"|"afternoonEntryTime";endKey:"morningExitTime"|"afternoonExitTime";onChange:(weekday:number,patch:Partial<Detail>)=>void}) { const enabled=item[enabledKey] as boolean; return <div className="flex flex-wrap items-center gap-2"><label className="text-sm font-medium"><input type="checkbox" checked={enabled} onChange={event=>onChange(item.weekday,{[enabledKey]:event.target.checked})}/> {label}</label><input disabled={!enabled} type="time" value={(item[startKey] as string|null)??""} onChange={event=>onChange(item.weekday,{[startKey]:event.target.value||null})} className="w-24 rounded border p-1 disabled:bg-slate-100"/><input disabled={!enabled} type="time" value={(item[endKey] as string|null)??""} onChange={event=>onChange(item.weekday,{[endKey]:event.target.value||null})} className="w-24 rounded border p-1 disabled:bg-slate-100"/></div>; }
