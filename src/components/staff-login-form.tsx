"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "@/app/login/actions";
import { PasswordField } from "@/components/password-field";

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
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        placeholder="Your account password"
        required
      />
      <button type="submit" className="primary-button" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
      {state?.error ? <p className="login-error">{state.error}</p> : null}
    </form>
  );
}
