"use client";

import { ArticleLiveBadge } from "./cms/sanity/policy/article-editorial-status";
import { defineConfig } from "sanity";
import { schemaTypes } from "./cms/sanity/schema";
import { createStudioPresentationPlugin } from "./cms/sanity/config/presentation";
import { getStudioPublishingOptions } from "./cms/sanity/config/publishing";
import { createStudioStructurePlugin } from "./cms/sanity/config/structure";
import { wrapGoogleSafeArticlePublishActions } from "./cms/sanity/policy/article-publish-action";
import { appendArticleScheduleAction } from "./cms/sanity/policy/article-schedule-action";
import {
  filterStudioAuthProviders,
  filterStudioDocumentActions,
  filterStudioNewDocumentOptions,
  protectProductionContentLifecycleActions,
} from "./cms/sanity/policy/studio-policy";
import { isStudioDataPlaneAllowed, resolveSanityConfigEnvironment } from "./lib/admin/environment";

const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.SANITY_STUDIO_DATASET ?? process.env.NEXT_PUBLIC_SANITY_DATASET;
const environment = resolveSanityConfigEnvironment(
  process.env.NEXT_PUBLIC_CCPUN_APP_ENV,
  process.env.CCPUN_APP_ENV,
  typeof process !== "undefined" && process.release?.name === "node",
);
const isProductionCms = dataset === "production";
const studioName = isProductionCms ? "ccpun-website-production-cms" : "ccpun-website-uat-cms";
const studioTitle = isProductionCms ? "CCPun Website Production CMS" : "CCPun Website UAT CMS";

export const sanityStudioConfig =
  projectId && dataset && isStudioDataPlaneAllowed(dataset, environment, undefined, undefined, projectId)
    ? defineConfig({
        name: studioName,
        title: studioTitle,
        basePath: "/studio",
        projectId,
        dataset,
        auth: {
          providers: (providers) => filterStudioAuthProviders(providers, dataset, environment, projectId),
          redirectOnSingle: true,
        },
        ...getStudioPublishingOptions(dataset, environment, projectId),
        plugins: [
          createStudioStructurePlugin(environment),
          createStudioPresentationPlugin(),
        ],
        schema: { types: schemaTypes },
        document: {
          badges: (previous, context) => context.schemaType === "article" ? [...previous, ArticleLiveBadge] : previous,
          actions: (previousActions, context) =>
            appendArticleScheduleAction(
              wrapGoogleSafeArticlePublishActions(
                protectProductionContentLifecycleActions(
                  filterStudioDocumentActions(previousActions, context.dataset, environment, context.schemaType, projectId),
                  environment,
                  context.schemaType,
                ),
                environment,
                context.schemaType,
              ),
              environment,
              context.schemaType,
            ),
          newDocumentOptions: (previousOptions) => filterStudioNewDocumentOptions(previousOptions, dataset, environment, projectId),
        },
      })
    : null;

export default sanityStudioConfig;
