import { renderSchedule } from "../_schedule-page";

export function generateStaticParams() {
  return [{ locale: "en" }];
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return renderSchedule(locale, "en");
}
