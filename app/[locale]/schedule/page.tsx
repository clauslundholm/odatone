import { renderSchedule } from "../_schedule-page";

export function generateStaticParams() {
  return [{ locale: "en" }];
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, search] = await Promise.all([params, searchParams]);
  return renderSchedule(locale, "en", search);
}
