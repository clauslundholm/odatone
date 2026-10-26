import { renderSchedule } from "../_schedule-page";

/* Danish slug only; /en/spilleplan is not generated and 404s. */
export function generateStaticParams() {
  return [{ locale: "da" }];
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return renderSchedule(locale, "da");
}
