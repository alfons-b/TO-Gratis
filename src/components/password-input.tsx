"use client";

import { Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generatePassword(length = 8) {
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => ALPHABET[n % ALPHABET.length]).join("");
}

/** Password terlihat (agar admin bisa mencatat), dengan tombol buat acak. */
export function PasswordInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="new-password"
        className="font-mono"
        required
      />
      <Button type="button" variant="outline" onClick={() => onChange(generatePassword())} title="Buat password acak">
        <Dices /> Acak
      </Button>
    </div>
  );
}
