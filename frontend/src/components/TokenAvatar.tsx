import { useState } from "react";

type Props = {
  icon?: string;
  name: string;
  size?: number;     // px, default 32
  className?: string;
};

/**
 * Circular token icon. Falls back to a mono-color initial avatar if the
 * image fails to load or is missing (common for fresh meme tokens whose
 * IPFS pin hasn't propagated).
 */
export function TokenAvatar({ icon, name, size = 32, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const initial = (name?.trim()[0] ?? "?").toUpperCase();

  const style = { width: size, height: size };

  if (!icon || failed) {
    return (
      <div
        style={style}
        className={`shrink-0 rounded-full bg-secondary border border-border flex items-center justify-center font-display font-bold text-pepe ${className}`}
        aria-label={`${name} icon placeholder`}
      >
        <span style={{ fontSize: size * 0.42 }}>{initial}</span>
      </div>
    );
  }

  return (
    <img
      src={icon}
      alt={`${name} icon`}
      style={style}
      className={`shrink-0 rounded-full border border-border bg-secondary object-cover ${className}`}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
