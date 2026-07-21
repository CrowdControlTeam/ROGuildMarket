"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { searchUsers } from "@/lib/gifts";
import { inputClass } from "@/lib/ui";

export type UserResult = Awaited<ReturnType<typeof searchUsers>>[number];

export function UserPicker({
  onSelect,
  initialQuery,
}: {
  onSelect: (user: UserResult) => void;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [results, setResults] = useState<UserResult[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    setQuery(value);
    startTransition(async () => {
      const found = await searchUsers(value);
      setResults(found);
    });
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Busca un usuario por nombre..."
        className={inputClass}
      />
      {isPending && (
        <p className="mt-1 text-sm text-ro-text-muted">Buscando...</p>
      )}
      {results.length > 0 && (
        <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md border-2 border-ro-panel-border bg-ro-panel-alt p-1">
          {results.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(user);
                  setQuery(user.username);
                  setResults([]);
                }}
                className="flex w-full items-center gap-2 rounded-md p-2 text-left text-ro-text hover:bg-ro-gold/20"
              >
                {user.avatarUrl && (
                  <Image
                    src={user.avatarUrl}
                    alt={user.username}
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                )}
                <span>{user.username}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
