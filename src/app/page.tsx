import { redirect } from "next/navigation";

// La portada abre el nuevo control de avance de proyectos.
// El kanban anterior sigue disponible en /kanban.
export default function Home() {
  redirect("/avance.html");
}
