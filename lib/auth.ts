import { createClient } from "@/lib/supabase/server";
import { User, UserRole } from "@/lib/types";
import { redirect } from "next/navigation";

export async function getUser(): Promise<User | null> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();

  if (!["admin", "super_admin"].includes(user.role)) {
    redirect("/");
  }

  return user;
}

export async function requireSuperAdmin(): Promise<User> {
  const user = await requireUser();

  if (user.role !== "super_admin") {
    redirect("/");
  }

  return user;
}

export function hasRole(user: User | null, roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

export function isAdmin(user: User | null): boolean {
  return hasRole(user, ["admin", "super_admin"]);
}

export function isSuperAdmin(user: User | null): boolean {
  return hasRole(user, ["super_admin"]);
}
