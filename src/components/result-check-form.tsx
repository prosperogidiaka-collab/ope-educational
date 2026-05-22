"use client";

import { useActionState } from "react";

import {
  studentPortalLoginAction,
  type StudentPortalLoginState,
} from "@/app/portal/actions";
import type { StudentPortalCredential } from "@/lib/types";

interface ResultCheckFormProps {
  credentials: StudentPortalCredential[];
}

const initialState: StudentPortalLoginState = {};

export function ResultCheckForm({ credentials }: ResultCheckFormProps) {
  const [state, formAction, pending] = useActionState(studentPortalLoginAction, initialState);

  return (
    <div className="grid-layout two-wide">
      <form className="surface-card" action={formAction}>
        <div className="section-head">
          <div>
            <p className="eyebrow">Student Access</p>
            <h3>Student sign in</h3>
          </div>
          <span className="status-pill status-locked">Student account portal</span>
        </div>

        <div className="form-grid">
          <label>
            <span>Username</span>
            <input
              name="username"
              autoComplete="username"
              required
              placeholder="Enter your student username"
            />
          </label>

          <label>
            <span>Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Enter your temporary password"
            />
          </label>
        </div>

        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Opening account..." : "Open student account"}
        </button>

        <p className="muted">
          {state?.error ?? "Sign in with the registrar-issued username and password."}
        </p>
      </form>

      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Demo Credentials</p>
            <h3>Registrar-issued student access</h3>
          </div>
        </div>

        <div className="demo-list">
          {credentials
            .filter((credential) => credential.status !== "reset_required")
            .slice(0, 3)
            .map((credential) => (
              <article key={credential.id} className="demo-card">
                <strong>{credential.studentName}</strong>
                <p>Username: {credential.username}</p>
                <p>Password: {credential.temporaryPassword}</p>
                <p className="muted">{credential.regNumber}</p>
              </article>
            ))}
        </div>
      </section>
    </div>
  );
}
