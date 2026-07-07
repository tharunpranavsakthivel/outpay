import { getDevelopersPageData } from "@/lib/dashboard/server";
import Developers from "../../views/Developers";

/** Route: /developers */
export default async function DevelopersPage() {
  const data = await getDevelopersPageData();
  return <Developers initialData={data} />;
}
