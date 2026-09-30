import { TextInput, View, type TextInputProps } from "react-native";

import { useTheme } from "../theme/theme";
import { RADIUS } from "../theme/tokens";
import { Txt } from "./Txt";

/** A labelled text input. The error sits under the field it belongs to,
    the same place the website's <Field> puts it. */
export function Field({
  label,
  error,
  hint,
  style,
  ...input
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Txt variant="label" tone="ink2">
          {label}
        </Txt>
        {hint ? (
          <Txt variant="label" tone="ink3">
            {hint}
          </Txt>
        ) : null}
      </View>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.ink3}
        {...input}
        style={[
          {
            minHeight: 48,
            paddingHorizontal: 14,
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: error ? c.warn : c.line,
            backgroundColor: c.surface,
            color: c.ink,
            fontSize: 16,
          },
          style,
        ]}
      />
      {error ? (
        <Txt variant="label" tone="warn">
          {error}
        </Txt>
      ) : null}
    </View>
  );
}
