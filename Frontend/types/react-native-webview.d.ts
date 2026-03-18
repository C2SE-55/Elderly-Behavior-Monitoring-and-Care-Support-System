declare module "react-native-webview" {
  import { Component } from "react";
  import { ViewProps } from "react-native";

  export interface WebViewProps extends ViewProps {
    source: { uri?: string; html?: string };
    style?: ViewProps["style"];
    scrollEnabled?: boolean;
    originWhitelist?: string[];
    mixedContentMode?: "never" | "always" | "compatibility";
  }

  export class WebView extends Component<WebViewProps> {}
}
