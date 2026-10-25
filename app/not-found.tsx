import { BtnLink } from "@/components/Btn.tsx";
import { EmptyBlocks } from "@/components/Blocks.tsx";

export const metadata = { title: "Nothing spawned here" };

export default function NotFound() {
  return (
    <section className="lost">
      <div>
        <EmptyBlocks />
        <h1 className="display">Nothing spawned here.</h1>
        <p>There is no chain, trade or page at this address. A chain only holds what Pons has traded.</p>
        <BtnLink href="/chains">See the chains</BtnLink>
      </div>
    </section>
  );
}
