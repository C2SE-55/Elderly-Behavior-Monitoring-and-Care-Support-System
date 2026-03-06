import { Redirect } from "expo-router";

export default function Index() {
  // Mở app vào (tabs) để thanh menu hiển thị; đổi thành "/(auths)/welcome" nếu muốn vào màn chào trước
  return <Redirect href="/(tabs)" />;
}

