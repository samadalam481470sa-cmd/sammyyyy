export type Ats = "greenhouse" | "lever" | "ashby";

export type Job = {
  id: string;
  company: string;
  title: string;
  location: string;
  url: string;
  description: string;
  ats: Ats;
  postedAt?: string;
};

export type Company = {
  name: string;
  ats: Ats;
  token: string;
};
