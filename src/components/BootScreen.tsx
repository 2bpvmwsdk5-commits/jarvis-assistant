"use client";

import { useState, type FormEvent } from "react";
import { AICore } from "./AICore";

/**
 * Startbildschirm. Der Klick auf „System starten“ ist wichtig:
 * iPhone/iPad erlauben Sprachausgabe erst nach einer Berührung.
 */
export function BootScreen({ userName, onStart }: { userName: string; onStart: (name: string) => void }) {
  const [name, setName] = useState(userName);
  const [leaving, setLeaving] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setLeaving(true);
    onStart(name.trim());
  };

  return (
    <div className={`boot ${leaving ? "is-leaving" : ""}`}>
      <div className="boot__inner">
        <AICore state="thinking" size="min(62vw, 300px)" />
        <h1 className="boot__title">J.A.R.V.I.S.</h1>
        <p className="boot__subtitle">Just A Rather Very Intelligent System</p>

        <form className="boot__form" onSubmit={submit}>
          {userName ? (
            <p className="boot__welcome">Willkommen zurück, {userName}.</p>
          ) : (
            <label className="field">
              <span>Wie darf ich Sie nennen?</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 40))}
                placeholder="Ihr Name"
                autoComplete="given-name"
                autoFocus
              />
            </label>
          )}
          <button type="submit" className="btn btn--primary btn--large">
            System starten
          </button>
        </form>
      </div>
    </div>
  );
}
