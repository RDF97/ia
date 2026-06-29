import { Pressable, Text, View } from "react-native";
import { colors } from "@/theme/tokens";

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
  disabled?: boolean;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (key: T) => void;
}) {
  return (
    <View className="flex-row bg-neutral-200 rounded-[9px] p-0.5 mx-4 mb-3">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            disabled={o.disabled}
            onPress={() => onChange(o.key)}
            className="flex-1 py-1.5 rounded-[7px] items-center"
            style={on ? { backgroundColor: "#fff" } : undefined}
          >
            <Text
              className="text-[13px] font-medium"
              style={{ color: colors.label, opacity: o.disabled ? 0.4 : 1 }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
