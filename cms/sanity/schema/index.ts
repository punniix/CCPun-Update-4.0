import { article } from "./documents/article";
import { author } from "./documents/author";
import { category } from "./documents/category";
import { faqItem } from "./objects/faq-item";
import { sourceReference } from "./objects/source-reference";
import { reviewMetadata } from "./objects/review-metadata";
import { migrationSource } from "./objects/migration-source";
import { seoMetadata } from "./objects/seo-metadata";
import { geoMetadata } from "./objects/geo-metadata";
import { imageWithAlt } from "./objects/image-with-alt";
import { migratedImage } from "./objects/migrated-image";
import { tableRow, simpleTable } from "./objects/table";
import { divider } from "./objects/divider";
import { callout } from "./objects/callout";
import { imageGallery } from "./objects/image-gallery";
import { ctaBlock } from "./objects/cta-block";
import { pdfDownload } from "./objects/pdf-download";
import { detailsBlock } from "./objects/details-block";
import { portableText } from "./objects/portable-text";
import { masterContent } from "./documents/master-content";
import { socialVariant } from "./documents/social-variant";
import { lineDiscoveryConfig } from "./documents/line-discovery-config";
import { socialCommentSeriesItem } from "./objects/social-comment-series-item";
import { adminIntelligenceSchemaTypes } from "../admin/schema";

export const schemaTypes = [
  ...adminIntelligenceSchemaTypes,
  article,
  author,
  category,
  faqItem,
  sourceReference,
  reviewMetadata,
  migrationSource,
  seoMetadata,
  geoMetadata,
  imageWithAlt,
  migratedImage,
  tableRow,
  simpleTable,
  divider,
  callout,
  imageGallery,
  ctaBlock,
  pdfDownload,
  detailsBlock,
  portableText,
  masterContent,
  socialVariant,
  lineDiscoveryConfig,
  socialCommentSeriesItem,
];
