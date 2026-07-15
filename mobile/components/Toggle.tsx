import { Pressable, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { hSelect } from "@/lib/haptics";

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => {
        hSelect();
        onChange(!value);
      }}
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        backgroundColor: value ? t.accent : t.fill,
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          backgroundColor: "#fff",
          marginLeft: value ? 20 : 2,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 },
        }}
      />
    </Pressable>
  );
}
