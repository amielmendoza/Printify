import { getCurrentUser } from "@/lib/auth"
import { GeneratorPageClient } from "@/components/generator/generator-page-client"

export default async function GeneratorPage() {
  const { organization } = await getCurrentUser()
  return <GeneratorPageClient orgName={organization?.name ?? ""} />
}
