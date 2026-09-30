import { redirect } from "next/navigation"
import { getUser } from "@/server/auth"
import { env } from "@/server/env"
import { getLinkService } from "@/server/links"
import { toLinkJson } from "@/server/links/linkJson"
import { DashboardShell } from "./dashboard-shell"

export const metadata = { title: "Dashboard | axl" }

export default async function DashboardPage() {
  const user = await getUser()
  if (!user) redirect("/signin")

  // First page is rendered on the server, so links are there on first paint.
  const page = await getLinkService().list(user.id)

  return (
    <DashboardShell
      email={user.email}
      initialLinks={page.links.map(link => toLinkJson(link, env().BASE_URL))}
      initialCursor={page.nextCursor}
    />
  )
}
