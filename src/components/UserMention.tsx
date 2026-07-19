// Atribución de usuario en tarjetas/detalle de objetos: "ti" si eres tú,
// si no "@NombreVisible" (formato de mención de Discord). Aparte como
// componente para que, cuando se pueda mandar mensaje/oferta por Discord al
// vendedor, solo haga falta tocar este sitio.
export function UserMention({
  userId,
  username,
  viewerId,
  capitalize = false,
}: {
  userId: string;
  username: string;
  viewerId: string;
  capitalize?: boolean;
}) {
  if (userId === viewerId) {
    return <>{capitalize ? "Tú" : "ti"}</>;
  }
  return <>@{username}</>;
}
