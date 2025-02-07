export interface DonationData {
  [key: string]: any;
}

export interface DonationProvider {
  getDonationData(): DonationData;
}