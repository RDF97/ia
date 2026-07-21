import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Share, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useHogar } from "@/lib/hogar";
import { useAuth } from "@/lib/auth";
import { createInvite, inviteMessage, type Invite } from "@/lib/invites";
import { useTheme } from "@/theme/theme";
import { hSelect } from "@/lib/haptics";

export function InviteModal({
  visible,
  hogarName,
  onClose,
}: {
  visible: boolean;
  hogarName: string;
  onClose: () => void;
}) {
  const t = useTheme();
  const { active } = useHogar();
  const { user } = useAuth();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      setInvite(null);
      setBusy(false);
    }
  }, [visible]);

  const generate = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const inv = await createInvite(active.$id, active.name, user?.name || "Alguien");
      setInvite(inv);
    } catch (e) {
      Alert.alert("No se pudo crear la invitación", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!invite) return;
    hSelect();
    try {
      await Share.share({ message: inviteMessage(hogarName, invite.code) });
    } catch {
      /* el usuario canceló */
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={onClose} />
      <View className="rounded-t-[14px] absolute left-0 right-0 bottom-0 p-5" style={{ paddingBottom: 32, backgroundColor: t.bg }}>
        <Text className="text-[17px] font-semibold mb-1 text-label">Invitar al hogar</Text>
        <Text className="text-[13px] text-secondary mb-4">
          Crea un código y compártelo por WhatsApp. El mensaje incluye el enlace para descargar
          la app y el código para entrar en “{hogarName}”.
        </Text>

        {!invite ? (
          <Pressable
            onPress={generate}
            disabled={busy}
            className="rounded-[14px] py-3.5 items-center flex-row justify-center"
            style={{ backgroundColor: t.accent, gap: 8, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="link" size={18} color="#fff" />
                <Text className="text-white text-base font-semibold">Crear enlace de invitación</Text>
              </>
            )}
          </Pressable>
        ) : (
          <>
            <View className="bg-card rounded-lg2 px-4 py-4 mb-3 items-center">
              <Text className="text-[12px] uppercase tracking-wide text-secondary mb-1">Código</Text>
              <Text className="text-[26px] font-bold text-label" style={{ letterSpacing: 4 }}>
                {invite.code}
              </Text>
            </View>
            <Pressable
              onPress={share}
              className="rounded-[14px] py-3.5 items-center flex-row justify-center"
              style={{ backgroundColor: t.accent, gap: 8 }}
            >
              <Ionicons name="share-social" size={18} color="#fff" />
              <Text className="text-white text-base font-semibold">Compartir enlace</Text>
            </Pressable>
            <Pressable onPress={generate} disabled={busy} className="mt-3 items-center py-1">
              <Text className="text-[14px]" style={{ color: t.accent }}>Crear otro código</Text>
            </Pressable>
            <Text className="text-[12px] text-tertiary text-center mt-2">
              El código caduca en 14 días.
            </Text>
          </>
        )}
      </View>
    </Modal>
  );
}
