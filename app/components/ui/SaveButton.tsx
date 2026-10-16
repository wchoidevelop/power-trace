import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';

// wraps Button with an async save handler and a transient "Saved ✓" confirmation
export function SaveButton({
  label,
  onSave,
  variant = 'secondary',
  fullWidth,
  disabled,
}: {
  label: string;
  onSave: () => Promise<unknown>;
  variant?: Variant;
  fullWidth?: boolean;
  disabled?: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const press = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onSave();
      setSaved(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 2500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      label={saved ? 'Saved ✓' : label}
      variant={saved ? 'primary' : variant}
      fullWidth={fullWidth}
      disabled={busy || disabled}
      onPress={press}
    />
  );
}
