import id from "./messages/id.json";

type Messages = typeof id;

declare module "next-intl" {
  interface AppConfig {
    Locale: "id" | "en";
    Messages: Messages;
  }
}
