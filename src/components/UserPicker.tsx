"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { searchUsers } from "@/lib/gifts";
import { inputClass } from "@/lib/ui";
import { getErrorMessage } from "@/lib/errors";

export type UserResult = Awaited<ReturnType<typeof searchUsers>>[number];

export function UserPicker({
  onSelect,
  initialQuery,
  selected,
  onClear,
}: {
  onSelect: (user: UserResult) => void;
  initialQuery?: string;
  // Modo controlado (mismo patrón que ItemPicker): con un usuario ya
  // elegido, el input queda bloqueado y el único modo de cambiarlo es el
  // botón de limpiar — evita que se pueda editar el texto libre sin que
  // eso quite la selección del padre. Opcional para no romper el uso
  // existente (NewPublicationForm, sin selected/onClear): ahí sigue
  // comportándose igual que antes.
  selected?: UserResult | null;
  onClear?: () => void;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [results, setResults] = useState<UserResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("market.userPicker");
  const tCommon = useTranslations("common");

  function handleChange(value: string) {
    setQuery(value);
    setError(null);
    startTransition(async () => {
      try {
        const found = await searchUsers(value);
        setResults(found);
      } catch (err) {
        setError(getErrorMessage(err, tCommon("searchError")));
      }
    });
  }

  function handleClear() {
    onClear?.();
    setQuery("");
    setResults([]);
  }

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          value={selected ? selected.username : query}
          onChange={(e) => handleChange(e.target.value)}
          readOnly={!!selected}
          placeholder={t("placeholder")}
          className={`${inputClass} ${selected ? "cursor-default pr-8" : ""}`}
        />
        {selected && onClear && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={t("removeSelected")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ro-text-muted hover:text-ro-gold"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {!selected && isPending && (
        <p className="mt-1 text-sm text-ro-text-muted">{tCommon("searching")}</p>
      )}
      {!selected && error && <p className="mt-1 text-sm text-red-700">{error}</p>}
      {!selected && results.length > 0 && (
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
