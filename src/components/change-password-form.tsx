"use client";

import { useActionState } from "react";

import {
  changePasswordAction,
  type ChangePasswordState,
} from "@/app/change-password/actions";
import { PasswordField } from "@/components/password-field";

const initialState: ChangePasswordState = {};

interface ChangePasswordFormProps {
  accountName: string;
  accountEmail: string;
}

export function ChangePasswordForm({
  accountName,
  accountEmail,
}: ChangePasswordFormProps) {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initialState,
  );

  return (
    <form action={formAction} className="login-form">
      <div className="auth-account-block">
        <strong>{accountName}</strong>
        <span className="muted">{accountEmail}</span>
      </div>
      <PasswordField
        label="Temporary password"
        name="currentPassword"
        autoComplete="current-password"
        placeholder="Enter the temporary password"
        required
      />
      <PasswordField
        label="New password"
        name="newPassword"
        autoComplete="new-password"
        placeholder="Choose a new password"
        required
        minLength={8}
      />
      <PasswordField
        label="Confirm new password"
        name="confirmPassword"
        autoComplete="new-password"
        placeholder="Re-enter the new password"
        required
        minLength={8}
      />
      <button type="submit" className="primary-button" disabled={pending}>
        {pending ? "Updating..." : "Update password"}
      </button>
      {state?.error ? <p className="login-error">{state.error}</p> : null}
    </form>
  );
}
