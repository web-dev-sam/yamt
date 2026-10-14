export type Screen =
  | { readonly kind: "files" }
  | { readonly kind: "settings" }
  | { readonly kind: "serverLog"; readonly name: string };
