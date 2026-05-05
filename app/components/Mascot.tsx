import Image from "next/image";

type Variant = "idle" | "listening";

const SRC: Record<Variant, string> = {
  idle: "/mascot/idle.mp4",
  listening: "/mascot/listening.mp4",
};

export function MascotImage({
  size = 96,
  alt = "",
  className,
  style,
}: {
  size?: number;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Image
      src="/mascot/lion.png"
      alt={alt}
      width={size}
      height={size}
      priority={false}
      className={className}
      style={{
        display: "block",
        objectFit: "contain",
        ...style,
      }}
    />
  );
}

export function MascotVideo({
  variant,
  size = 120,
  className,
  style,
  ariaLabel,
}: {
  variant: Variant;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}) {
  return (
    <video
      src={SRC[variant]}
      width={size}
      height={size}
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={className}
      style={{
        display: "block",
        width: size,
        height: size,
        objectFit: "contain",
        ...style,
      }}
    />
  );
}
