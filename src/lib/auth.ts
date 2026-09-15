import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import type { User } from "@/generated/prisma/client";

/**
 * Emails con acceso al panel de plataforma (ver PLATFORM_ADMIN_EMAILS en .env).
 * La asignación del rol se deriva SIEMPRE del entorno del servidor, nunca de
 * datos enviados por el cliente.
 */
function getPlatformAdminEmails(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Devuelve el User de la aplicación correspondiente a la sesión actual de
 * Clerk, o null si no hay sesión.
 *
 * La identidad se deriva SIEMPRE de la sesión del servidor (clerkId), nunca de
 * datos enviados por el cliente. Si el usuario aún no existe en nuestra base
 * de datos, se crea (upsert perezoso) con los datos de su perfil en Clerk.
 */
export async function getCurrentUser(): Promise<User | null> {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const clerk = await clerkClient();
  const profile = await clerk.users.getUser(userId);
  const email = profile.primaryEmailAddress?.emailAddress ?? "";
  const platformAdmins = getPlatformAdminEmails();

  return db.user.upsert({
    where: { clerkId: userId },
    create: {
      clerkId: userId,
      email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.primaryPhoneNumber?.phoneNumber,
      isPlatformAdmin: platformAdmins.has(email.toLowerCase()),
    },
    update: {
      email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.primaryPhoneNumber?.phoneNumber,
      isPlatformAdmin: platformAdmins.has(email.toLowerCase()),
    },
  });
}

/**
 * Igual que getCurrentUser pero lanza un error si no hay sesión activa.
 * Debe usarse en server actions y rutas donde la autenticación es obligatoria.
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("No autenticado.");
  }

  return user;
}
