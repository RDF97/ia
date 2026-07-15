import { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useHogar } from "@/lib/hogar";
import { useTheme } from "@/theme/theme";

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
  const { invite } = useHogar();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await invite(email.trim());
      setEmail("");
      onClose();
      Alert.alert("Invitación enviada", "Le hemos enviado un email con el enlace para unirse al hogar.");
    } catch (e) {
      Alert.alert("No se pudo invitar", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={onClose} />
      <View className="rounded-t-[14px] absolute left-0 right-0 bottom-0 p-5" style={{ paddingBottom: 32, backgroundColor: t.bg }}>
        <Text className="text-[17px] font-semibold mb-1 text-label">Invitar al hogar</Text>
        <Text className="text-[13px] text-secondary mb-4">
          Escribe el email de la persona. Recibirá un enlace para unirse a “{hogarName}”.
        </Text>
        <TextInput
          className="bg-card rounded-lg2 px-4 py-3 mb-3 text-[16px] text-label"
          placeholder="email@ejemplo.com"
          placeholderTextColor={t.labelTertiary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Pressable
          onPress={send}
          disabled={busy || !email.trim()}
          className="rounded-[14px] py-3.5 items-center"
          style={{ backgroundColor: t.accent, opacity: busy || !email.trim() ? 0.6 : 1 }}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-semibold">Enviar invitación</Text>}
        </Pressable>
      </View>
    </Modal>
  );
}
