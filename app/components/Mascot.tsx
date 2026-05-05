/* eslint-disable @next/next/no-img-element */
import Image from "next/image";

type Variant = "idle" | "listening";

const SRC: Record<Variant, string> = {
  idle: "/mascot/idle.webp",
  listening: "/mascot/listening.webp",
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
    <img
      src={SRC[variant]}
      alt={ariaLabel ?? ""}
      width={size}
      height={size}
      className={className}
      style={{
        display: "block",
        width: size,
        height: size,
        objectFit: "contain",
        background: "transparent",
        ...style,
      }}
    />
  );
}
