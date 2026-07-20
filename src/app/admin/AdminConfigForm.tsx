"use client";

import { useState } from "react";
import { updateMarketConfig, type getMarketConfig } from "@/lib/admin-config";
import { buttonClass, inputClass, labelClass } from "@/lib/ui";
import { ToggleSwitch } from "@/components/ToggleSwitch";

type Config = Awaited<ReturnType<typeof getMarketConfig>>;

export function AdminConfigForm({ config }: { config: Config }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={async (formData) => {
        setError(null);
        setSaved(false);
        try {
          await updateMarketConfig(formData);
          setSaved(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Error inesperado");
        }
      }}
      className="flex flex-col gap-6"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-ro-text">Notificaciones a Discord</legend>
        <ToggleSwitch
          name="webhookEnabled"
          defaultChecked={config.webhookEnabled}
          label="Enviar notificación de nueva venta al webhook"
        />
        <div>
          <label className={labelClass}>URL del webhook</label>
          <input
            type="url"
            name="webhookUrl"
            placeholder={config.webhookUrlMasked ?? "https://discord.com/api/webhooks/..."}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-ro-text-muted">
            {config.webhookUrlMasked
              ? "Deja en blanco para no cambiar el valor guardado."
              : "Todavía no hay ninguna URL guardada."}
          </p>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-ro-text">Reconocimiento por captura</legend>
        <ToggleSwitch
          name="imageRecognitionEnabled"
          defaultChecked={config.imageRecognitionEnabled}
          label="Permitir reconocer el item desde una captura (Gemini)"
        />
        <p className="text-xs text-ro-text-muted">
          API key de Gemini:{" "}
          {config.hasGeminiApiKey ? (
            <span className="text-green-700">configurada</span>
          ) : (
            <span className="text-red-700">no configurada (variable de entorno GEMINI_API_KEY)</span>
          )}
          . Hace falta esto Y el toggle activo para que la función funcione.
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-ro-text">Mercado</legend>
        <ToggleSwitch
          name="maintenanceModeEnabled"
          defaultChecked={config.maintenanceModeEnabled}
          label="Modo mantenimiento (bloquea crear ventas y comprar para todos menos administradores)"
        />
        <div>
          <label className={labelClass}>Refine máximo permitido</label>
          <input
            type="number"
            name="maxRefineLevel"
            min={0}
            defaultValue={config.maxRefineLevel}
            className={inputClass}
          />
        </div>
      </fieldset>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {saved && !error && <p className="text-sm text-green-700">Guardado.</p>}

      <button type="submit" className={buttonClass("primary")}>
        Guardar
      </button>
    </form>
  );
}
