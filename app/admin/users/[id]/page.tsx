import { requireAdmin } from "@/lib/auth";
import { UserDetailClient } from "./UserDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UserDetailPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;

  return (
    <div>
      <UserDetailClient userId={id} />
    </div>
  );
}
