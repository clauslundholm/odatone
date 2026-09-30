import { Link } from "expo-router";
import { View } from "react-native";

import { Txt } from "../src/components/Txt";
import { useTheme } from "../src/theme/theme";

export default function NotFound() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", gap: 10 }}>
      <Txt variant="display">404</Txt>
      <Link href="/">
        <Txt variant="body" tone="accent">Odatone</Txt>
      </Link>
    </View>
  );
}
