import type { Route } from "./+types/index";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Index" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Index() {
  return (
    <div>
      Hello World
    </div>
  )
}
