// Of two wildcard patterns with the same prefix TypeScript uses the first declared, so `?raw` comes first.
declare module "~icons/*?raw" {
  const markup: string;
  export default markup;
}

declare module "~icons/*" {
  import type { FunctionalComponent, SVGAttributes } from "vue";

  const component: FunctionalComponent<SVGAttributes>;
  export default component;
}
