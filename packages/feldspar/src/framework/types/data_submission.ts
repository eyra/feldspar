export interface DataSubmissionData {
  [key: string]: any;
}

export interface DataSubmissionProvider {
  getDataSubmissionData(): DataSubmissionData;
}