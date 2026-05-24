"use client";

import { useId, useState } from "react";

interface PasswordFieldProps {
  label: string;
  name: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
}

export function PasswordField({
  label,
  name,
  autoComplete,
  placeholder,
  required,
  minLength,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();

  return (
    <label htmlFor={inputId}>
      {label}
      <span className="password-field-row">
        <input
          id={inputId}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
        />
        <button
          type="button"
          className="password-visibility-button"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}
