import { adminSchemaTypes } from "./admin-types";
import { ubersuggestSchemaTypes } from "./ubersuggest-types";

export const adminIntelligenceSchemaTypes = [
  ...adminSchemaTypes,
  ...ubersuggestSchemaTypes,
];
