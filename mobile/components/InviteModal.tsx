import { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useHogar } from "@/lib/hogar";
import { colors } from "@/theme/tokens";

export function InviteModal({
  visible,
  hogarName,
  onClose,
}: {
  visible: boolean;
  hogarName: string;
  onClose: () => void;
}) {
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
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <View className="bg-bg-app rounded-t-[14px] absolute left-0 right-0 bottom-0 p-5" style={{ paddingBottom: 32 }}>
        <Text className="text-[17px] font-semibold mb-1">Invitar al hogar</Text>
        <Text className="text-[13px] text-neutral-500 mb-4">
          Escribe el email de la persona. Recibirá un enlace para unirse a “{hogarName}”.
        </Text>
        <TextInput
          className="bg-white rounded-lg2 px-4 py-3 mb-3 text-[16px] text-black"
          placeholder="email@ejemplo.com"
          placeholderTextColor={colors.labelSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Pressable
          onPress={send}
          disabled={busy || !email.trim()}
          className="rounded-[14px] py-3.5 items-center"
          style={{ backgroundColor: colors.accent, opacity: busy || !email.trim() ? 0.6 : 1 }}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-semibold">Enviar invitación</Text>}
        </Pressable>
      </View>
    </Modal>
  );
}
