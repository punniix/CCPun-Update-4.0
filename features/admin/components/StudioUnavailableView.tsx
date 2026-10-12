export default function StudioUnavailableView({ title, description }: { title: string; description: string }) {
  return <main style={{ minHeight: "100vh", padding: "3rem", fontFamily: "system-ui", background: "#251818", color: "#faf9f9" }}><h1>{title}</h1><p>{description}</p></main>;
}
