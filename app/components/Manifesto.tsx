export default function Manifesto() {
  return (
    <section
      className="color-band"
      style={{
        background: "var(--butter)",
        padding: "clamp(96px, 14vh, 180px) 0",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 50% 60% at 80% 20%, rgba(232, 93, 78, 0.08), transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        className="mx-auto max-w-[1200px] px-6"
        style={{ position: "relative" }}
      >
        <span
          className="mono-label"
          style={{ color: "var(--ink)", opacity: 0.6 }}
        >
          A working theory
        </span>
        <p
          className="display-pull"
          style={{
            marginTop: 28,
            color: "var(--ink)",
            maxWidth: "16ch",
          }}
        >
          Every post is a public test.
          <br />
          We just let you take it{" "}
          <span style={{ color: "var(--tomato)" }}>in private</span> first.
        </p>
      </div>
    </section>
  );
}
