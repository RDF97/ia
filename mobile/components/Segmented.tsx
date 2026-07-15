import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { hSelect } from "@/lib/haptics";

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
  const t = useTheme();
  return (
    <View className="flex-row rounded-[9px] p-0.5 mx-4 mb-3" style={{ backgroundColor: t.fill }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            disabled={o.disabled}
            onPress={() => {
              hSelect();
              onChange(o.key);
            }}
            className="flex-1 py-1.5 rounded-[7px] items-center"
            style={
              on
                ? {
                    backgroundColor: t.card,
                    shadowColor: "#000",
                    shadowOpacity: t.dark ? 0 : 0.06,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 1,
                  }
                : undefined
            }
          >
            <Text className="text-[13px] font-medium" style={{ color: t.label, opacity: o.disabled ? 0.4 : 1 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
