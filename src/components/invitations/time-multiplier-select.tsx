"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const TIME_MULTIPLIERS = [
  { value: 1, label: "None (standard time)" },
  { value: 1.25, label: "+25% (1.25×)" },
  { value: 1.5, label: "+50% (time and a half)" },
  { value: 2, label: "+100% (double time)" },
  { value: 3, label: "+200% (triple time)" },
];

export const formatMultiplier = (m: number) => `${Number(m.toFixed(2))}× time`;

export function TimeMultiplierSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const options = TIME_MULTIPLIERS.some((o) => o.value === value)
    ? TIME_MULTIPLIERS
    : [...TIME_MULTIPLIERS, { value, label: formatMultiplier(value) }].sort((a, b) => a.value - b.value);
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
