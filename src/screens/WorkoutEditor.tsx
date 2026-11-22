import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Plus, Repeat, Trash2 } from 'lucide-react';
import { db, now, uid } from '../db/db';
import type { AppData } from '../db/repo';
import { ALL_EXERCISES, exerciseById, WORKOUTS, type MuscleGroup } from '../data/exercises';
import { moveItem, newItem, validatePlan, variantsFor, type EffectivePlan, type Slot } from '../domain/workoutEdit';
import type { PlanItem } from '../domain/types';
import { Badge, Btn, cx, Field, inputCls, NumInput, Sheet, toast } from '../ui/kit';

const GROUPS: Record<MuscleGroup, string> = { chest: 'Klatka', back_vertical: 'Plecy (pion)', back_horizontal: 'Plecy (poziom)', hinge: 'Zawias biodrowy', squat: 'Przysiad', shoulders: 'Barki', biceps: 'Biceps', triceps: 'Triceps', core: 'Brzuch', hamstrings: 'Dwugłowe', glutes: 'Pośladki' };
const RESTS = [45, 60, 90, 120, 150, 180, 240];
const lib = (id: string) => ALL_EXERCISES.find((e) => e.id === id);

export function WorkoutEditor({ slot, data, onClose }: { slot: Slot; data: AppData; onClose: () => void }) {
  const variants = variantsFor(slot, WORKOUTS, data.workoutTemplates);
  const activeId = data.settings?.activeWorkouts?.[slot] ?? slot;
  const [edit, setEdit] = useState<EffectivePlan | 'new' | null>(null);

  async function activate(id: string) {
    const cur = data.settings?.activeWorkouts ?? {};
    await db.settings.update('settings', { activeWorkouts: { ...cur, [slot]: id === slot ? undefined : id } });
    toast('Aktywny plan zmieniony (od następnego treningu)');
  }
  if (edit) return <PlanForm slot={slot} plan={edit} data={data} onClose={() => setEdit(null)} />;
  return (
    <Sheet open onClose={onClose} title={`Plan ${slot}: warianty`}>
      <p className="text-sm text-muted">Zmiany działają od następnego treningu. Zakończone treningi i ich serie się nie zmieniają. Historia progresji liczy się osobno dla każdego wykonanego ćwiczenia.</p>
      {variants.map((v) => (
        <div key={v.id} className={cx('rounded-xl border p-3', activeId === v.id ? 'border-accent' : 'border-line')}>
          <div className="flex items-center gap-2">
            <button className="flex-1 text-left" onClick={() => activate(v.id)}>
              <div className="font-semibold">{v.name} {activeId === v.id && <Badge tone="accent">aktywny</Badge>}{v.custom ? <Badge>wariant</Badge> : v.edited ? <Badge>zmieniony</Badge> : null}</div>
              <div className="text-xs text-muted">{v.items.map((i) => lib(i.exerciseId)?.namePl ?? i.exerciseId).join(' · ')}</div>
            </button>
            <Btn kind="soft" className="text-sm" onClick={() => setEdit(v)}>Edytuj</Btn>
          </div>
        </div>
      ))}
      <Btn kind="soft" className="w-full" onClick={() => setEdit('new')}><Plus size={16} className="inline -mt-0.5" /> Nowy wariant planu {slot}</Btn>
    </Sheet>
  );
}

