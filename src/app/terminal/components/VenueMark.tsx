import Image from "next/image";
import styles from "./WorkspacePanels.module.css";

export default function VenueMark({ venue, label = true }: { venue: "kalshi" | "polymarket_us"; label?: boolean }) {
  const name = venue === "kalshi" ? "Kalshi" : "Polymarket US";
  return <span className={styles.venueName}>
    <span className={styles.venueMark} data-venue={venue}>
      <Image src={venue === "kalshi" ? "/kalshi-icon.png" : "/polymarket-icon.svg"} alt={label ? "" : name} width={24} height={24} unoptimized />
    </span>
    {label && <span>{name}</span>}
  </span>;
}
