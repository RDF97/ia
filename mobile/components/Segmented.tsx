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
    // El control segmentado de iOS mide 32 pt de alto y el pulgar de dentro va
    // separado 2 pt del carril. Con menos alto el texto queda apretado y el
    // control se lee como una fila de botones sueltos.
    <View
      className="flex-row rounded-ctl mx-4 mb-3"
      style={{ backgroundColor: t.fill, padding: 2, minHeight: 32 }}
    >
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
            className="flex-1 rounded-ctl items-center justify-center"
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
            <Text className="text-footnote font-medium" style={{ color: t.label, opacity: o.disabled ? 0.4 : 1 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
