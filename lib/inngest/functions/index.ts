import { extractionEmailSync } from "./extraction-email-sync";
import { extractionFileProcess } from "./extraction-file-process";
import { pipelineBuildList } from "./pipeline-build-list";

export const functions = [
  extractionEmailSync,
  extractionFileProcess,
  pipelineBuildList,
];
