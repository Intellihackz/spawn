import { LaunchStudio } from "@/components/LaunchStudio.tsx";

export const metadata = { title: "Launch a token", description: "Launch a token on Pons from your own wallet and a chain spawns for it, mirroring every trade." };

export default function LaunchPage() {
  return (
    <div className="page wrap">
      <div className="page__head">
        <h1 className="display" data-split="lines" data-intro>
          Launch it. It spawns a chain.
        </h1>
        <p className="lede" data-reveal="up" data-intro data-delay="0.25">
          Your wallet launches the token on Pons, and a chain spawns for it and mirrors every trade. The chain is a record, not a place to trade.
        </p>
      </div>
      <LaunchStudio />
    </div>
  );
}
