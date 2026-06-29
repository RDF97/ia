import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { teams } from "@/lib/appwrite";
import { useHogar } from "@/lib/hogar";
import { colors } from "@/theme/tokens";

// Pantalla a la que lleva el enlace de invitación (deep link homie://join?...).
export default function Join() {
  const params = useLocalSearchParams<{
    teamId?: string;
    membershipId?: string;
    userId?: string;
    secret?: string;
  }>();
  const { reload } = useHogar();
  const router = useRouter();
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { teamId, membershipId, userId, secret } = params;
      if (!teamId || !membershipId || !userId || !secret) {
        setStatus("error");
        setMsg("Enlace de invitación inválido o incompleto.");
        return;
      }
      try {
        await teams.updateMembershipStatus(teamId, membershipId, userId, secret);
        await reload();
        setStatus("ok");
        setTimeout(() => router.replace("/"), 900);
      } catch (e) {
        setStatus("error");
        setMsg(e instanceof Error ? e.message : "No se pudo unir al hogar.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-bg-app items-center justify-center px-6">
      {status === "working" && (
        <>
          <ActivityIndicator color={colors.accent} />
          <Text className="text-neutral-500 mt-3">Uniéndote al hogar…</Text>
        </>
      )}
      {status === "ok" && (
        <Text className="text-[16px] font-semibold" style={{ color: colors.green }}>
          ¡Te has unido al hogar! 🎉
        </Text>
      )}
      {status === "error" && (
        <Text className="text-[15px] text-center" style={{ color: colors.red }}>
          {msg}
        </Text>
      )}
    </SafeAreaView>
  );
}
