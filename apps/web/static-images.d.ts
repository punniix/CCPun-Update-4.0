// Static SVG and WebP imports must typecheck before Next generates next-env.d.ts.
declare module "*.svg" {
  const image: import("next/image").StaticImageData;
  export default image;
}

declare module "*.webp" {
  const image: import("next/image").StaticImageData;
  export default image;
}
