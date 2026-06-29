import { Pressable, View } from "react-native";
import { colors } from "@/theme/tokens";

export function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        backgroundColor: value ? colors.accent : "#78788033",
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
        }}
      />
    </Pressable>
  );
}
