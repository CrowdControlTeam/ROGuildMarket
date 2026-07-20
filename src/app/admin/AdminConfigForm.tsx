"use client";

import { useState } from "react";
import { updateMarketConfig, type getMarketConfig } from "@/lib/admin-config";
import { buttonClass, inputClass, labelClass, selectClass } from "@/lib/ui";
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
        <legend className="mb-1 text-sm font-semibold text-ro-text">Acceso al panel</legend>
        <p className="text-xs text-ro-text-muted">
          Quien tenga el permiso &quot;Administrator&quot; del servidor de Discord ya entra siempre. Estos
          roles se SUMAN como vía adicional, no lo sustituyen.
        </p>
        {config.guildRolesResult.status === "ok" ? (
          <select
            name="adminRoleIds"
            multiple
            defaultValue={config.adminRoleIds}
            size={Math.min(6, Math.max(3, config.guildRolesResult.roles.length))}
            className={selectClass}
          >
            {config.guildRolesResult.roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        ) : (
          <div>
            {config.guildRolesResult.status === "error" && (
              <p className="mb-1 text-xs text-red-700">
                No se pudo listar los roles del servidor con nombre ({config.guildRolesResult.message}).
              </p>
            )}
            <textarea
              name="adminRoleIdsText"
              rows={3}
              defaultValue={config.adminRoleIds.join("\n")}
              placeholder="Un ID de rol por línea (o separados por comas)"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-ro-text-muted">
              Sin bot configurado (DISCORD_BOT_TOKEN) no se pueden mostrar los nombres de los roles —
              copia el ID de cada rol desde Discord (Ajustes del servidor → Roles → clic derecho → Copiar
              ID, con el modo desarrollador activado).
            </p>
          </div>
        )}
      </fieldset>

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
        <legend className="mb-1 text-sm font-semibold text-ro-text">Random options</legend>
        <ToggleSwitch
          name="optionsEnabled"
          defaultChecked={config.optionsEnabled}
          label="Permitir estadísticas aleatorias (options) en armas/armaduras"
        />
        <p className="text-xs text-ro-text-muted">
          Catálogo de options:{" "}
          {config.optionsCatalogCount > 0 ? (
            <span className="text-green-700">{config.optionsCatalogCount} combinaciones cargadas</span>
          ) : (
            <span className="text-red-700">sin cargar</span>
          )}
          . Hace falta esto Y el toggle activo — pensado para versiones de RO sin catálogo de options todavía.
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
