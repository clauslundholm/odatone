import { renderSchedule } from "../_schedule-page";

/* Danish slug only; /en/spilleplan is not generated and 404s. */
export function generateStaticParams() {
  return [{ locale: "da" }];
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, search] = await Promise.all([params, searchParams]);
  return renderSchedule(locale, "da", search);
}
