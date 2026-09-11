import { adminSchemaTypes } from "./admin-types";
import { publishSchedule } from "./publish-schedule";
import { ubersuggestSchemaTypes } from "./ubersuggest-types";

export const adminIntelligenceSchemaTypes = [
  ...adminSchemaTypes,
  ...ubersuggestSchemaTypes,
  publishSchedule,
];
