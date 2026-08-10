import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import logo from "../public/logo_buggcoin_dol.png";

// Buggcoin logo: beetle illustration + wordmark. Clicking it goes Home.
const SIZES = {
  sm: { img: 26, text: "text-base" },
  md: { img: 32, text: "text-lg" },
  lg: { img: 72, text: "text-2xl" },
} as const;

export function Logo({
  size = "md",
  showWordmark = true,
  href = "/",
}: {
  size?: keyof typeof SIZES;
  showWordmark?: boolean;
  href?: string;
}) {
  const s = SIZES[size];
  return (
    <Link href={href} className="inline-flex items-center gap-2" aria-label="Buggcoin — início">
      <Image
        src={logo}
        alt=""
        width={s.img}
        height={s.img}
        className="object-contain"
        priority={size === "lg"}
      />
      {showWordmark && (
        <span className={cn("font-heading font-bold tracking-tight", s.text)}>
          Buggcoin
        </span>
      )}
    </Link>
  );
}
