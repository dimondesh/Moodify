import { axiosInstance } from "@/lib/axios";
import type { Hub, HubDetailResponse } from "@/types";

export async function fetchHubs(): Promise<Hub[]> {
  const res = await axiosInstance.get("/hubs");
  return res.data.hubs || [];
}

export async function fetchHubById(id: string): Promise<HubDetailResponse> {
  const res = await axiosInstance.get(`/hubs/${id}`);
  return res.data;
}
