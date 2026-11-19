import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { useRegister } from '../../auth/auth';
import { TextField } from '../../components/ui/TextField';
import { ApiError } from '../../lib/api';
import { AuthShell } from './AuthShell';
import { authLinkClass, submitButtonClass } from './authHelpers';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const register = useRegister();
  const navigate = useNavigate();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    register.mutate(
      { name, email, password },
      { onSuccess: () => void navigate('/', { replace: true }) },
    );
  };

  const err = register.error instanceof ApiError ? register.error : null;
  const fieldErrors = err?.fieldErrors() ?? {};
  const formError = err && Object.keys(fieldErrors).length === 0 ? err.message : undefined;

  return (
    <AuthShell
      title="Create your account"
      subtitle="Track every application, status change, and interview in one place."
      formError={formError}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className={authLinkClass}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <TextField
          label="Full name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <button type="submit" disabled={register.isPending} className={submitButtonClass}>
          {register.isPending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}
