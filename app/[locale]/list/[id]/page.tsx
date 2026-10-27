import { listMetadata, renderList } from "../../_list-page";

/* No generateStaticParams: a list id is a row in someone's account, not
   a slug this build can enumerate. The wrong language for this slug is
   caught at request time instead — renderList 404s when the locale and
   the slug disagree. */
export const metadata = listMetadata;

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  return renderList(locale, "en", id);
}
