"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "@/app/login/actions";

const initialState: LoginState = {};

export function StaffLoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="login-form">
      <label>
        Work email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="you@school.edu"
        />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required placeholder="Your account password" />
      </label>
      <button type="submit" className="primary-button" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
      {state?.error ? <p className="login-error">{state.error}</p> : null}
    </form>
  );
}
