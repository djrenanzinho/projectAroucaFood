import { Redirect } from "expo-router";

export default function Index() {
  // Redirect root to the tabs navigator (home)
  return <Redirect href="/userConfigs" />;
}
