"use client";

import { useMemo, useState, type FormEvent } from "react";
import { describeWhen } from "@/lib/commands";
import { useNow } from "@/hooks/useNow";
import type { Task } from "@/lib/types";
import { BellIcon, CheckIcon, PlusIcon, TrashIcon } from "./Icons";

interface TasksPanelProps {
  tasks: Task[];
  onAdd: (title: string, remindAt?: Date) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onClearDone: () => void;
}

type Filter = "open" | "done";

export function TasksPanel({ tasks, onAdd, onToggle, onDelete, onClearDone }: TasksPanelProps) {
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [filter, setFilter] = useState<Filter>("open");
  const now = useNow() ?? new Date(0);

  const openCount = tasks.filter((t) => !t.done).length;
  const doneCount = tasks.length - openCount;

  const visible = useMemo(() => {
    const list = tasks.filter((t) => (filter === "open" ? !t.done : t.done));
    return list.sort((a, b) => {
      const ra = a.remindAt ? Date.parse(a.remindAt) : Infinity;
      const rb = b.remindAt ? Date.parse(b.remindAt) : Infinity;
      if (ra !== rb) return ra - rb;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  }, [tasks, filter]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd(t, when ? new Date(when) : undefined);
    setTitle("");
    setWhen("");
    setFilter("open");
  };

  return (
    <section className="panel tasks" aria-label="Aufgaben und Erinnerungen">
      <header className="panel__header">
        <h2 className="panel__title">
          <span className="panel__dot" /> Aufgaben
        </h2>
        <div className="segmented" role="tablist" aria-label="Filter">
          <button role="tab" aria-selected={filter === "open"} onClick={() => setFilter("open")}>
            Offen <b>{openCount}</b>
          </button>
          <button role="tab" aria-selected={filter === "done"} onClick={() => setFilter("done")}>
            Erledigt <b>{doneCount}</b>
          </button>
        </div>
      </header>

      <form className="tasks__form" onSubmit={submit}>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Neue Aufgabe …"
          aria-label="Titel der neuen Aufgabe"
          maxLength={200}
        />
        <div className="tasks__form-row">
          <label className="input input--with-icon" title="Erinnerung (optional)">
            <BellIcon size={16} />
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              aria-label="Erinnerungszeitpunkt (optional)"
            />
          </label>
          <button type="submit" className="btn btn--primary" disabled={!title.trim()} aria-label="Aufgabe hinzufügen">
            <PlusIcon size={18} /> <span className="btn__label">Hinzufügen</span>
          </button>
        </div>
      </form>

      <ul className="tasks__list">
        {visible.length === 0 && (
          <li className="tasks__empty">
            {filter === "open" ? "Keine offenen Aufgaben. Hervorragend." : "Noch nichts erledigt."}
          </li>
        )}
        {visible.map((task) => {
          const remind = task.remindAt ? new Date(task.remindAt) : undefined;
          const overdue = remind && !task.done && remind.getTime() < now.getTime();
          return (
            <li key={task.id} className={`task ${task.done ? "is-done" : ""}`}>
              <button
                className="task__check"
                onClick={() => onToggle(task.id)}
                aria-label={task.done ? `„${task.title}“ wieder öffnen` : `„${task.title}“ erledigen`}
              >
                {task.done && <CheckIcon size={14} />}
              </button>
              <div className="task__body">
                <span className="task__title">{task.title}</span>
                {remind && (
                  <span className={`task__remind ${overdue ? "is-overdue" : ""}`}>
                    <BellIcon size={12} /> {describeWhen(remind, now)}
                  </span>
                )}
              </div>
              <button className="icon-btn icon-btn--small task__delete" onClick={() => onDelete(task.id)} aria-label={`„${task.title}“ löschen`}>
                <TrashIcon size={15} />
              </button>
            </li>
          );
        })}
      </ul>

      {filter === "done" && doneCount > 0 && (
        <button className="btn btn--ghost tasks__clear" onClick={onClearDone}>
          Erledigte entfernen
        </button>
      )}
    </section>
  );
}
