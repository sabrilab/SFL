import { redirect } from "next/navigation";

// L'Arène n'existe plus (Sabri, 22/10 : « on retire tout, on garde juste
// Collection ») : les anciens liens, /duel comme /duel?mode=…, mènent à la
// Collection.
export default function ArenePage() {
  redirect("/collection");
}
