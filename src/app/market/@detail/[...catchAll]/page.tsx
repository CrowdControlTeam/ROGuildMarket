// Catch-all para cerrar el panel al navegar a cualquier ruta que no sea la
// interceptada (.)[id] — sin esto, el slot @detail se quedaría mostrando
// la última ficha abierta al moverte a /market/sale, /market/new, etc.
export default function CatchAll() {
  return null;
}
