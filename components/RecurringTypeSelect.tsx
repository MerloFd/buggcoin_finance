"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { store, type Direction, type RecurringType } from "@/lib/store";

const NEW_TYPE_VALUE = "__new__";

// Type picker with inline "+ Novo tipo" creation. Direction is chosen once per
// type and is the source of truth for every recurring of that type.
export function RecurringTypeSelect({
  userId,
  value,
  onChange,
  types,
  onTypesChange,
}: {
  userId: string;
  value: string;
  onChange: (typeId: string) => void;
  types: RecurringType[];
  onTypesChange: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [direction, setDirection] = useState<Direction>("out");

  async function create() {
    const trimmed = label.trim();
    if (!trimmed) return;
    const created = await store.saveRecurringType(userId, {
      label: trimmed,
      direction,
      isDefault: false, // only the seeded 'gasto' type is the default
    });
    onTypesChange();
    onChange(created.id);
    setLabel("");
    setDirection("out");
    setCreating(false);
  }

  return (
    <div className="space-y-3">
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === NEW_TYPE_VALUE) setCreating(true);
          else if (v) onChange(v);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {types.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.label} ({t.direction === "in" ? "entrada" : "saída"})
            </SelectItem>
          ))}
          <SelectItem value={NEW_TYPE_VALUE}>+ Novo tipo</SelectItem>
        </SelectContent>
      </Select>

      {creating && (
        <div className="space-y-3 rounded-md border border-border p-3">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="salário, assinatura..."
          />
          <ToggleGroup
            value={[direction]}
            onValueChange={(v) => v[0] && setDirection(v[0] as Direction)}
          >
            <ToggleGroupItem value="in" className="flex-1">
              Entrada
            </ToggleGroupItem>
            <ToggleGroupItem value="out" className="flex-1">
              Saída
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="flex gap-2">
            <Button size="sm" onClick={create}>
              Criar tipo
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreating(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