function PlanForm({ slot, plan, data, onClose }: { slot: Slot; plan: EffectivePlan | 'new'; data: AppData; onClose: () => void }) {
  const isNew = plan === 'new';
  const [name, setName] = useState(isNew ? `Trening ${slot}: wariant` : plan.name);
  const [items, setItems] = useState<PlanItem[]>(() => structuredClone(isNew ? WORKOUTS[slot] : plan.items));
  const [pick, setPick] = useState<number | 'add' | null>(null);
  const kneeCleared = !!data.health?.kneeCleared;
  const defaultIds = [...WORKOUTS.A, ...WORKOUTS.B].map((i) => i.exerciseId);
  const errors = validatePlan(name, items, lib, { kneeCleared, defaultIds });
  const set = (i: number, patch: Partial<PlanItem>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function save(asNew: boolean) {
    if (errors.length) return toast(errors[0]);
    const id = asNew || isNew ? uid() : plan.id;
    const t = now();
    await db.workoutTemplates.put({ id, slot, name: name.trim(), items, createdAt: t, updatedAt: t });
    if (asNew || isNew) await db.settings.update('settings', { activeWorkouts: { ...(data.settings?.activeWorkouts ?? {}), [slot]: id } });
    toast(asNew || isNew ? 'Zapisano wariant i ustawiono jako aktywny' : 'Plan zapisany'); onClose();
  }
  async function remove() {
    if (isNew) return;
    await db.workoutTemplates.delete(plan.id);
    if (data.settings?.activeWorkouts?.[slot] === plan.id) await db.settings.update('settings', { activeWorkouts: { ...data.settings.activeWorkouts, [slot]: undefined } });
    toast(plan.custom ? 'Usunięto wariant' : 'Przywrócono plan domyślny'); onClose();
  }
  return (
    <Sheet open onClose={onClose} title={isNew ? `Nowy wariant ${slot}` : `Edytuj: ${name}`}>
      <Field label="Nazwa planu"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      {items.map((it, i) => {
        const ex = lib(it.exerciseId);
        return (
          <div key={it.exerciseId + i} className="rounded-xl border border-line p-2 space-y-2">
            <div className="flex items-center gap-1">
              <span className="flex-1 text-sm font-semibold">{i + 1}. {ex?.namePl ?? it.exerciseId} {ex && ex.knee !== 'none' && <Badge tone={ex.knee === 'moderate' ? 'warn' : 'muted'}>kolano</Badge>}</span>
              <button aria-label="W górę" className="p-1" onClick={() => setItems(moveItem(items, i, -1))}><ArrowUp size={16} /></button>
              <button aria-label="W dół" className="p-1" onClick={() => setItems(moveItem(items, i, 1))}><ArrowDown size={16} /></button>
              <button aria-label="Zmień ćwiczenie" className="p-1" onClick={() => setPick(i)}><Repeat size={16} /></button>
              <button aria-label="Usuń ćwiczenie" className="p-1 text-danger" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-xs">
              <Field label="Serie"><NumInput value={it.sets} onChange={(v) => set(i, { sets: v ?? 0 })} /></Field>
              <Field label="Powt. od"><NumInput value={it.repMin} onChange={(v) => set(i, { repMin: v ?? 0 })} /></Field>
              <Field label="do"><NumInput value={it.repMax} onChange={(v) => set(i, { repMax: v ?? 0 })} /></Field>
              <Field label="Przerwa"><select className={inputCls} value={it.restSec} onChange={(e) => set(i, { restSec: Number(e.target.value) })}>{RESTS.map((r) => <option key={r} value={r}>{r}s</option>)}</select></Field>
            </div>
          </div>
        );
      })}
      <Btn kind="soft" className="w-full text-sm" onClick={() => setPick('add')}><Plus size={14} className="inline -mt-0.5" /> Dodaj ćwiczenie</Btn>
      {errors.length > 0 && <div className="text-xs text-warn space-y-0.5">{errors.slice(0, 4).map((e) => <div key={e}>{e}</div>)}</div>}
      <p className="text-xs text-muted">Blokady zdrowotne (ból kolana, objawy alarmowe) działają w trakcie treningu niezależnie od planu.</p>
      <div className="flex gap-2">
        <Btn className="flex-1" disabled={errors.length > 0} onClick={() => save(false)}>Zapisz</Btn>
        {!isNew && <Btn kind="soft" disabled={errors.length > 0} onClick={() => save(true)}>Jako wariant</Btn>}
      </div>
      {!isNew && plan.edited && <Btn kind="ghost" className="w-full text-sm text-danger" onClick={remove}>{plan.custom ? 'Usuń wariant' : 'Przywróć plan domyślny'}</Btn>}
      {pick !== null && <ExercisePicker current={items.map((x) => x.exerciseId)} replacing={pick === 'add' ? undefined : items[pick].exerciseId} kneeCleared={kneeCleared} defaultIds={defaultIds} onClose={() => setPick(null)}
        onPick={(id) => { if (pick === 'add') setItems([...items, newItem(id)]); else set(pick, { exerciseId: id }); setPick(null); }} />}
    </Sheet>
  );
}

function ExercisePicker({ current, replacing, kneeCleared, defaultIds, onPick, onClose }: { current: string[]; replacing?: string; kneeCleared: boolean; defaultIds: string[]; onPick: (id: string) => void; onClose: () => void }) {
  const orig = replacing ? exerciseById(replacing) : undefined;
  const [group, setGroup] = useState<MuscleGroup | 'all'>(orig?.group ?? 'all');
  const list = ALL_EXERCISES.filter((e) => group === 'all' || e.group === group);
  return (
    <Sheet open onClose={onClose} title={replacing ? 'Zmień ćwiczenie' : 'Dodaj ćwiczenie'}>
      <div className="flex flex-wrap gap-1.5">
        {(['all', ...Object.keys(GROUPS)] as (MuscleGroup | 'all')[]).map((g) => <button key={g} onClick={() => setGroup(g)} className={cx('rounded-full px-3 py-1.5 text-xs', group === g ? 'bg-accent text-accent-ink' : 'bg-card2')}>{g === 'all' ? 'Wszystkie' : GROUPS[g]}</button>)}
      </div>
      {list.map((e) => {
        const dup = current.includes(e.id) && e.id !== replacing;
        const knee = !kneeCleared && e.knee === 'moderate' && !defaultIds.includes(e.id);
        const reason = dup ? 'już w planie' : knee ? 'mocno obciąża kolano: najpierw ocena specjalisty' : '';
        return (
          <button key={e.id} disabled={!!reason} onClick={() => onPick(e.id)} className="w-full text-left py-2 border-b border-line disabled:opacity-40">
            <div className="text-sm">{e.namePl} {e.id === replacing && <Check size={14} className="inline text-accent" />}{e.knee !== 'none' && <Badge tone={e.knee === 'moderate' ? 'warn' : 'muted'}>kolano</Badge>}</div>
            <div className="text-xs text-muted">{e.group ? GROUPS[e.group] : ''}{reason ? ` · ${reason}` : ''}</div>
          </button>
        );
      })}
    </Sheet>
  );
}
