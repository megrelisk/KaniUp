import { avatarByKey } from "@/lib/game";

export function Avatar({ avatar, size = 32, title }: { avatar: string; size?: number; title?: string }) {
  const a = avatarByKey(avatar);
  return (
    <span
      title={title}
      className="inline-flex shrink-0 items-center justify-center rounded-full ring-2 ring-white/10"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.58,
        background: `radial-gradient(circle at 30% 25%, ${a.from}, ${a.to})`,
        boxShadow: `0 0 ${size / 3}px ${a.from}55`,
      }}
    >
      {a.emoji}
    </span>
  );
}

export function AvatarStack({ people, size = 24, max = 4 }: { people: { avatar: string; name: string }[]; size?: number; max?: number }) {
  return (
    <span className="flex -space-x-2">
      {people.slice(0, max).map((p, i) => (
        <Avatar key={i} avatar={p.avatar} size={size} title={p.name} />
      ))}
      {people.length > max && (
        <span className="muted inline-flex items-center justify-center rounded-full bg-[var(--bg-soft)] text-[10px]" style={{ width: size, height: size }}>
          +{people.length - max}
        </span>
      )}
    </span>
  );
}
