import Image from "next/image";
import { cn } from "@/lib/utils";

/** Keep the supplied artwork on white so it also reads on the navy/dark theme. */
export function BrandLogo({
  className,
  large = false,
}: {
  className?: string;
  large?: boolean;
}) {
  return (
    <Image
      src={large ? "/icons/sj-logo-512.png" : "/icons/sj-logo-192.png"}
      alt="SJ Sunrise Jasa Services & Trading logo"
      width={large ? 512 : 192}
      height={large ? 512 : 192}
      loading="eager"
      // These files are already sized for display and don't need runtime resizing.
      unoptimized
      className={cn("shrink-0 rounded-xl bg-white object-contain", className)}
    />
  );
}
