import { SiteHeader } from "@/components/site-header";

/** Layout for sidene spillerne bruker. Admin-sidene har sin egen header. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
